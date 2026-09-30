-- =====================================================================
--  PORTAL PREVINCÊNDIO — CONFIGURADOR DAS LISTAS SUSPENSAS (só admin)
--  Regras:
--   · nada se apaga: valor sai do formulário ao ser desativado;
--   · renomear mostra o uso e oferece dois caminhos:
--       corrigir  = muda a grafia também no histórico (ROI, RI, cadastro de UCs);
--       substituir = cria o valor novo e desativa o antigo (histórico intacto);
--   · listas estruturais do BDG/cadastro de UCs ficam travadas;
--   · toda alteração fica registrada em dominio_log.
--  A escrita na tabela dominio passa a ser feita só pelas funções abaixo.
-- =====================================================================

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipe e where e.email = lower(auth.jwt() ->> 'email') and e.ativo and e.papel = 'admin');
$$;
revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- quais listas existem, quais podem ser editadas e onde cada uma é usada
create table dominio_campo (
  campo     text primary key,
  rotulo    text not null,
  editavel  boolean not null default false,
  motivo    text,                         -- por que está travada / cuidados
  ordem     int not null default 0
);
insert into dominio_campo (campo, rotulo, editavel, motivo, ordem) values
 ('f_detec',   'Forma de detecção',             true,  'Valores com "satélite" no nome contam como detecção por satélite no cálculo do tempo de resposta (BDG).', 1),
 ('causa_p',   'Causa provável',                true,  null, 2),
 ('ag_causal', 'Agente causador',               true,  null, 3),
 ('municipio', 'Município',                     true,  'Ao corrigir a grafia, o cadastro de UCs e os RIs também são atualizados.', 4),
 ('local',     'Localização (interno/entorno)', false, 'Usada nas classes e no cálculo de área interna/entorno do BDG.', 10),
 ('ind_aut',   'Auto de infração',              false, 'Lista Sim/Não.', 11),
 ('nome_uc',   'Unidade de Conservação',        false, 'Vem do cadastro de UCs e dos limites; mudanças de nome/categoria são feitas pela GPCIF com migração.', 12),
 ('categoria', 'Categoria da UC',               false, 'Categorias do SNUC; estrutural.', 13),
 ('grupo',     'Grupo (PI/US)',                 false, 'Estrutural (SNUC).', 14),
 ('bioma_uc',  'Bioma',                         false, 'Estrutural.', 15),
 ('ufbio',     'Regional (URFBio)',             false, 'Regionais do IEF; mudança exige revisar o cadastro de UCs.', 16),
 ('base_op',   'Base operacional',              false, 'Usada no RI, no boletim e nas siglas BOCUR/SBJAN/SBBH.', 17);
alter table dominio_campo enable row level security;
create policy dominio_campo_leitura on dominio_campo for select to authenticated using (true);

create table dominio_log (
  id           bigint generated always as identity primary key,
  quando       timestamptz not null default now(),
  quem         text not null default (auth.jwt() ->> 'email'),
  campo        text not null,
  acao         text not null check (acao in ('incluir','alterar','corrigir','substituir')),
  valor_antigo text,
  valor_novo   text,
  detalhe      text
);
alter table dominio_log enable row level security;
create policy dominio_log_leitura on dominio_log for select to authenticated using (is_admin());

-- escrita direta na tabela dominio: ninguém (só pelas funções)
drop policy if exists equipe_dominio on dominio;
revoke insert, update, delete on dominio from anon, authenticated;

-- ---------------------------------------------------------------------
-- uso de cada valor (ROI + RI; município também no cadastro de UCs)
-- ---------------------------------------------------------------------
create or replace function dominio_uso(p_campo text)
returns table (valor text, ordem int, ativo boolean, n_roi bigint, n_ri bigint)
language plpgsql stable security definer set search_path = public as $$
declare tem_ri boolean;
begin
  if not is_admin() then raise exception 'Somente administradores.' using errcode = '42501'; end if;
  if not exists (select 1 from dominio_campo c where c.campo = p_campo) then raise exception 'Lista desconhecida: %', p_campo; end if;
  tem_ri := exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'ri' and c.column_name = p_campo);
  return query execute format($q$
    select d.valor, d.ordem, d.ativo,
           (select count(*) from roi o where o.%1$I = d.valor),
           %2$s
    from dominio d where d.campo = $1
    order by d.ativo desc, d.ordem, d.valor $q$,
    p_campo, case when tem_ri then format('(select count(*) from ri r where r.%I = d.valor)', p_campo) else '0::bigint' end)
  using p_campo;
end $$;

-- incluir valor novo
create or replace function dominio_incluir(p_campo text, p_valor text, p_ordem int default null)
returns void language plpgsql security definer set search_path = public as $$
declare v text := btrim(regexp_replace(p_valor, '\s+', ' ', 'g'));
begin
  if not is_admin() then raise exception 'Somente administradores.' using errcode = '42501'; end if;
  if not exists (select 1 from dominio_campo c where c.campo = p_campo and c.editavel) then raise exception 'Esta lista não pode ser editada aqui.'; end if;
  if v is null or v = '' then raise exception 'Informe o valor.'; end if;
  if exists (select 1 from dominio d where d.campo = p_campo and lower(d.valor) = lower(v)) then
    raise exception 'Já existe "%" nesta lista (ativo ou inativo). Reative-o em vez de criar outro.', v; end if;
  insert into dominio (campo, valor, ordem, ativo)
  values (p_campo, v, coalesce(p_ordem, (select coalesce(max(d.ordem), 0) + 1 from dominio d where d.campo = p_campo)), true);
  insert into dominio_log (campo, acao, valor_novo) values (p_campo, 'incluir', v);
end $$;

-- mudar ordem e/ou ativar/desativar
create or replace function dominio_alterar(p_campo text, p_valor text, p_ordem int, p_ativo boolean)
returns void language plpgsql security definer set search_path = public as $$
declare a dominio;
begin
  if not is_admin() then raise exception 'Somente administradores.' using errcode = '42501'; end if;
  if not exists (select 1 from dominio_campo c where c.campo = p_campo and c.editavel) then raise exception 'Esta lista não pode ser editada aqui.'; end if;
  select * into a from dominio d where d.campo = p_campo and d.valor = p_valor;
  if not found then raise exception 'Valor não encontrado.'; end if;
  if a.ordem is not distinct from p_ordem and a.ativo is not distinct from p_ativo then return; end if;
  update dominio d set ordem = coalesce(p_ordem, d.ordem), ativo = coalesce(p_ativo, d.ativo) where d.campo = p_campo and d.valor = p_valor;
  insert into dominio_log (campo, acao, valor_antigo, detalhe)
  values (p_campo, 'alterar', p_valor, concat_ws('; ',
    case when a.ordem is distinct from p_ordem then format('ordem %s → %s', a.ordem, p_ordem) end,
    case when a.ativo is distinct from p_ativo then case when p_ativo then 'reativado' else 'desativado' end end));
end $$;

-- renomear: corrigir (atualiza histórico) ou substituir (novo valor, antigo desativado)
create or replace function dominio_renomear(p_campo text, p_antigo text, p_novo text, p_corrigir_historico boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v text := btrim(regexp_replace(p_novo, '\s+', ' ', 'g'));
        a dominio; n_roi bigint := 0; n_ri bigint := 0; n_uc bigint := 0; ja_existe boolean;
begin
  if not is_admin() then raise exception 'Somente administradores.' using errcode = '42501'; end if;
  if not exists (select 1 from dominio_campo c where c.campo = p_campo and c.editavel) then raise exception 'Esta lista não pode ser editada aqui.'; end if;
  if v is null or v = '' then raise exception 'Informe o novo valor.'; end if;
  select * into a from dominio d where d.campo = p_campo and d.valor = p_antigo;
  if not found then raise exception 'Valor não encontrado.'; end if;
  if v = p_antigo then raise exception 'O novo valor é igual ao atual.'; end if;
  ja_existe := exists (select 1 from dominio d where d.campo = p_campo and d.valor = v);

  if p_corrigir_historico then
    -- histórico passa a usar a grafia nova
    execute format('update roi set %1$I = $2 where %1$I = $1', p_campo) using p_antigo, v;
    get diagnostics n_roi = row_count;
    if exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'ri' and c.column_name = p_campo) then
      execute format('update ri set %1$I = $2 where %1$I = $1', p_campo) using p_antigo, v;
      get diagnostics n_ri = row_count;
    end if;
    if p_campo = 'municipio' then
      update uc set municipios = array_replace(municipios, p_antigo, v) where p_antigo = any(municipios);
      get diagnostics n_uc = row_count;
    end if;
    if ja_existe then               -- já havia o valor certo: une os dois
      delete from dominio d where d.campo = p_campo and d.valor = p_antigo;
      update dominio d set ativo = d.ativo or a.ativo where d.campo = p_campo and d.valor = v;
    else
      update dominio d set valor = v where d.campo = p_campo and d.valor = p_antigo;
    end if;
    insert into dominio_log (campo, acao, valor_antigo, valor_novo, detalhe)
    values (p_campo, 'corrigir', p_antigo, v, format('%s ROIs, %s RIs, %s UCs atualizados%s', n_roi, n_ri, n_uc, case when ja_existe then '; valores unidos' else '' end));
  else
    if ja_existe then update dominio d set ativo = true where d.campo = p_campo and d.valor = v;
    else insert into dominio (campo, valor, ordem, ativo) values (p_campo, v, a.ordem, true); end if;
    update dominio d set ativo = false where d.campo = p_campo and d.valor = p_antigo;
    insert into dominio_log (campo, acao, valor_antigo, valor_novo, detalhe)
    values (p_campo, 'substituir', p_antigo, v, 'histórico mantido; valor antigo desativado');
  end if;
  return json_build_object('n_roi', n_roi, 'n_ri', n_ri, 'n_uc', n_uc, 'unidos', ja_existe);
end $$;

revoke all on function dominio_uso(text), dominio_incluir(text, text, int), dominio_alterar(text, text, int, boolean),
                       dominio_renomear(text, text, text, boolean) from public, anon;
grant execute on function dominio_uso(text), dominio_incluir(text, text, int), dominio_alterar(text, text, int, boolean),
                          dominio_renomear(text, text, text, boolean) to authenticated;
