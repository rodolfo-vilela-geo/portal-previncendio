-- =====================================================================
--  COLIBRI — MAPA DE RISCO (módulo 6, protótipo)
--  Uma camada por UC, gerada fora do banco (grade de células ~6 ha,
--  modelo calibrado no BDG 2013–2022 e conferido em 2023–2025, variáveis
--  do GEE) e importada pelo Previncêndio. As células vão compactadas em
--  "dados" (o navegador refaz os hexágonos a partir do id da célula).
--  Leitura: usuários logados. Gravação: Previncêndio / administrador.
-- =====================================================================

create table if not exists uc_risco (
  nome_uc        text primary key references uc(nome_uc) on update cascade on delete cascade,
  versao         text not null,
  metodo         jsonb not null default '{}',
  dados          jsonb not null,
  atualizado_por text default (auth.jwt() ->> 'email'),
  atualizado_em  timestamptz not null default now()
);
comment on table uc_risco is 'Mapa de risco por UC (células compactadas em dados; método e conferência em metodo).';

alter table uc_risco enable row level security;
create policy uc_risco_le on uc_risco for select to authenticated using (is_usuario());
create policy uc_risco_grava on uc_risco for all to authenticated using (is_gpcif()) with check (is_gpcif());
grant select, insert, update, delete on uc_risco to authenticated;
revoke all on uc_risco from anon;
