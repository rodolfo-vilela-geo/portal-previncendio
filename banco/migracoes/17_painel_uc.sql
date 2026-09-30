-- =====================================================================
--  PORTAL PREVINCÊNDIO — PAINEL DA UC (para os gestores)
--  Uma chamada devolve tudo o que o painel de uma UC precisa: cadastro,
--  geometrias (limite, ZAs, ocorrências, cicatrizes), histórico do BDG,
--  sazonalidade × meses críticos declarados, causas, detecção, tempo de
--  resposta, comparação com a regional e o estado, e a situação do ano.
--  Só para usuários logados (gerentes e equipe). Sem dados pessoais.
-- =====================================================================
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
      'cicatrizes', (select json_agg(json_build_object('cod', a.cod_bdp, 'ano', o.ano, 'geo', st_asgeojson(st_simplifypreservetopology(a.geom, 0.00005), 6)::json))
                     from area_queimada a join roi o using (cod_bdp) where o.nome_uc = p_nome_uc)),
    'ocorrencias', (select json_agg(json_build_object('cod', o.cod_bdp, 'ano', o.ano, 'lat', o.lat, 'lon', o.lon, 'data', o.dat_detec,
                             'area', round(coalesce(v.soma_area, 0)::numeric, 2), 'causa', o.causa_p, 'local', o.local) order by o.ano)
                    from roi o left join vw_bdg v using (cod_bdp)
                    where o.nome_uc = p_nome_uc and o.lat is not null and o.lon is not null),
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
