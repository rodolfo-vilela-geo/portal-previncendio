-- Carrega dados/municipios_mg.geojson na tabela municipio.
-- Opção A (Supabase ou servidor com acesso à internet): baixa o arquivo do GitHub pela extensão http.
create extension if not exists http with schema extensions;
with r as (select content::jsonb as j from extensions.http_get('https://raw.githubusercontent.com/rodolfo-vilela-geo/portal-previncendio/main/dados/municipios_mg.geojson')),
f as (select jsonb_array_elements(j->'features') as ft from r)
insert into municipio (cod_ibge, nome, geom)
select ft->'properties'->>'cod', ft->'properties'->>'nome',
       st_multi(st_collectionextract(st_makevalid(st_setsrid(st_geomfromgeojson((ft->'geometry')::text), 4674)), 3))
from f on conflict (cod_ibge) do nothing;
drop extension if exists http;
-- Opção B (servidor sem internet, como superusuário): copie o arquivo para o servidor e troque a primeira
-- consulta por:  select pg_read_file('/caminho/municipios_mg.geojson')::jsonb as j
