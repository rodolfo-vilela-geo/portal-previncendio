-- =====================================================================
--  COLIBRI — MAPA DO COLIBRI (visualizador geográfico, protótipo)
--  Funções de leitura para o visualizador: só usuários logados (is_usuario).
--  Ocorrências (ROI/RI) e áreas queimadas do BDG ficam visíveis a todos os
--  usuários logados, sem dados pessoais (nomes, telefones, REDS, descrição).
-- =====================================================================

-- Um ponto por ocorrência: polígono do BDG (ponto na superfície do maior),
-- senão a coordenada do ROI, senão a do RI (eventos do ano corrente).
-- Saída compacta: [lon, lat, ano, cod_bdp, nome_uc, area_ha, tem_poligono, origem('roi'|'ri'), ri]
create or replace function geo_ocorrencias(p_ano_ini int default 2013, p_ano_fim int default 2100)
returns json language sql stable security definer set search_path = public, extensions as $$
  with pol as (
    select distinct on (cod_bdp) cod_bdp, st_pointonsurface(geom) as p
    from area_queimada order by cod_bdp, area_ha desc nulls last
  ), tot as (
    select cod_bdp, sum(area_ha) as area from area_queimada group by cod_bdp
  ), r as (
    select coalesce(pol.p, o.geom, i.geom) as p, o.ano, o.cod_bdp, o.nome_uc,
           coalesce(tot.area, coalesce(o.area_int, 0) + coalesce(o.area_ent, 0)) as area,
           pol.p is not null as tem_pol, 'roi' as origem, o.ri
    from roi o
    left join pol using (cod_bdp) left join tot using (cod_bdp)
    left join ri i on i.ano = o.ano and i.ri = o.ri
    where o.status <> 'cancelado' and o.ano between p_ano_ini and p_ano_fim
    union all
    select i.geom, i.ano, null, i.nome_uc, null, false, 'ri', i.ri
    from ri i
    where i.geom is not null and i.ano between p_ano_ini and p_ano_fim
      and not exists (select 1 from roi o where o.ano = i.ano and o.ri = i.ri and o.status <> 'cancelado')
  )
  select case when not is_usuario() then null else coalesce(json_agg(json_build_array(
           round(st_x(p)::numeric, 5), round(st_y(p)::numeric, 5), ano, cod_bdp, nome_uc,
           round(area::numeric, 2), tem_pol, origem, ri)), '[]'::json) end
  from r where p is not null;
$$;

-- Polígonos do BDG numa caixa (lon/lat), simplificados pela tolerância (graus).
create or replace function geo_queimadas(x0 float8, y0 float8, x1 float8, y1 float8,
  p_ano_ini int default 2013, p_ano_fim int default 2100, p_tol float8 default 0, p_uc text default null, p_lim int default 4000)
returns json language sql stable security definer set search_path = public, extensions as $$
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
           'id', a.id, 'cod_bdp', a.cod_bdp, 'ano', o.ano, 'nome_uc', o.nome_uc, 'area_ha', a.area_ha, 'fonte', a.fonte,
           'geom', st_asgeojson(case when p_tol > 0 then st_simplifypreservetopology(a.geom, p_tol) else a.geom end, 6, 0)::json)), '[]'::json) end
  from (select a.* from area_queimada a join roi o using (cod_bdp)
        where a.geom && st_makeenvelope(x0, y0, x1, y1, 4674)
          and o.status <> 'cancelado' and o.ano between p_ano_ini and p_ano_fim
          and (p_uc is null or o.nome_uc = p_uc)
        order by o.ano desc limit p_lim) a
  join roi o using (cod_bdp);
$$;

-- Ficha de uma ocorrência (sem dados pessoais).
create or replace function geo_ocorrencia(p_cod text, p_ano int default null, p_ri text default null)
returns json language sql stable security definer set search_path = public, extensions as $$
  select case when not is_usuario() then null else (
    select row_to_json(x) from (
      select o.cod_bdp, o.ano, o.ri, o.roi, o.nome_uc, o.categoria, o.ufbio, o.municipio, o.nome_local, o.local,
             o.dat_detec, o.f_detec, o.dat_comb, o.dat_final, o.causa_p, o.ag_causal,
             o.area_int, o.area_ent, o.fonte_area, o.status,
             (select round(sum(area_ha), 2) from area_queimada a where a.cod_bdp = o.cod_bdp) as area_poligonos
      from roi o where (p_cod is not null and o.cod_bdp = p_cod) or (p_cod is null and o.ano = p_ano and o.ri = p_ri)
      union all
      select null, i.ano, i.ri, null, i.nome_uc, null, null, i.municipio, null, i.local,
             i.dat_detec, i.f_detec, i.dat_ini_comb, i.dat_final, null, null, null, null, null, i.status, null
      from ri i where p_cod is null and i.ano = p_ano and i.ri = p_ri
        and not exists (select 1 from roi o where o.ano = i.ano and o.ri = i.ri)
      limit 1) x) end;
$$;

-- Limites (UC e zonas de amortecimento) simplificados.
create or replace function geo_limites(p_tol float8 default 0.0005)
returns json language sql stable security definer set search_path = public, extensions as $$
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
           'nome_uc', l.nome_uc, 'tipo', l.tipo, 'categoria', u.categoria, 'ufbio', u.ufbio,
           'geom', st_asgeojson(st_simplifypreservetopology(l.geom, p_tol), 5, 0)::json)), '[]'::json) end
  from uc_limite l left join uc u using (nome_uc);
$$;

revoke all on function geo_ocorrencias(int, int) from public, anon;
revoke all on function geo_queimadas(float8, float8, float8, float8, int, int, float8, text, int) from public, anon;
revoke all on function geo_ocorrencia(text, int, text) from public, anon;
revoke all on function geo_limites(float8) from public, anon;
grant execute on function geo_ocorrencias(int, int) to authenticated;
grant execute on function geo_queimadas(float8, float8, float8, float8, int, int, float8, text, int) to authenticated;
grant execute on function geo_ocorrencia(text, int, text) to authenticated;
grant execute on function geo_limites(float8) to authenticated;
