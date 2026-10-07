-- =====================================================================
--  35 · Geo Colibri: camada do Inventário Florestal (veg_inventario)
--  Só o que está na tela, recortado pela janela e simplificado conforme o zoom
--  (o mapa só pede a partir do zoom 11). Só usuários logados.
-- =====================================================================
create or replace function geo_vegetacao(x0 float8, y0 float8, x1 float8, y1 float8, p_tol float8 default 0, p_lim int default 6000)
returns json language sql stable security definer set search_path = public, extensions as $$
  with caixa as (select st_makeenvelope(x0, y0, x1, y1, 4674) b),
  v as (select v.id, v.class_id, v.geom from veg_inventario v, caixa where v.geom && caixa.b limit p_lim)
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
           'id', v.id, 'c', v.class_id, 'ha', round((st_area(v.geom::geography) / 1e4)::numeric, 1),
           'g', st_asgeojson(case when p_tol > 0 then st_simplifypreservetopology(st_clipbybox2d(v.geom, caixa.b), p_tol) else st_clipbybox2d(v.geom, caixa.b) end, 5, 0)::json)), '[]'::json) end
  from v, caixa;
$$;
revoke all on function geo_vegetacao(float8, float8, float8, float8, float8, int) from public, anon;
grant execute on function geo_vegetacao(float8, float8, float8, float8, float8, int) to authenticated;
