-- =====================================================================
--  COLIBRI — REGISTROS DE EXECUÇÃO DAS AÇÕES PREVENTIVAS (módulo 5, seção 12)
--  Cada ação do cronograma pode ter vários registros (data, local, público,
--  relato e até 3 fotos). O primeiro registro marca a ação como realizada;
--  "não realizada" exige motivo. Ações vencidas sem registro ficam pendentes.
--  Fotos: bucket privado acoes-fotos, pasta = id da ação; só usuários logados veem.
-- =====================================================================

alter table uc_acao_preventiva add column if not exists motivo text;   -- por que não foi realizada / foi adiada
alter table uc_acao_preventiva drop constraint if exists uc_acao_motivo_ok;
alter table uc_acao_preventiva add constraint uc_acao_motivo_ok check (situacao <> 'nao_realizada' or nullif(trim(motivo), '') is not null);

create table if not exists uc_acao_execucao (
  id             bigint generated always as identity primary key,
  acao_id        bigint not null references uc_acao_preventiva(id) on delete cascade,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  data           date not null,
  local          text,
  participantes  int check (participantes >= 0),
  relato         text,
  lat            numeric(10,6),
  lon            numeric(10,6),
  geom           geometry(Point, 4674) generated always as
                 (case when lat is not null and lon is not null then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,
  fotos          jsonb not null default '[]' check (jsonb_typeof(fotos) = 'array' and jsonb_array_length(fotos) <= 3),
  atualizado_por text,
  atualizado_em  timestamptz not null default now(),
  check (coord_mg_ok(lat, lon))
);
create index if not exists uc_acao_execucao_acao_idx on uc_acao_execucao (acao_id);
create index if not exists uc_acao_execucao_uc_idx on uc_acao_execucao (nome_uc, data);

-- a UC do registro é sempre a da ação
create or replace function tg_execucao_uc() returns trigger
language plpgsql set search_path = public as $$
begin
  select nome_uc into new.nome_uc from uc_acao_preventiva where id = new.acao_id;
  return new;
end $$;
drop trigger if exists a_uc on uc_acao_execucao;
create trigger a_uc before insert or update of acao_id, nome_uc on uc_acao_execucao for each row execute function tg_execucao_uc();

-- situação da ação acompanha os registros
create or replace function tg_execucao_situacao() returns trigger
language plpgsql set search_path = public as $$
declare v_id bigint := coalesce(new.acao_id, old.acao_id); n int;
begin
  select count(*) into n from uc_acao_execucao where acao_id = v_id;
  if n > 0 then
    update uc_acao_preventiva set situacao = 'realizada' where id = v_id and situacao <> 'realizada';
  else
    update uc_acao_preventiva set situacao = 'planejada' where id = v_id and situacao = 'realizada';
  end if;
  return null;
end $$;
drop trigger if exists z_situacao on uc_acao_execucao;
create trigger z_situacao after insert or delete on uc_acao_execucao for each row execute function tg_execucao_situacao();

alter table uc_acao_execucao enable row level security;
drop policy if exists usuario_le on uc_acao_execucao;
drop policy if exists edita on uc_acao_execucao;
create policy usuario_le on uc_acao_execucao for select to authenticated using (is_usuario());
create policy edita on uc_acao_execucao for all to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc));
grant select, insert, update, delete on uc_acao_execucao to authenticated;
revoke all on uc_acao_execucao from anon;
drop trigger if exists auditoria on uc_acao_execucao;
create trigger auditoria before insert or update or delete on uc_acao_execucao for each row execute function tg_auditoria('nome_uc');

drop policy if exists usuario_le_auditoria on auditoria;
create policy usuario_le_auditoria on auditoria for select to authenticated
  using ((tabela in ('uc_cadastro','regional','uc_infra','uc_ponto','uc_veiculo','uc_radio','uc_material',
                     'uc_parceiro','uc_prestador','uc_colaborador',
                     'uc_via','uc_elemento','uc_acao_preventiva','uc_acao_execucao','uc_projeto','uc_brigada') and is_usuario())
         or (tabela = 'tramite' and is_tecnica()) or is_admin());

-- pendente: período encerrado (mês final já passou) e nenhum registro
create or replace function acao_pendente(a uc_acao_preventiva) returns boolean
language sql stable set search_path = public as $$
  select a.situacao in ('planejada','em_andamento') and a.mes_ini is not null
     and not exists (select 1 from uc_acao_execucao e where e.acao_id = a.id)
     and make_date(a.ano + case when coalesce(a.mes_fim, a.mes_ini) < a.mes_ini then 1 else 0 end, coalesce(a.mes_fim, a.mes_ini), 1)
         + interval '1 month' <= date_trunc('month', current_date)
$$;

-- resumo do módulo para o Painel da UC (com execução)
create or replace function uc_prevencao_resumo(p_nome_uc text) returns jsonb
language sql stable security invoker set search_path = public as $$
  with ano as (select max(ano) a from uc_acao_preventiva where nome_uc = p_nome_uc),
       ac as (select x.* from uc_acao_preventiva x, ano where x.nome_uc = p_nome_uc and x.ano = ano.a)
  select jsonb_build_object(
    'vias', (select coalesce(jsonb_object_agg(tipo, jsonb_build_object('n', n, 'km', km, 'tracados', tracados, 'ruins', ruins)), '{}') from (
               select tipo, count(*) n,
                      round(sum(case when tracado_origem in ('desenho','arquivo') then compr_mapa_m else coalesce(comprimento_m, compr_mapa_m) end) / 1000, 1) km,
                      count(*) filter (where tracado_origem in ('desenho','arquivo')) tracados, count(*) filter (where condicao in ('ruim','inexistente')) ruins
                 from uc_via where nome_uc = p_nome_uc group by tipo) v),
    'favoraveis', (select count(*) from uc_elemento where nome_uc = p_nome_uc and tipo = 'favoravel'),
    'adversos',   (select count(*) from uc_elemento where nome_uc = p_nome_uc and tipo = 'adverso'),
    'acoes_ano',  (select a from ano),
    'acoes',      (select count(*) from ac),
    'acoes_feitas', (select count(*) from ac where situacao = 'realizada'),
    'acoes_pendentes', (select count(*) from ac where acao_pendente(ac::uc_acao_preventiva)),
    'registros',  (select count(*) from uc_acao_execucao e join ac on ac.id = e.acao_id),
    'participantes', (select coalesce(sum(e.participantes), 0) from uc_acao_execucao e join ac on ac.id = e.acao_id),
    'projetos',   (select count(*) from uc_projeto where nome_uc = p_nome_uc),
    'brigada',    (select jsonb_build_object('ano', ano, 'quantidade', sum(quantidade)) from uc_brigada where nome_uc = p_nome_uc
                    and ano = (select max(ano) from uc_brigada where nome_uc = p_nome_uc) group by ano))
$$;
grant execute on function uc_prevencao_resumo(text) to authenticated;
revoke all on function uc_prevencao_resumo(text) from anon, public;

-- quem pode enviar/apagar fotos: quem edita a UC da ação (pasta = id da ação)
create or replace function pode_editar_acao_foto(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when split_part(p_name, '/', 1) ~ '^\d{1,15}$'
              then exists (select 1 from uc_acao_preventiva a where a.id = split_part(p_name, '/', 1)::bigint and pode_editar_uc(a.nome_uc))
              else false end
$$;
revoke all on function pode_editar_acao_foto(text) from public, anon;
grant execute on function pode_editar_acao_foto(text) to authenticated;

-- ===== STORAGE (só no Supabase) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('acoes-fotos', 'acoes-fotos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];
drop policy if exists acoes_fotos_le on storage.objects;
drop policy if exists acoes_fotos_insere on storage.objects;
drop policy if exists acoes_fotos_apaga on storage.objects;
create policy acoes_fotos_le on storage.objects for select to authenticated using (bucket_id = 'acoes-fotos' and public.is_usuario());
create policy acoes_fotos_insere on storage.objects for insert to authenticated with check (bucket_id = 'acoes-fotos' and public.pode_editar_acao_foto(name));
create policy acoes_fotos_apaga on storage.objects for delete to authenticated using (bucket_id = 'acoes-fotos' and public.pode_editar_acao_foto(name));
