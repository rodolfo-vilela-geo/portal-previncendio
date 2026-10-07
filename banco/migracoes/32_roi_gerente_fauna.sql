-- =====================================================================
--  32 · ROI: gerente vindo sempre do cadastro da UC e fauna estruturada
--  · gerentes_uc(): nome do gerente de cada UC (módulo 1 – Cadastro; na falta, a tabela uc).
--    Só o nome, para o formulário (aberto) do ROI preencher e travar o campo.
--  · roi.fn_condicao: condição de cada animal (Morto/Ferido), no mesmo padrão "1-..., 2-..." de fn_nome/fn_qnt.
--  · roi_fauna: a fauna do ROI linha a linha (espécie, quantidade, condição, coordenada em graus decimais).
-- =====================================================================
create or replace function gerentes_uc() returns table (nome_uc text, gerente text)
language sql stable security definer set search_path = public as $$
  select u.nome_uc, coalesce(nullif(trim(c.gerente_nome), ''), nullif(trim(u.gerente), ''))
  from uc u left join uc_cadastro c on c.nome_uc = u.nome_uc
  where u.ativo;
$$;
revoke all on function gerentes_uc() from public;
grant execute on function gerentes_uc() to anon, authenticated;

alter table roi add column if not exists fn_condicao text;
comment on column roi.fn_condicao is 'Condição de cada animal da fauna atingida (Morto/Ferido), no padrão 1-..., 2-... de fn_nome.';

create table if not exists roi_fauna (
  id        bigint generated always as identity primary key,
  cod_bdp   text not null references roi(cod_bdp) on update cascade on delete cascade,
  ordem     int  not null default 1,
  especie   text not null,
  qtd       int  check (qtd is null or qtd > 0),
  condicao  text check (condicao in ('Morto', 'Ferido')),
  lat       numeric(9,6) check (lat is null or lat between -23.5 and -14),
  lon       numeric(9,6) check (lon is null or lon between -51.5 and -39.5),
  criado_em timestamptz not null default now()
);
create index if not exists roi_fauna_cod_idx on roi_fauna (cod_bdp);
alter table roi_fauna enable row level security;
create policy roi_fauna_insere_publico on roi_fauna for insert to anon with check (true);
create policy roi_fauna_le on roi_fauna for select to authenticated using (is_usuario());
create policy roi_fauna_equipe on roi_fauna for all to authenticated using (is_equipe()) with check (is_equipe());
grant insert on roi_fauna to anon;
grant select, insert, update, delete on roi_fauna to authenticated;
create policy roi_fauna_insere_logado on roi_fauna for insert to authenticated with check (true);

-- Envio do ROI por quem está LOGADO (gerentes não são "equipe"): as mesmas regras do envio aberto.
-- Antes, um gerente logado que abrisse o formulário teria o envio recusado.
create policy roi_insere_logado on roi for insert to authenticated
  with check (status = 'enviado' and cod_bdp ~ '^\d{4}-\d{4}-\d{3}$' and dat_detec is not null
              and (dat_comb is null or dat_comb >= dat_detec) and (dat_final is null or dat_final >= coalesce(dat_comb, dat_detec)));
create policy evolucao_insere_logado on roi_evolucao for insert to authenticated with check (true);
create policy foto_insere_logado on roi_foto for insert to authenticated with check (true);
create policy area_insere_logado on area_queimada for insert to authenticated
  with check (fonte in ('SMC', 'campo') and roi_recente(cod_bdp));
create policy roi_empenho_insere_logado on roi_empenho for insert to authenticated with check (true);
alter policy roi_empenho_equipe on roi_empenho using (is_equipe()) with check (is_equipe());   -- antes: qualquer logado editava
create policy roi_empenho_le on roi_empenho for select to authenticated using (is_usuario());
create policy fotos_envio_logado on storage.objects for insert to authenticated with check (bucket_id = 'roi-fotos');
