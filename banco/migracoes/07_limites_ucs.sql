-- =====================================================================
--  PORTAL PREVINCÊNDIO — LIMITES DAS UCs E ZONAS DE AMORTECIMENTO
--  Rodar no SQL Editor DEPOIS do 01 a 06.
--  Em seguida rodar os arquivos de dados 07a, 07b, 07c e 07d (um por vez).
--
--  Fonte: IDE-Sisema — ide_2010_mg_unidades_conservacao_estaduais_pol,
--         ide_2011_mg_amortecimento_uc_plano_manejo_pol,
--         ide_2011_mg_amortecimento_uc_raio_3km_pol (SIRGAS 2000).
--  tipo: 'uc' = limite da UC · 'za_pm' = ZA do plano de manejo · 'za_3km' = raio de 3 km
--  Limites de UC são informação pública: leitura aberta (como as listas).
-- =====================================================================
create table uc_limite (
  id            bigint generated always as identity primary key,
  nome_uc       text not null,                 -- nome do cadastro (tabela uc / BDG)
  tipo          text not null check (tipo in ('uc','za_pm','za_3km')),
  nome_original text,                          -- nome como está na camada da IDE
  geom          geometry(MultiPolygon, 4674) not null
);
create index uc_limite_geom_idx on uc_limite using gist (geom);
create index uc_limite_nome_idx on uc_limite (nome_uc, tipo);
comment on table uc_limite is 'Limites oficiais das UCs estaduais e zonas de amortecimento (IDE-Sisema).';

alter table uc_limite enable row level security;
create policy uc_limite_leitura on uc_limite for select to anon, authenticated using (true);
create policy equipe_uc_limite  on uc_limite for all to authenticated using (true) with check (true);

-- UCs da camada oficial que ainda não tinham ocorrência no histórico
insert into uc (nome_uc, categoria, grupo, bioma_uc, ufbio, base_op, municipios) values
  ('Serra do Cipó', 'PAR', 'Proteção Integral', 'Cerrado', 'Centro Norte', null, array['Jaboticatubas','Itabira','Itambe do Mato Dentro','Santana do Riacho']::text[]),
  ('Pico do Itabirito', 'MONA', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', null, array['Itabirito']::text[]),
  ('Cerca Grande', 'PAR', 'Proteção Integral', 'Cerrado', 'Centro Norte', null, array['Matozinhos']::text[]),
  ('Serra do Gambá', 'MONA', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', null, array['Jeceaba']::text[]),
  ('Lapa Vermelha', 'MONA', 'Proteção Integral', 'Cerrado', 'Centro Norte', null, array['Pedro Leopoldo']::text[]),
  ('Experiência da Jaguara', 'MONA', 'Proteção Integral', 'Cerrado', 'Centro Norte', null, array['Matozinhos']::text[]),
  ('Santo Antônio', 'MONA', 'Proteção Integral', 'Cerrado', 'Centro Norte', null, array['Matozinhos']::text[]),
  ('São Judas Tadeu', 'FLOE', 'Uso Sustentável', 'Cerrado', 'Metropolitano', null, array['Betim']::text[]),
  ('Bacia Hidrográfica do Rio Uberaba', 'APA', 'Uso Sustentável', 'Cerrado', 'Triângulo', null, array['Uberaba','Uberlandia']::text[]),
  ('Mar de Espanha', 'ESEC', 'Proteção Integral', 'Mata Atlântica', 'Mata', null, array['Mar de Espanha']::text[])
on conflict (nome_uc) do nothing;

-- Mapa do ROI: limites que cruzam a área do mapa, recortados e simplificados.
--   p_nome = UC do ROI (recebe também as zonas de amortecimento);
--   demais UCs que aparecem no recorte vêm só com o limite.
create or replace function uc_mapa(p_nome text, x0 float8, y0 float8, x1 float8, y1 float8)
returns json language sql stable set search_path = public, extensions as $$
  with caixa as (
    select st_expand(st_makeenvelope(x0, y0, x1, y1, 4674), greatest(x1 - x0, y1 - y0) * 0.6) as g,
           greatest(x1 - x0, y1 - y0) / 2500 as tol
  ),
  borda_uc as (   -- limite da UC do ROI (±20 m): trecho da ZA que coincide com ele não é desenhado
    select st_buffer(st_boundary(st_union(geom)), 0.0002) as g
    from uc_limite where nome_uc = p_nome and tipo = 'uc'
  )
  select coalesce(json_agg(json_build_object(
           'nome', l.nome_uc, 'tipo', l.tipo, 'sel', l.nome_uc = p_nome,
           'geom', st_asgeojson(st_simplifypreservetopology(
                     case when l.tipo = 'uc' then st_intersection(l.geom, c.g)
                          else st_difference(st_intersection(st_boundary(l.geom), c.g),      -- ZA: só o contorno
                                             coalesce((select g from borda_uc), st_geomfromtext('POLYGON EMPTY', 4674)))
                     end, c.tol), 6)::json)
         order by l.tipo desc), '[]'::json)
  from uc_limite l, caixa c
  where l.geom && c.g and st_intersects(l.geom, c.g)
    and (l.tipo = 'uc' or l.nome_uc = p_nome);
$$;
grant execute on function uc_mapa(text, float8, float8, float8, float8) to anon, authenticated;
