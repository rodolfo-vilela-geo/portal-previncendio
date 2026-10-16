-- 53 — imovel_avisos_uc mais rápido: em UCs com muitos imóveis (Serra do Papagaio: 7.180) a versão da migração 52
-- levava ~8,6 s e estourava o limite de 8 s do PostgREST. Agora a área de cada UC é calculada uma vez só, e só para as
-- UCs na região dos imóveis; o filtro por área do imóvel vem antes da interseção.
create or replace function imovel_avisos_uc(p_uc text)
returns table (id bigint, uc_coincide text)
language sql stable security definer set search_path = public as $$
  with cx as (select st_setsrid(st_extent(geom)::geometry, 4674) b from imovel where p_uc = any(ucs) and origem = 'car'),
  u as (select l.nome_uc, st_union(l.geom) geom, sum(st_area(l.geom::geography)) / 1e4 ha
        from uc_limite l, cx where l.tipo = 'uc' and l.geom && cx.b group by l.nome_uc)
  select i.id, string_agg(u.nome_uc, ', ' order by u.nome_uc)
  from imovel i join u on i.geom && u.geom and i.area_ha between u.ha * 0.6 and u.ha * 1.6
  where is_tecnica() and p_uc = any(i.ucs) and i.origem = 'car'
    and st_area(st_intersection(u.geom, i.geom)::geography) / 1e4 >= 0.8 * u.ha
    and st_area(st_intersection(u.geom, i.geom)::geography) / 1e4 >= 0.8 * i.area_ha
  group by i.id
$$;
