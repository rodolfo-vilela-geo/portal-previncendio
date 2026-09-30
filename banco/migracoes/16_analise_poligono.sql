-- =====================================================================
--  PORTAL PREVINCÊNDIO — CRUZAMENTO ESPACIAL DO POLÍGONO DO ROI
--  Para KML coletado em campo (sem os atributos do SMC): a partir do
--  polígono, calcula área total, área dentro da UC (interna) e fora
--  (entorno), municípios atingidos, UC mais provável, zona de
--  amortecimento e ponto central. Só usa camadas públicas.
--  Municípios: IBGE (tabela municipio, carregada de dados/municipios_mg.geojson).
-- =====================================================================
create or replace function analisar_poligono(p_geojson jsonb, p_nome_uc text default null)
returns json language plpgsql stable security definer set search_path = public, extensions as $$
declare
  g geometry; uc_alvo text; lim geometry; tot numeric; dentro numeric; res json;
begin
  if p_geojson is null or length(p_geojson::text) > 5000000 then raise exception 'Polígono ausente ou grande demais.'; end if;
  g := st_setsrid(st_geomfromgeojson(p_geojson::text), 4674);
  g := st_collectionextract(st_makevalid(g), 3);                     -- só a parte poligonal
  if g is null or st_isempty(g) then raise exception 'O arquivo não contém polígono.'; end if;
  if st_npoints(g) > 200000 then raise exception 'Polígono com vértices demais (%).', st_npoints(g); end if;
  if not st_within(st_envelope(g), st_makeenvelope(-51.5, -23.5, -39.5, -14, 4674)) then raise exception 'Polígono fora de Minas Gerais.'; end if;
  tot := (st_area(g::geography) / 10000)::numeric;
  if tot > 500000 then raise exception 'Área de % ha — confira o arquivo.', round(tot); end if;

  -- UC: a informada, ou a de maior sobreposição, ou a mais próxima
  uc_alvo := p_nome_uc;
  if uc_alvo is null or not exists (select 1 from uc_limite where nome_uc = uc_alvo and tipo = 'uc') then
    select l.nome_uc into uc_alvo from uc_limite l
     where l.tipo = 'uc' and l.geom && st_expand(g, 0.1)
     order by st_area(st_intersection(l.geom, g)::geography) desc, st_distance(l.geom::geography, g::geography) limit 1;
  end if;
  select st_union(geom) into lim from uc_limite where nome_uc = uc_alvo and tipo = 'uc';
  dentro := case when lim is null then null else coalesce((st_area(st_intersection(g, lim)::geography) / 10000)::numeric, 0) end;

  select json_build_object(
    'area_ha', round(tot, 4),
    'uc', uc_alvo,
    'uc_informada', p_nome_uc,
    'area_int', case when dentro is null then null else round(dentro, 4) end,
    'area_ent', case when dentro is null then null else round(greatest(tot - dentro, 0), 4) end,
    'local', case when dentro is null then null when dentro >= tot * 0.999 then 'Interno' when dentro <= tot * 0.001 then 'Entorno' else 'Interno/Entorno' end,
    'distancia_km', case when lim is not null and dentro <= tot * 0.001 then round((st_distance(lim::geography, g::geography) / 1000)::numeric, 2) end,
    'na_za_pm', exists (select 1 from uc_limite z where z.nome_uc = uc_alvo and z.tipo = 'za_pm' and st_intersects(z.geom, g)),
    'na_za_3km', exists (select 1 from uc_limite z where z.nome_uc = uc_alvo and z.tipo = 'za_3km' and st_intersects(z.geom, g)),
    'outras_ucs', (select json_agg(json_build_object('nome_uc', x.nome_uc, 'area_ha', round(x.ha, 2)) order by x.ha desc) from (
                     select l.nome_uc, (st_area(st_intersection(l.geom, g)::geography) / 10000)::numeric as ha
                     from uc_limite l where l.tipo = 'uc' and l.nome_uc is distinct from uc_alvo and st_intersects(l.geom, g)) x where x.ha > 0.01),
    'municipios', (select json_agg(json_build_object('nome', m.nome, 'area_ha', round(m.ha, 2)) order by m.ha desc) from (
                     select nome, (st_area(st_intersection(geom, g)::geography) / 10000)::numeric as ha
                     from municipio where st_intersects(geom, g)) m where m.ha > 0.001),
    'centro', (select json_build_object('lat', round(st_y(p)::numeric, 6), 'lon', round(st_x(p)::numeric, 6)) from st_pointonsurface(g) p),
    'n_poligonos', st_numgeometries(g)
  ) into res;
  return res;
end $$;
revoke all on function analisar_poligono(jsonb, text) from public;
grant execute on function analisar_poligono(jsonb, text) to anon, authenticated;
