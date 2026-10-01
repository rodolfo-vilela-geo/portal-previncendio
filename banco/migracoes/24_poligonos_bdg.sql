-- =====================================================================
--  COLIBRI — POLÍGONOS DO BDG (cicatrizes históricas 2013–2025)
--  · area_queimada recebe o shapefile do BDG (fonte 'BDG') e, depois,
--    os polígonos que forem sendo encontrados para os ROIs sem polígono;
--  · importação em lote pela página bdg.html (Previncêndio/admin):
--    só ausentes ou substituindo; geometria corrigida e área calculada;
--  · resumo por ano e lista dos ROIs sem polígono ("polígonos ausentes");
--  · Painel da UC: ocorrências históricas aparecem no mapa pelo polígono.
-- =====================================================================

alter table area_queimada add column if not exists criado_por text default lower(auth.jwt() ->> 'email');
create index if not exists area_queimada_cod_idx on area_queimada (cod_bdp);

-- importação em lote: p_itens = [{cod, geom (GeoJSON Polygon/MultiPolygon)}]
create or replace function area_queimada_importar(p_itens jsonb, p_fonte text default 'BDG', p_substituir boolean default false)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare it jsonb; v_cod text; g geometry; n_ins int := 0; n_ign int := 0; n_sub int := 0; n_inv int := 0; sem_roi text[] := '{}';
begin
  if not is_gpcif() then raise exception 'Somente o Previncêndio importa polígonos do BDG.' using errcode = '42501'; end if;
  if jsonb_array_length(p_itens) > 500 then raise exception 'Envie no máximo 500 polígonos por vez.'; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    v_cod := upper(trim(it ->> 'cod'));
    if v_cod is null or v_cod = '' then n_inv := n_inv + 1; continue; end if;
    begin
      g := st_setsrid(st_geomfromgeojson((it -> 'geom')::text), 4674);
      g := st_multi(st_collectionextract(st_makevalid(g), 3));
    exception when others then n_inv := n_inv + 1; continue; end;
    if g is null or st_isempty(g) or st_xmin(g) < -51.5 or st_xmax(g) > -39.5 or st_ymin(g) < -23.5 or st_ymax(g) > -14 then n_inv := n_inv + 1; continue; end if;
    -- para substituir, a página apaga antes os polígonos antigos (política equipe_area)
    if not p_substituir and exists (select 1 from area_queimada where cod_bdp = v_cod) then n_ign := n_ign + 1; continue; end if;
    insert into area_queimada (cod_bdp, geom, fonte) values (v_cod, g, coalesce(nullif(trim(p_fonte), ''), 'BDG'));
    n_ins := n_ins + 1;
    if not exists (select 1 from roi where cod_bdp = v_cod) then sem_roi := sem_roi || v_cod; end if;
  end loop;
  return jsonb_build_object('inseridos', n_ins, 'substituidos', n_sub, 'ignorados', n_ign, 'invalidos', n_inv, 'sem_roi', to_jsonb(sem_roi));
end $$;
revoke all on function area_queimada_importar(jsonb, text, boolean) from public, anon;
grant execute on function area_queimada_importar(jsonb, text, boolean) to authenticated;

-- ROIs (2013 em diante) com e sem polígono

create or replace view vw_bdg_poligonos with (security_invoker = true) as
select o.cod_bdp, o.ano, o.ri, o.roi, o.categoria, o.nome_uc, o.ufbio, o.municipio, o.local, o.dat_detec,
       round((coalesce(o.area_int, 0) + coalesce(o.area_ent, 0))::numeric, 2) as area_declarada,
       a.n_pol, a.area_pol, a.fonte
  from roi o
  left join (select cod_bdp, count(*) n_pol, round(sum(area_ha), 2) area_pol, string_agg(distinct fonte, ', ') fonte
               from area_queimada group by cod_bdp) a using (cod_bdp)
 where o.status <> 'cancelado';
grant select on vw_bdg_poligonos to authenticated;
revoke all on vw_bdg_poligonos from anon;

-- polígonos sem ROI correspondente (cod_bdp que não existe na tabela de ROIs)
create or replace view vw_area_sem_roi with (security_invoker = true) as
select a.cod_bdp, a.fonte, a.area_ha, a.criado_em from area_queimada a where not exists (select 1 from roi o where o.cod_bdp = a.cod_bdp);
grant select on vw_area_sem_roi to authenticated;
revoke all on vw_area_sem_roi from anon;

-- Painel da UC: ocorrências históricas pelo polígono e contagem de ROIs sem polígono
create or replace function painel_uc(p_nome_uc text)
returns json language plpgsql stable security definer set search_path = public, extensions as $$
declare r json; ano_atual int := extract(year from (now() at time zone 'America/Sao_Paulo'))::int;
begin
  if not is_usuario() then raise exception 'Entre com seu login para ver o painel da UC.' using errcode = '42501'; end if;
  if not exists (select 1 from uc where nome_uc = p_nome_uc) then raise exception 'UC não encontrada: %', p_nome_uc; end if;

  with
  u as (select * from uc where nome_uc = p_nome_uc),
  c as (select * from uc_cadastro where nome_uc = p_nome_uc),
  lim as (select st_union(geom) g from uc_limite where nome_uc = p_nome_uc and tipo = 'uc'),
  b as (select * from vw_bdg where nome_uc = p_nome_uc and ano between 2013 and ano_atual - 1),
  anos as (select count(distinct ano) n from roi where ano between 2013 and ano_atual - 1),
  por_uc as (select nome_uc, ufbio, count(*) n from vw_bdg where ano between 2013 and ano_atual - 1 group by 1, 2),
  cur as (select * from vw_boletim where nome_uc = p_nome_uc and ano = ano_atual and status <> 'cancelado')
  select json_build_object(
    'ano_atual', ano_atual,
    'uc', (select json_build_object('nome_uc', u.nome_uc, 'categoria', u.categoria, 'grupo', u.grupo, 'bioma_uc', u.bioma_uc,
             'ufbio', u.ufbio, 'base_op', u.base_op, 'municipios', u.municipios,
             'area_limite_ha', (select round((st_area(g::geography) / 10000)::numeric, 1) from lim),
             'gerente', c.gerente_nome, 'func_adm', c.func_adm, 'func_oper', c.func_oper, 'biomas', c.biomas,
             'meses_criticos', c.meses_criticos, 'fundiaria_pct', c.fundiaria_pct, 'fundiaria_ha', c.fundiaria_ha,
             'area_decreto_ha', c.area_decreto_ha, 'n_responsaveis', jsonb_array_length(coalesce(c.responsaveis, '[]')),
             'ref', case when c.ref_lat is not null then json_build_object('lat', c.ref_lat, 'lon', c.ref_lon) end,
             'sede', case when c.sede_lat is not null then json_build_object('lat', c.sede_lat, 'lon', c.sede_lon, 'municipio', c.sede_municipio) end,
             'cadastro_atualizado_em', c.atualizado_em,
             'completo_pct', (select completo_pct from vw_uc_cadastro v where v.nome_uc = u.nome_uc))
           from u left join c on true),
    'geo', json_build_object(
      'limite', (select st_asgeojson(st_simplifypreservetopology(g, 0.0002), 6)::json from lim),
      'za_pm',  (select st_asgeojson(st_simplifypreservetopology(st_union(geom), 0.0004), 6)::json from uc_limite where nome_uc = p_nome_uc and tipo = 'za_pm'),
      'za_3km', (select st_asgeojson(st_simplifypreservetopology(st_union(geom), 0.0004), 6)::json from uc_limite where nome_uc = p_nome_uc and tipo = 'za_3km'),
      'cicatrizes', (select json_agg(json_build_object('cod', a.cod_bdp, 'ano', o.ano, 'geo', st_asgeojson(st_simplifypreservetopology(a.geom, 0.00008), 5)::json))
                     from area_queimada a join roi o using (cod_bdp) where o.nome_uc = p_nome_uc)),
    -- ponto da ocorrência: o do ROI ou, no histórico sem coordenada, um ponto dentro do polígono do BDG
    'ocorrencias', (select json_agg(json_build_object('cod', o.cod_bdp, 'ano', o.ano, 'lat', coalesce(o.lat, round(st_y(p.pt)::numeric, 6)),
                             'lon', coalesce(o.lon, round(st_x(p.pt)::numeric, 6)), 'do_poligono', o.lat is null, 'data', o.dat_detec,
                             'area', round(coalesce(v.soma_area, 0)::numeric, 2), 'causa', o.causa_p, 'local', o.local) order by o.ano)
                    from roi o left join vw_bdg v using (cod_bdp)
                    left join lateral (select st_pointonsurface(st_union(a.geom)) pt from area_queimada a where a.cod_bdp = o.cod_bdp) p on o.lat is null
                    where o.nome_uc = p_nome_uc and (o.lat is not null or p.pt is not null)),
    'sem_poligono', (select count(*) from roi o where o.nome_uc = p_nome_uc and o.ano between 2013 and ano_atual - 1
                       and not exists (select 1 from area_queimada a where a.cod_bdp = o.cod_bdp)),
    'hist', json_build_object(
      'ini', 2013, 'fim', ano_atual - 1, 'n', (select count(*) from b),
      'area_int', (select round(sum(coalesce(area_int, 0))::numeric, 1) from roi where nome_uc = p_nome_uc and ano between 2013 and ano_atual - 1),
      'area_total', (select round(sum(coalesce(soma_area, 0))::numeric, 1) from b),
      'anos', (select json_agg(json_build_object('ano', a, 'n', coalesce(x.n, 0), 'area', coalesce(x.area, 0)) order by a)
               from generate_series(2013, ano_atual - 1) a
               left join (select ano, count(*) n, round(sum(coalesce(soma_area, 0))::numeric, 1) area from b group by ano) x on x.ano = a),
      'meses', (select json_agg(coalesce(x.n, 0) order by m) from generate_series(1, 12) m left join (select extract(month from b.dat_detec)::int mm, count(*) n from b group by 1) x on x.mm = m),
      'causas', (select json_agg(json_build_object('t', t, 'n', n) order by n desc) from (
                   select coalesce(nullif(causa_p, ''), 'Não informada') t, count(*) n from b group by 1 order by 2 desc limit 7) x),
      'deteccao', (select json_agg(json_build_object('t', t, 'n', n) order by n desc) from (
                   select coalesce(nullif(f_detec, ''), 'Não informada') t, count(*) n from b group by 1 order by 2 desc limit 6) x),
      'local', (select json_agg(json_build_object('t', t, 'n', n) order by n desc) from (
                   select coalesce(nullif(local, ''), 'Não informado') t, count(*) n from b group by 1) x),
      'tp_resp_mediana_min', (select round((extract(epoch from percentile_cont(0.5) within group (order by tp_resp)) / 60)::numeric)
                              from b where tp_resp is not null and tp_resp >= interval '0'),
      'dur_mediana_h', (select round((extract(epoch from percentile_cont(0.5) within group (order by dur_ocor)) / 3600)::numeric, 1)
                        from b where dur_ocor is not null and dur_ocor >= interval '0'),
      'sem_combate', (select count(*) from b where dat_comb is null)),
    'comparacao', (select json_build_object(
                     'media_uc', round((select count(*) from b)::numeric / nullif((select n from anos), 0), 1),
                     'media_regional', (select round(avg(n)::numeric / nullif((select n from anos), 0), 1) from por_uc p where p.ufbio = (select ufbio from u)),
                     'media_estado', (select round(avg(n)::numeric / nullif((select n from anos), 0), 1) from por_uc),
                     'posicao', (select pos from (select nome_uc, rank() over (order by n desc) pos from por_uc) x where x.nome_uc = p_nome_uc),
                     'n_ucs', (select count(*) from por_uc))),
    'atual', json_build_object(
      'n', (select count(*) from cur),
      'andamento', (select count(*) from cur where status = 'andamento'),
      'debelados', (select count(*) from cur where status = 'debelado'),
      'meses', (select json_agg(coalesce(x.n, 0) order by m) from generate_series(1, 12) m
                left join (select extract(month from dat_detec)::int mm, count(*) n from cur group by 1) x on x.mm = m),
      'ris', (select json_agg(json_build_object('ri', ri, 'status', status, 'data', dat_detec, 'fim', dat_final, 'municipio', municipio,
                                                'local', local, 'lat', lat, 'lon', lon, 'pessoas', total_pessoas, 'tem_roi', tem_roi) order by ri desc) from cur),
      -- ROIs em aberto de incêndios encerrados nos últimos 30 dias (antes disso os ROIs eram entregues em PDF)
      'roi_pendentes', (select count(*) from ri i where i.nome_uc = p_nome_uc and i.status = 'debelado' and i.dat_final >= current_date - 30
                          and not exists (select 1 from roi o where o.ano = i.ano and o.ri = i.ri)),
      'roi_atrasados', (select count(*) from ri i where i.nome_uc = p_nome_uc and i.status = 'debelado' and i.dat_final >= current_date - 30
                          and i.data_limite < current_date and not exists (select 1 from roi o where o.ano = i.ano and o.ri = i.ri)),
      'apoios', (select json_agg(json_build_object('t', nome, 'pd', pd) order by pd desc) from (
                   select i.nome, sum(x.p) pd from (
                     select a.instituicao_id, a.ano, a.ri, a.data, max(a.pessoas) p from atuacao a join ri r on r.ano = a.ano and r.ri = a.ri
                     where r.nome_uc = p_nome_uc and a.ano = ano_atual group by 1, 2, 3, 4) x
                   join instituicao i on i.id = x.instituicao_id group by i.nome order by 2 desc limit 6) y))
  ) into r;
  return r;
end $$;
revoke all on function painel_uc(text) from public, anon;
grant execute on function painel_uc(text) to authenticated;
