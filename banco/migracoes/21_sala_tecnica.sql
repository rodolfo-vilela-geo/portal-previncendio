-- =====================================================================
--  COLIBRI — SALA TÉCNICA (Manual da Sala Técnica 2026, v1)
--  Controle de cada ocorrência depois do fogo: recebimento e análise do ROI,
--  REDS/AI da PM Ambiental, processo administrativo (SEI), encaminhamento à
--  Polícia Civil (DPC), à SEMAD (CAINF/NAI) e à chefia da PCMG (prioritários).
--  Uma linha por ROI, identificada pelo cod_bdp (ANO-RI-ROI), como no BDG.
--  Prazos (manual): ROI em 10 dias corridos após a extinção; cobrança com 3 dias
--  úteis; REDS: cobrança a partir de 4 dias do acionamento, atraso após 10 dias.
--  Acesso: perfil 'tecnica' (Sala Técnica), Previncêndio e admin. Dados policiais
--  (REDS, AI, inquérito) não são públicos.
-- =====================================================================

alter table equipe drop constraint if exists equipe_papel_check;
alter table equipe add constraint equipe_papel_check check (papel in ('sala','tecnica','gpcif','admin','gerente'));

create or replace function is_tecnica() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipe where email = lower(coalesce(auth.jwt() ->> 'email', '')) and ativo and papel in ('tecnica','gpcif','admin'));
$$;
revoke all on function is_tecnica() from public, anon;
grant execute on function is_tecnica() to authenticated;

create table if not exists tramite (
  cod_bdp            text primary key,                 -- AAAA-RRRR-NNN
  ano                int  not null,
  ri                 text not null,
  roi_n              int,
  sala_tecnica       text check (sala_tecnica in ('Curvelo','Januária')),
  -- ROI
  roi_recebido_email date,
  roi_recebido_sei   date,
  roi_original       date,                             -- via impressa/assinada recebida
  poligono_recebido  date,
  roi_analise        text check (roi_analise in ('em_analise','devolvido','aceito')),
  roi_pendencias     text,
  roi_devolvido_em   date,
  roi_cobranca1      date,
  roi_cobranca2      date,
  roi_escalado       date,                             -- comunicado à coordenação / GEUC
  -- PM Ambiental / Bombeiros
  pm_municipio       text,
  pm_contato         text,
  pm_acionamento     date,
  reds_cobranca      date,
  reds_recebido      date,
  reds_num           text,
  reds_bm            text,                             -- REDS do Corpo de Bombeiros, se houver
  reds_devolvido     date,                             -- devolvido à PMAmb (infrator identificado sem AI)
  ai_num             text,                             -- Auto de Infração
  ai_recebido        date,
  -- processo e encaminhamentos
  prioritario        boolean not null default false,
  prioritario_num    text,                             -- PRIORITÁRIO Nº XX/20XX
  processo_sei       text,
  processo_fisico    boolean not null default false,   -- até 2017
  processo_aberto    date,
  oficio_num         text,
  oficio_data        date,
  dpc                text,                             -- jurisdição da Polícia Civil
  envio_dpc          date,
  memorando_cainf    text,
  envio_cainf        date,                             -- SEMAD / CAINF (NAI)
  envio_chefia_pc    date,
  inquerito_num      text,
  inquerito_data     date,
  -- encerramento fora do fluxo normal
  desfecho           text check (desfecho in ('nao_gera','cancelado')),
  encaminhado_planilha text check (encaminhado_planilha in ('dpc','nai')),   -- planilha diz "encaminhado" sem data
  obs                text,
  situacao_planilha  text,                             -- texto original da planilha (importação)
  atualizado_por     text,
  atualizado_em      timestamptz not null default now()
);
create index if not exists tramite_ri_idx on tramite (ano, ri);

alter table tramite enable row level security;
drop policy if exists tecnica_le on tramite;
drop policy if exists tecnica_edita on tramite;
create policy tecnica_le    on tramite for select to authenticated using (is_tecnica());
create policy tecnica_edita on tramite for all    to authenticated using (is_tecnica()) with check (is_tecnica());
grant select, insert, update, delete on tramite to authenticated;
revoke all on tramite from anon;

-- auditoria: o gatilho genérico passa a respeitar 'portal.sem_auditoria' (importação em lote, que grava só um resumo)
create or replace function tg_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quem text := coalesce(lower(auth.jwt() ->> 'email'), current_setting('portal.importacao', true), current_user);
  a jsonb; d jsonb; mud text[]; k text := tg_argv[0]; rf text;
begin
  if coalesce(current_setting('portal.sem_auditoria', true), '') = '1' then
    if tg_op = 'DELETE' then return old; end if;
    if to_jsonb(new) ? 'atualizado_por' then new.atualizado_por := quem; end if;
    if tg_op = 'UPDATE' and to_jsonb(new) ? 'atualizado_em' then new.atualizado_em := now(); end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    a := to_jsonb(old);
    rf := nullif(concat_ws(': ', a ->> 'tipo', a ->> 'nome'), '');
    insert into auditoria (quem, tabela, chave, operacao, antes, ref) values (quem, tg_table_name, a ->> k, 'excluir', a, rf);
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if to_jsonb(new) ? 'atualizado_por' then new.atualizado_por := quem; end if;
    if to_jsonb(new) ? 'atualizado_em'  then new.atualizado_em  := now(); end if;
    a := to_jsonb(old); d := to_jsonb(new);
    select array_agg(x.key order by x.key) into mud from jsonb_each(d) x
     where x.key not in ('atualizado_por','atualizado_em','ref_geom','sede_geom','geom') and x.value is distinct from a -> x.key;
    if mud is null then return new; end if;
    rf := nullif(concat_ws(': ', d ->> 'tipo', d ->> 'nome'), '');
    insert into auditoria (quem, tabela, chave, operacao, campos, antes, depois, ref)
    values (quem, tg_table_name, d ->> k, 'alterar', mud,
            (select jsonb_object_agg(c, a -> c) from unnest(mud) c), (select jsonb_object_agg(c, d -> c) from unnest(mud) c), rf);
    return new;
  end if;
  if to_jsonb(new) ? 'atualizado_por' then new.atualizado_por := quem; end if;
  d := to_jsonb(new);
  rf := nullif(concat_ws(': ', d ->> 'tipo', d ->> 'nome'), '');
  insert into auditoria (quem, tabela, chave, operacao, depois, ref) values (quem, tg_table_name, d ->> k, 'incluir', d, rf);
  return new;
end $$;
revoke all on function tg_auditoria() from public, anon, authenticated;
drop trigger if exists auditoria on tramite;
create trigger auditoria before insert or update or delete on tramite for each row execute function tg_auditoria('cod_bdp');

drop policy if exists usuario_le_auditoria on auditoria;
create policy usuario_le_auditoria on auditoria for select to authenticated
  using ((tabela in ('uc_cadastro','regional','uc_infra','uc_ponto','uc_veiculo','uc_radio','uc_material',
                     'uc_parceiro','uc_prestador','uc_colaborador') and is_usuario())
         or (tabela = 'tramite' and is_tecnica()) or is_admin());

-- sala técnica pela base da UC (Januária: Alto Médio São Francisco, Norte e PQ Sagarana)
create or replace function sala_tecnica_uc(p_nome_uc text) returns text
language sql stable set search_path = public as $$
  select case when u.base_op ilike '%Januária%' then 'Januária' else 'Curvelo' end from uc u where u.nome_uc = p_nome_uc
$$;

-- cria a linha do trâmite: quando o RI é debelado (ROI 001) e quando um ROI entra no banco
create or replace function tg_tramite_ri() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.dat_final is not null and new.status <> 'cancelado' then
    insert into tramite (cod_bdp, ano, ri, roi_n, sala_tecnica)
    select new.ano || '-' || new.ri || '-001', new.ano, new.ri, 1, sala_tecnica_uc(new.nome_uc)
     where not exists (select 1 from tramite t where t.ano = new.ano and t.ri = new.ri);
  end if;
  return new;
end $$;
drop trigger if exists tramite_ri on ri;
create trigger tramite_ri after insert or update of dat_final, status on ri for each row execute function tg_tramite_ri();

create or replace function tg_tramite_roi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cod_bdp is not null and new.ano >= 2026 then
    insert into tramite (cod_bdp, ano, ri, roi_n, sala_tecnica, roi_recebido_email)
    values (new.cod_bdp, new.ano, new.ri, nullif(regexp_replace(coalesce(new.roi,''), '\D', '', 'g'), '')::int,
            sala_tecnica_uc(new.nome_uc), current_date)
    on conflict (cod_bdp) do update set roi_recebido_email = coalesce(tramite.roi_recebido_email, excluded.roi_recebido_email);
  end if;
  return new;
end $$;
drop trigger if exists tramite_roi on roi;
create trigger tramite_roi after insert on roi for each row execute function tg_tramite_roi();
revoke all on function tg_tramite_ri(), tg_tramite_roi() from public, anon, authenticated;

-- visão de trabalho: dados da ocorrência + etapa, pendências e prazos
create or replace view vw_tramite with (security_invoker = true) as
with base as (
  select t.*,
         coalesce(b.nome_uc, r.nome_uc) as nome_uc, coalesce(b.categoria, u.categoria) as categoria, u.ufbio as regional,
         coalesce(b.municipio, r.municipio) as municipio, coalesce(b.local, r.local) as local,
         coalesce(b.dat_detec, r.dat_detec) as dat_detec, coalesce(b.dat_final, r.dat_final) as dat_final,
         b.soma_area as area_ha, (b.cod_bdp is not null) as roi_no_banco,
         coalesce(t.pm_acionamento, (select min(p.data_hora)::date from ri_pmamb p where p.ano = t.ano and p.ri = t.ri)) as acionamento
    from tramite t
    left join vw_bdg b on b.cod_bdp = t.cod_bdp
    left join ri r on r.ano = t.ano and r.ri = t.ri
    left join uc u on u.nome_uc = coalesce(b.nome_uc, r.nome_uc)
), calc as (
  select base.*,
         (roi_recebido_email is not null or roi_recebido_sei is not null or roi_no_banco) as tem_roi,
         (reds_recebido is not null or nullif(reds_num, '') is not null) as tem_reds,
         (envio_dpc is not null or envio_cainf is not null or encaminhado_planilha is not null) as encaminhado,
         dat_final + 10 as prazo_roi,
         acionamento + 4 as cobrar_reds_em,
         acionamento + 10 as prazo_reds
    from base
)
select calc.*,
  case
    when desfecho = 'cancelado' then 'Cancelado'
    when desfecho = 'nao_gera'  then 'Não gera processo'
    when nullif(inquerito_num, '') is not null then 'Inquérito instaurado'
    when encaminhado then case when envio_dpc is not null or encaminhado_planilha = 'dpc' then 'Encaminhado à DPC' else 'Encaminhado à CAINF/NAI' end
    when nullif(oficio_num, '') is not null or nullif(memorando_cainf, '') is not null then 'Em assinatura / envio'
    when not tem_roi then 'Aguardando ROI'
    when roi_analise = 'devolvido' then 'ROI devolvido para correção'
    when coalesce(roi_analise, 'em_analise') = 'em_analise' and not roi_no_banco and roi_recebido_sei is null then 'ROI em análise'
    when not tem_reds then 'Falta REDS'
    when nullif(processo_sei, '') is null and not processo_fisico then 'Pronto para abrir processo'
    else 'Processo aberto'
  end as etapa,
  array_remove(array[
    case when not tem_roi and coalesce(desfecho, '') not in ('cancelado','nao_gera') then 'ROI' end,
    case when not tem_reds and coalesce(desfecho, '') not in ('cancelado','nao_gera') then 'REDS' end,
    case when poligono_recebido is null and tem_roi and not roi_no_banco then 'polígono' end,
    case when nullif(reds_num, '') is not null and reds_devolvido is not null and nullif(ai_num, '') is null then 'AI' end], null) as pendencias,
  case when not tem_roi and dat_final is not null and current_date > dat_final + 10 then current_date - (dat_final + 10) end as roi_dias_atraso,
  case when not tem_reds and acionamento is not null then current_date - acionamento end as reds_dias,
  case when encaminhado then coalesce(envio_dpc, envio_cainf) - dat_final end as dias_tramite
from calc;
grant select on vw_tramite to authenticated;
revoke all on vw_tramite from anon;

-- importação em lote (planilha da Sala Técnica): upsert sem auditoria linha a linha
create or replace function tramite_importar(p_linhas jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare n_ins int; n_tot int;
begin
  if not is_tecnica() then raise exception 'Somente a Sala Técnica, o Previncêndio ou administradores.'; end if;
  perform set_config('portal.sem_auditoria', '1', true);
  select count(*) into n_tot from jsonb_array_elements(p_linhas);
  with dados as (select * from jsonb_populate_recordset(null::tramite, p_linhas)),
  up as (
    insert into tramite (cod_bdp, ano, ri, roi_n, sala_tecnica, roi_recebido_email, roi_recebido_sei, poligono_recebido,
                         pm_municipio, pm_contato, pm_acionamento, reds_recebido, reds_num, processo_sei, processo_fisico,
                         oficio_num, dpc, envio_dpc, inquerito_num, desfecho, encaminhado_planilha, obs, situacao_planilha, atualizado_por, processo_aberto, roi_original)
    select cod_bdp, ano, ri, roi_n, coalesce(sala_tecnica, sala_tecnica_uc((select nome_uc from vw_bdg b where b.cod_bdp = d.cod_bdp))),
           roi_recebido_email, roi_recebido_sei, poligono_recebido, pm_municipio, pm_contato, pm_acionamento, reds_recebido, reds_num,
           processo_sei, processo_fisico, oficio_num, dpc, envio_dpc, inquerito_num, desfecho, encaminhado_planilha, obs, situacao_planilha,
           lower(auth.jwt() ->> 'email'), processo_aberto, roi_original
      from dados d
    on conflict (cod_bdp) do update set
      roi_recebido_email = coalesce(excluded.roi_recebido_email, tramite.roi_recebido_email),
      roi_recebido_sei   = coalesce(excluded.roi_recebido_sei, tramite.roi_recebido_sei),
      poligono_recebido  = coalesce(excluded.poligono_recebido, tramite.poligono_recebido),
      pm_municipio       = coalesce(excluded.pm_municipio, tramite.pm_municipio),
      pm_contato         = coalesce(excluded.pm_contato, tramite.pm_contato),
      pm_acionamento     = coalesce(excluded.pm_acionamento, tramite.pm_acionamento),
      reds_recebido      = coalesce(excluded.reds_recebido, tramite.reds_recebido),
      reds_num           = coalesce(excluded.reds_num, tramite.reds_num),
      processo_sei       = coalesce(excluded.processo_sei, tramite.processo_sei),
      processo_fisico    = excluded.processo_fisico or tramite.processo_fisico,
      oficio_num         = coalesce(excluded.oficio_num, tramite.oficio_num),
      dpc                = coalesce(excluded.dpc, tramite.dpc),
      envio_dpc          = coalesce(excluded.envio_dpc, tramite.envio_dpc),
      inquerito_num      = coalesce(excluded.inquerito_num, tramite.inquerito_num),
      desfecho           = coalesce(excluded.desfecho, tramite.desfecho),
      encaminhado_planilha = coalesce(excluded.encaminhado_planilha, tramite.encaminhado_planilha),
      processo_aberto    = coalesce(excluded.processo_aberto, tramite.processo_aberto),
      roi_original       = coalesce(excluded.roi_original, tramite.roi_original),
      obs                = coalesce(excluded.obs, tramite.obs),
      situacao_planilha  = coalesce(excluded.situacao_planilha, tramite.situacao_planilha)
    returning (xmax = 0) as novo)
  select count(*) filter (where novo) into n_ins from up;
  insert into auditoria (quem, tabela, chave, operacao, depois, ref)
  values (coalesce(lower(auth.jwt() ->> 'email'), current_user), 'tramite', 'importação', 'incluir',
          jsonb_build_object('linhas', n_tot, 'novas', n_ins), 'Importação da planilha da Sala Técnica');
  return json_build_object('linhas', n_tot, 'novas', n_ins, 'atualizadas', n_tot - n_ins);
end $$;
revoke all on function tramite_importar(jsonb) from public, anon;
grant execute on function tramite_importar(jsonb) to authenticated;

-- cod_bdp do BDG para conferência da importação (só chaves)
create or replace function bdg_chaves(p_ano int) returns table (cod_bdp text, ri text, roi text, nome_uc text)
language sql stable security definer set search_path = public as $$
  select cod_bdp, ri, roi, nome_uc from roi where ano = p_ano and is_tecnica();
$$;
revoke all on function bdg_chaves(int) from public, anon;
grant execute on function bdg_chaves(int) to authenticated;

-- BDG com os números do trâmite (para exportação)
create or replace view vw_bdg_tramite with (security_invoker = true) as
select b.cod_bdp, t.processo_sei, t.processo_fisico, t.reds_num, t.reds_bm, t.ai_num, t.dpc, t.envio_dpc, t.inquerito_num
  from roi b join tramite t on t.cod_bdp = b.cod_bdp;
grant select on vw_bdg_tramite to authenticated;
revoke all on vw_bdg_tramite from anon;

-- cria a ficha (ROI 001) para RIs encerrados que ainda não têm trâmite (rodar depois da importação)
create or replace function tramite_completar() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_tecnica() then raise exception 'Somente a Sala Técnica, o Previncêndio ou administradores.'; end if;
  insert into tramite (cod_bdp, ano, ri, roi_n, sala_tecnica)
  select r.ano || '-' || r.ri || '-001', r.ano, r.ri, 1, sala_tecnica_uc(r.nome_uc)
    from ri r
   where r.dat_final is not null and r.status <> 'cancelado'
     and not exists (select 1 from tramite t where t.ano = r.ano and t.ri = r.ri)
  on conflict (cod_bdp) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function tramite_completar() from public, anon;
grant execute on function tramite_completar() to authenticated;
