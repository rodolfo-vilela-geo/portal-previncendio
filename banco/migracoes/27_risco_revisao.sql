-- =====================================================================
--  COLIBRI — MAPA DE RISCO: conferência do gerente (módulo 6, protótipo)
--  Uma revisão por UC e versão do mapa: parecer (concordo / concordo com
--  ressalvas / discordo), nota e marcações no mapa do que só a UC sabe.
--  Leitura: usuários logados. Gravação: quem edita a UC (gerente/Previncêndio).
-- =====================================================================
create table if not exists uc_risco_revisao (
  id            bigserial primary key,
  nome_uc       text not null references uc(nome_uc) on update cascade on delete cascade,
  versao        text not null,
  parecer       text check (parecer in ('concordo','ressalvas','discordo')),
  nota          text,
  marcacoes     jsonb not null default '[]',
  autor         text default (auth.jwt() ->> 'email'),
  atualizado_em timestamptz not null default now(),
  unique (nome_uc, versao)
);
comment on table uc_risco_revisao is 'Conferência do mapa de risco pela UC: parecer, nota e marcações [{lat,lon,tipo,nota}] por versão.';
alter table uc_risco_revisao enable row level security;
create policy uc_risco_revisao_le on uc_risco_revisao for select to authenticated using (is_usuario());
create policy uc_risco_revisao_ins on uc_risco_revisao for insert to authenticated with check (pode_editar_uc(nome_uc));
create policy uc_risco_revisao_upd on uc_risco_revisao for update to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc));
grant select, insert, update on uc_risco_revisao to authenticated;
grant usage on sequence uc_risco_revisao_id_seq to authenticated;
revoke all on uc_risco_revisao from anon;
