-- =====================================================================
--  48 · setores_resumo: sai o critério do Air Tractor (pista ≥ 25 × 1.000 m a até 17 km, em desuso);
--  entram as pistas num raio de 50 km do setor, só como informação (não limita o uso).
-- =====================================================================
create or replace function setores_resumo(p_nome_uc text)
returns json language sql stable security definer set search_path = public, extensions as $$
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
    'id', s.id,
    'pista', (select json_build_object('id', r.id, 'nome', r.nome, 'tipo', r.tipo, 'km', round((st_distance(r.geom::geography, s.geom::geography) / 1000)::numeric, 1),
                'comprimento_m', r.comprimento_m, 'largura_m', r.largura_m, 'superficie', r.superficie, 'agua', r.agua, 'recebe_at802', r.recebe_at802,
                'situacao', r.situacao)
              from recurso_aereo r where r.situacao <> 'inativo' and r.tipo in ('aerodromo_publico','aerodromo_privado','aerodromo_militar','pista_nao_registrada')
              order by r.geom <-> s.geom limit 1),
    'pistas_50km', (select json_agg(x order by x.km) from (
              select r.id, r.nome, r.tipo, round((st_distance(r.geom::geography, s.geom::geography) / 1000)::numeric, 1) as km,
                     r.comprimento_m, r.largura_m, r.superficie
                from recurso_aereo r where r.situacao <> 'inativo' and r.tipo in ('aerodromo_publico','aerodromo_privado','aerodromo_militar','pista_nao_registrada')
                 and st_dwithin(r.geom::geography, s.geom::geography, 50000)
               order by r.geom <-> s.geom limit 8) x),
    'n_pistas_50km', (select count(*) from recurso_aereo r where r.situacao <> 'inativo'
                and r.tipo in ('aerodromo_publico','aerodromo_privado','aerodromo_militar','pista_nao_registrada')
                and st_dwithin(r.geom::geography, s.geom::geography, 50000)),
    'heliponto', (select json_build_object('id', r.id, 'nome', r.nome, 'tipo', r.tipo, 'km', round((st_distance(r.geom::geography, s.geom::geography) / 1000)::numeric, 1))
              from recurso_aereo r where r.situacao <> 'inativo' and r.tipo in ('heliponto','area_pouso')
              order by r.geom <-> s.geom limit 1),
    'agua', (select json_build_object('nome', p.nome, 'km', round((st_distance(p.geom::geography, s.geom::geography) / 1000)::numeric, 1))
              from uc_ponto p where p.nome_uc = s.nome_uc and p.tipo = 'agua' and p.geom is not null
              order by p.geom <-> s.geom limit 1),
    'ocorrencias', (select count(distinct o.cod_bdp) from roi o
                     where o.ano between 2013 and 2025
                       and ((o.geom is not null and st_intersects(o.geom, s.geom))
                            or exists (select 1 from area_queimada a where a.cod_bdp = o.cod_bdp and a.geom && s.geom and st_intersects(a.geom, s.geom)))),
    'queimado_ha', (select round((sum(st_area(st_intersection(a.geom, s.geom)::geography)) / 10000)::numeric, 1)
              from area_queimada a join roi o on o.cod_bdp = a.cod_bdp
             where a.geom && s.geom and st_intersects(a.geom, s.geom) and o.ano between 2013 and 2025),
    'zonas', (select string_agg(distinct z.zona, '; ') from uc_zoneamento z where z.nome_uc = s.nome_uc and st_intersects(z.geom, s.geom)
                and st_area(st_intersection(z.geom, s.geom)) > 0.05 * st_area(s.geom))
  ) order by s.ordem nulls last, s.nome), '[]'::json) end
  from uc_setor s where s.nome_uc = p_nome_uc;
$$;
revoke all on function setores_resumo(text) from public, anon;
grant execute on function setores_resumo(text) to authenticated;
