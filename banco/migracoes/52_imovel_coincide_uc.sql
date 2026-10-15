-- 52 — Análise de Incêndio Florestal: aviso quando um imóvel do CAR coincide com o limite de uma UC
-- (cobre ≥ 80% da área da UC e tem ≥ 80% da própria área dentro dela — ex.: Ibitipoca, inscrito no CAR em Lima Duarte).
-- Só aviso; o imóvel continua na lista e nas contas.

create or replace function imovel_coincide_uc(g geometry, area_ha numeric) returns text
language sql stable security definer set search_path = public as $$
  select string_agg(u.nome_uc, ', ' order by u.nome_uc)
  from (select l.nome_uc, st_union(l.geom) geom, sum(st_area(l.geom::geography)) / 1e4 ha
        from uc_limite l where l.tipo = 'uc' and l.geom && g group by l.nome_uc) u
  where area_ha between u.ha * 0.6 and u.ha * 1.6
    and st_area(st_intersection(u.geom, g)::geography) / 1e4 >= 0.8 * u.ha
    and st_area(st_intersection(u.geom, g)::geography) / 1e4 >= 0.8 * area_ha
$$;
revoke execute on function imovel_coincide_uc(geometry, numeric) from public, anon;

-- imóveis do CAR de uma UC que coincidem com o limite de alguma UC (a página junta isso à lista do geo_imoveis)
create or replace function imovel_avisos_uc(p_uc text)
returns table (id bigint, uc_coincide text)
language sql stable security definer set search_path = public as $$
  select i.id, imovel_coincide_uc(i.geom, i.area_ha)
  from imovel i
  where is_tecnica() and p_uc = any(i.ucs) and i.origem = 'car'
    and i.area_ha >= 0.6 * (select min(x.ha) from (select sum(st_area(l.geom::geography)) / 1e4 ha from uc_limite l
                                                  where l.tipo = 'uc' and l.geom && i.geom group by l.nome_uc) x)
    and imovel_coincide_uc(i.geom, i.area_ha) is not null
$$;
revoke execute on function imovel_avisos_uc(text) from public, anon;
grant execute on function imovel_avisos_uc(text) to authenticated;

-- a ficha também traz o aviso
create or replace function imovel_ficha(p_id bigint) returns json
language plpgsql stable security definer set search_path = public as $$
declare i imovel; r json; mon numeric;
begin
  if not is_tecnica() then raise exception 'Somente Previncêndio e Sala Técnica.'; end if;
  select * into i from imovel where id = p_id;
  if i.id is null then return null; end if;
  -- parte do imóvel dentro das UCs/ZAs (onde o BDG tem cicatrizes mapeadas)
  select round((100 * st_area(st_intersection(i.geom, st_union(l.geom))::geography) / nullif(st_area(i.geom::geography), 0))::numeric, 1)
    into mon from uc_limite l where st_intersects(l.geom, i.geom);
  select json_build_object(
    'imovel', (select to_jsonb(i) - 'geom' || jsonb_build_object('geom', st_asgeojson(i.geom, 6)::jsonb)),
    'monitorado_pct', coalesce(mon, 0),
    'uc_coincide', case when i.origem = 'car' then imovel_coincide_uc(i.geom, i.area_ha) end,
    'versoes', (select coalesce(json_agg(json_build_object('car_atualizacao', v.car_atualizacao, 'guardado_em', v.guardado_em, 'area_ha', v.area_ha, 'car_status', v.car_status,
                       'geom', st_asgeojson(st_simplifypreservetopology(v.geom, 0.00002), 6)::jsonb) order by v.guardado_em), '[]') from imovel_versao v where v.imovel_id = i.id),
    'fogo', (select coalesce(json_agg(x order by x.ano, x.dh_detec nulls last), '[]') from (
        select f.cod_bdp, f.ano, f.area_ha area_imovel_ha, f.pct,
               r.ri, r.nome_uc, r.nome_local, r.municipio, r.dat_detec, r.hr_detec, r.dh_detec, r.dh_comb, r.dh_final, r.f_detec,
               r.causa_p, r.causa_out, r.ag_causal, r.ag_out, r.ind_aut, r.proprietario, r.descricao,
               coalesce(r.area_int, 0) + coalesce(r.area_ent, 0) area_total_ha, r.lat, r.lon,
               case when r.lat is not null and r.lon is not null then st_intersects(i.geom, st_setsrid(st_makepoint(r.lon, r.lat), 4674)) end inicio_dentro,
               st_asgeojson(st_simplifypreservetopology(st_intersection(st_makevalid(a.geom), i.geom), 0.00002), 6)::jsonb geom_dentro,
               st_asgeojson(st_simplifypreservetopology(a.geom, 0.00003), 6)::jsonb geom
        from imovel_fogo f join area_queimada a on a.id = f.area_queimada_id left join roi r on r.cod_bdp = f.cod_bdp
        where f.imovel_id = i.id and coalesce(r.status, '') <> 'cancelado') x),
    'pontos_ri', (select coalesce(json_agg(json_build_object('ano', ri.ano, 'ri', ri.ri, 'nome_uc', ri.nome_uc, 'dat_detec', ri.dat_detec, 'hr_detec', ri.hr_detec,
                       'status', ri.status, 'local', ri.local, 'lat', ri.lat, 'lon', ri.lon,
                       'distancia_m', round(st_distance(i.geom::geography, ri.geom::geography)::numeric)) order by ri.ano, ri.ri), '[]')
                  from ri where ri.geom is not null and st_dwithin(i.geom::geography, ri.geom::geography, 1000)),
    'sobreposicoes', (select coalesce(json_agg(json_build_object('id', o.id, 'cod_car', o.cod_car, 'nome', o.nome, 'origem', o.origem, 'car_status', o.car_status,
                       'area_comum_ha', round((st_area(st_intersection(o.geom, i.geom)::geography) / 10000)::numeric, 2))), '[]')
                  from imovel o where o.id <> i.id and st_intersects(o.geom, i.geom)
                   and st_area(st_intersection(o.geom, i.geom)::geography) > 1000),
    'notas', (select coalesce(json_agg(json_build_object('id', n.id, 'tipo', n.tipo, 'texto', n.texto, 'criado_em', n.criado_em, 'criado_por', n.criado_por) order by n.criado_em desc), '[]')
              from imovel_nota n where n.imovel_id = i.id)
  ) into r;
  return r;
end $$;

