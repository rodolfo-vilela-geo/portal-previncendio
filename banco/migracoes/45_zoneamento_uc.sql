-- =====================================================================
--  45 · Zoneamento das UCs (plano de manejo) — camada de referência
--  Fonte inicial: IDE-Sisema (ide_2021_mg_zon*_uc_*_pol, dado público), 14 UCs.
--  Não é específico para incêndios: serve de consulta (Geo Colibri, RI, painel) e pode
--  ou não ser usado como base dos setores operacionais do plano operacional (módulo 7).
--  Leitura: usuários logados. Carga/edição: Previncêndio (função zoneamento_carregar).
-- =====================================================================
create table if not exists uc_zoneamento (
  id           bigserial primary key,
  nome_uc      text not null references uc(nome_uc) on update cascade on delete cascade,
  zona         text not null,                                   -- nome da zona como no plano de manejo (ex.: "Zona de Conservação")
  sigla        text,                                            -- só quando vem no arquivo de origem
  fonte        text not null default 'IDE-Sisema',
  arquivo      text,
  carregado_por text,
  carregado_em timestamptz not null default now(),
  geom         geometry(MultiPolygon, 4674) not null,
  area_ha      numeric(14,4) generated always as (round((st_area(geom::geography) / 10000)::numeric, 4)) stored
);
create index if not exists uc_zoneamento_geom_idx on uc_zoneamento using gist (geom);
create index if not exists uc_zoneamento_uc_idx on uc_zoneamento (nome_uc);
comment on table uc_zoneamento is 'Zoneamento do plano de manejo das UCs (referência; não é específico para incêndios).';

alter table uc_zoneamento enable row level security;
create policy zon_le on uc_zoneamento for select to authenticated using (is_usuario());
create policy zon_gpcif on uc_zoneamento for all to authenticated using (is_gpcif()) with check (is_gpcif());
grant select, insert, update, delete on uc_zoneamento to authenticated;
grant usage on sequence uc_zoneamento_id_seq to authenticated;
revoke all on uc_zoneamento from anon;

-- Carga (página de importação). p_substituir apaga antes o zoneamento da UC com a mesma fonte.
create or replace function zoneamento_carregar(p_nome_uc text, p_fonte text, p_itens jsonb, p_substituir boolean default false)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if not is_gpcif() then raise exception 'Só o Previncêndio carrega zoneamentos.'; end if;
  if not exists (select 1 from uc where nome_uc = p_nome_uc) then raise exception 'UC não encontrada: %', p_nome_uc; end if;
  if p_substituir then delete from uc_zoneamento where nome_uc = p_nome_uc and fonte = p_fonte; end if;
  insert into uc_zoneamento (nome_uc, zona, sigla, fonte, arquivo, carregado_por, geom)
  select p_nome_uc, f ->> 'zona', nullif(f ->> 'sigla', ''), p_fonte, f ->> 'arquivo', auth.jwt() ->> 'email',
         st_multi(st_collectionextract(st_makevalid(st_setsrid(st_force2d(st_geomfromgeojson(f -> 'geom')), 4674)), 3))
  from jsonb_array_elements(p_itens) f;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function zoneamento_carregar(text, text, jsonb, boolean) from public, anon;
grant execute on function zoneamento_carregar(text, text, jsonb, boolean) to authenticated;

-- Geo Colibri
create or replace function geo_zoneamento(p_tol float8 default 0.00003)
returns json language sql stable security definer set search_path = public, extensions as $$
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
           'nome_uc', z.nome_uc, 'zona', z.zona, 'sigla', z.sigla, 'fonte', z.fonte, 'area_ha', z.area_ha,
           'geom', st_asgeojson(st_simplifypreservetopology(z.geom, p_tol), 6, 0)::json) order by z.nome_uc, z.zona), '[]'::json) end
  from uc_zoneamento z;
$$;
revoke all on function geo_zoneamento(float8) from public, anon;
grant execute on function geo_zoneamento(float8) to authenticated;

-- Zona em que cai um ponto (RI, fichas)
create or replace function zona_no_ponto(p_lat float8, p_lon float8)
returns table (nome_uc text, zona text, sigla text, fonte text)
language sql stable security definer set search_path = public, extensions as $$
  select z.nome_uc, z.zona, z.sigla, z.fonte from uc_zoneamento z
   where is_usuario() and st_intersects(z.geom, st_setsrid(st_makepoint(p_lon, p_lat), 4674))
   order by z.nome_uc, z.zona;
$$;
revoke all on function zona_no_ponto(float8, float8) from public, anon;
grant execute on function zona_no_ponto(float8, float8) to authenticated;
