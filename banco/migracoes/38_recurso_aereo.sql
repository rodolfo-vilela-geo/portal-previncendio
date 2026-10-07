-- =====================================================================
--  38 · Cadastro único de pontos de apoio aéreo (pistas, aeródromos, helipontos)
--  Cada lugar existe uma vez; as UCs se ligam a ele (uc_ponto.recurso_id) em vez de
--  cada PIPCIF repetir o ponto. Base: aeródromos registrados (IDE-Sisema/ANAC, dado público);
--  o que não está lá (pistas de terra, de fazenda, helipontos, áreas de pouso eventuais)
--  entra com fonte "pipcif" ou "campo". Atributos operacionais (água, AT-802 etc.) são nossos.
--  A carga dos dados fica fora do repositório (nomes vindos dos PIPCIFs).
-- =====================================================================
create table if not exists recurso_aereo (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('aerodromo_publico','aerodromo_privado','aerodromo_militar','pista_nao_registrada','heliponto','area_pouso')),
  nome          text not null,
  apelidos      text[] not null default '{}',
  icao          text,                 -- indicador de localidade (ex.: SBBH)
  ciad          text,                 -- código ANAC no cadastro de aeródromos
  municipio     text,
  lat           numeric(9,6) not null check (lat between -23.5 and -14),
  lon           numeric(9,6) not null check (lon between -51.5 and -39.5),
  geom          geometry(Point, 4674) generated always as (st_setsrid(st_makepoint(lon::float8, lat::float8), 4674)) stored,
  elevacao_m    numeric(7,1),
  operacao      text,                 -- VFR, VFR diurna, IFR… (IDE)
  -- atributos operacionais (Previncêndio / PIPCIF / campo)
  superficie    text check (superficie in ('asfalto','concreto','terra','cascalho','grama','outro')),
  comprimento_m int,
  largura_m     int,
  conservacao   text check (conservacao in ('boa','regular','ruim')),
  recebe_at802  text check (recebe_at802 in ('sim','nao','com_restricao','nao_avaliado')) default 'nao_avaliado',
  agua          text,                 -- fonte de água para reabastecer (reservatório, caminhão-pipa, hidrante…)
  combustivel   text,                 -- QAV, AvGas, nenhum…
  noturno       boolean,
  situacao      text not null default 'ativo' check (situacao in ('ativo','inativo','a_conferir')),
  fonte         text not null check (fonte in ('ide','pipcif','campo')),
  ide_id        text unique,          -- id do registro no IDE-Sisema
  atributos     jsonb not null default '{}',
  obs           text,
  atualizado_por text, atualizado_em timestamptz not null default now()
);
create index if not exists recurso_aereo_geom_idx on recurso_aereo using gist (geom);
alter table recurso_aereo enable row level security;
create policy recurso_aereo_le on recurso_aereo for select to authenticated using (is_usuario());
create policy recurso_aereo_gpcif on recurso_aereo for all to authenticated using (is_gpcif()) with check (is_gpcif());
grant select, insert, update, delete on recurso_aereo to authenticated;
create trigger zz_auditoria before insert or update or delete on recurso_aereo for each row execute function tg_auditoria('id');

-- ligação: o ponto do PIPCIF (pista/heliponto da UC) aponta para o cadastro único
alter table uc_ponto add column if not exists recurso_id bigint references recurso_aereo(id) on delete set null;
create index if not exists uc_ponto_recurso_idx on uc_ponto (recurso_id);

-- pontos de apoio aéreo perto de uma UC (para o módulo 2 e o Geo Colibri), com a distância ao limite
create or replace function recursos_aereos_perto(p_nome_uc text, p_km numeric default 60) returns json
language sql stable security definer set search_path = public, extensions as $$
  with u as (select st_union(geom) g from uc_limite where nome_uc = p_nome_uc and tipo = 'uc')
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
           'id', r.id, 'tipo', r.tipo, 'nome', r.nome, 'icao', r.icao, 'municipio', r.municipio, 'lat', r.lat, 'lon', r.lon,
           'superficie', r.superficie, 'comprimento_m', r.comprimento_m, 'recebe_at802', r.recebe_at802, 'agua', r.agua,
           'km', round((st_distance(r.geom::geography, u.g::geography) / 1000)::numeric, 1),
           'usado', exists (select 1 from uc_ponto p where p.recurso_id = r.id and p.nome_uc = p_nome_uc))
         order by st_distance(r.geom::geography, u.g::geography)), '[]'::json) end
  from recurso_aereo r, u
  where r.situacao <> 'inativo' and st_dwithin(r.geom::geography, u.g::geography, p_km * 1000);
$$;
revoke all on function recursos_aereos_perto(text, numeric) from public, anon;
grant execute on function recursos_aereos_perto(text, numeric) to authenticated;
