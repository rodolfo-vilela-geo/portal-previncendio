-- =====================================================================
--  LIMITES MUNICIPAIS DE MG (IBGE, simplificados ~20 m) — usados no
--  cruzamento espacial do polígono do ROI (16_analise_poligono.sql).
--  Os dados estão em dados/municipios_mg.geojson; a carga está em
--  banco/carga/carregar_municipios.sql.
-- =====================================================================
create table if not exists municipio (
  cod_ibge text primary key,
  nome     text not null,
  geom     geometry(MultiPolygon, 4674) not null
);
create index if not exists municipio_geom_idx on municipio using gist (geom);
comment on table municipio is 'Limites municipais de MG (IBGE, simplificados ~20 m) para cruzamento espacial do ROI.';
alter table municipio enable row level security;
create policy municipio_leitura on municipio for select to anon, authenticated using (true);
