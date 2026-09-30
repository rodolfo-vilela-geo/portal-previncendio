-- =====================================================================
--  PORTAL PREVINCÊNDIO — MÓDULO 1 DO PIPCIF
--  · gerentes com login (papel 'gerente'), ligados às UCs que administram;
--  · todos os usuários logados VEEM todas as UCs; EDITAM só as suas
--    (gerente) ou todas (gpcif/admin);
--  · cadastro da UC = seção 3 do PIPCIF + sede (4.1);
--  · regionais (URFBio) com coordenador e contatos, editadas pela GPCIF;
--  · histórico de alterações genérico (quem, quando, antes → depois),
--    reaproveitado pelos próximos módulos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Papéis e permissões
-- ---------------------------------------------------------------------
alter table equipe drop constraint equipe_papel_check;
alter table equipe add constraint equipe_papel_check check (papel in ('sala','gpcif','admin','gerente'));
alter table equipe add column telefone text,
                   add column trocar_senha boolean not null default false,
                   add column atualizado_em timestamptz not null default now();

-- equipe interna (sala, GPCIF, admin): continua sendo quem acessa RI, ROI, atuações...
create or replace function is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipe
                 where email = lower(coalesce(auth.jwt() ->> 'email', '')) and ativo and papel <> 'gerente');
$$;
-- qualquer usuário ativo (inclui gerentes): pode ver o cadastro das UCs
create or replace function is_usuario() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipe where email = lower(coalesce(auth.jwt() ->> 'email', '')) and ativo);
$$;
create or replace function is_gpcif() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipe where email = lower(coalesce(auth.jwt() ->> 'email', '')) and ativo and papel in ('gpcif','admin'));
$$;

create table usuario_uc (
  email     text not null references equipe(email) on update cascade on delete cascade,
  nome_uc   text not null references uc(nome_uc) on update cascade on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (email, nome_uc)
);
comment on table usuario_uc is 'Quais UCs cada gerente administra (pode editar).';

create or replace function pode_editar_uc(p_nome_uc text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_gpcif() or exists (
    select 1 from usuario_uc l join equipe e on e.email = l.email
    where l.email = lower(coalesce(auth.jwt() ->> 'email', '')) and e.ativo and l.nome_uc = p_nome_uc);
$$;

create or replace function meu_perfil() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('email', e.email, 'nome', e.nome, 'papel', e.papel, 'telefone', e.telefone, 'trocar_senha', e.trocar_senha,
           'ucs', coalesce((select json_agg(l.nome_uc order by l.nome_uc) from usuario_uc l where l.email = e.email), '[]'::json))
  from equipe e where e.email = lower(coalesce(auth.jwt() ->> 'email', '')) and e.ativo;
$$;
create or replace function senha_trocada() returns void
language sql security definer set search_path = public as $$
  update equipe set trocar_senha = false where email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
revoke all on function is_usuario(), is_gpcif(), pode_editar_uc(text), senha_trocada() from public, anon;
grant execute on function is_usuario(), is_gpcif(), pode_editar_uc(text), senha_trocada() to authenticated;

-- equipe: todos os usuários veem a lista (nomes/papéis); só admin altera
drop policy if exists equipe_le_equipe on equipe;
create policy usuario_le_equipe on equipe for select to authenticated using (is_usuario());
create policy admin_equipe on equipe for all to authenticated using (is_admin()) with check (is_admin());
alter table usuario_uc enable row level security;
create policy usuario_le_vinculo on usuario_uc for select to authenticated using (is_usuario());
create policy admin_vinculo on usuario_uc for all to authenticated using (is_admin()) with check (is_admin());
grant select, insert, update, delete on equipe, usuario_uc to authenticated;

-- ---------------------------------------------------------------------
-- 2. Histórico de alterações (genérico)
-- ---------------------------------------------------------------------
create table auditoria (
  id        bigint generated always as identity primary key,
  quando    timestamptz not null default now(),
  quem      text,
  tabela    text not null,
  chave     text,                         -- ex.: nome da UC
  operacao  text not null check (operacao in ('incluir','alterar','excluir')),
  campos    text[],                       -- campos que mudaram (alterar)
  antes     jsonb,
  depois    jsonb
);
create index auditoria_chave_idx on auditoria (tabela, chave, quando desc);
alter table auditoria enable row level security;
-- cadastro das UCs é transparente para todos os usuários; o resto, só admin
create policy usuario_le_auditoria on auditoria for select to authenticated
  using ((tabela in ('uc_cadastro','regional') and is_usuario()) or is_admin());
grant select on auditoria to authenticated;

-- registra quem/quando e grava o histórico. Argumento: nome da coluna-chave.
create or replace function tg_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quem text := coalesce(lower(auth.jwt() ->> 'email'), current_setting('portal.importacao', true), current_user);
  a jsonb; d jsonb; mud text[]; k text := tg_argv[0];
begin
  if tg_op = 'DELETE' then
    a := to_jsonb(old);
    insert into auditoria (quem, tabela, chave, operacao, antes) values (quem, tg_table_name, a ->> k, 'excluir', a);
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if to_jsonb(new) ? 'atualizado_por' then new.atualizado_por := quem; end if;
    if to_jsonb(new) ? 'atualizado_em'  then new.atualizado_em  := now(); end if;
    a := to_jsonb(old); d := to_jsonb(new);
    select array_agg(x.key order by x.key) into mud from jsonb_each(d) x
     where x.key not in ('atualizado_por','atualizado_em','ref_geom','sede_geom') and x.value is distinct from a -> x.key;
    if mud is null then return new; end if;             -- nada mudou de fato
    insert into auditoria (quem, tabela, chave, operacao, campos,
                           antes, depois)
    values (quem, tg_table_name, d ->> k, 'alterar', mud,
            (select jsonb_object_agg(c, a -> c) from unnest(mud) c), (select jsonb_object_agg(c, d -> c) from unnest(mud) c));
    return new;
  end if;
  if to_jsonb(new) ? 'atualizado_por' then new.atualizado_por := quem; end if;
  d := to_jsonb(new);
  insert into auditoria (quem, tabela, chave, operacao, depois) values (quem, tg_table_name, d ->> k, 'incluir', d);
  return new;
end $$;

create trigger equipe_auditoria  before insert or update or delete on equipe     for each row execute function tg_auditoria('email');
create trigger vinculo_auditoria before insert or update or delete on usuario_uc for each row execute function tg_auditoria('email');

-- ---------------------------------------------------------------------
-- 3. Regionais (URFBio)
-- ---------------------------------------------------------------------
create table regional (
  nome            text primary key,          -- igual a uc.ufbio (ex.: 'Jequitinhonha')
  sigla           text,                      -- ex.: 'URFBio-JQ'
  telefones       text,
  coordenador     text,
  coord_contatos  jsonb not null default '[]',   -- [{tipo:'tel'|'email', valor, obs}]
  endereco        text,
  atualizado_por  text,
  atualizado_em   timestamptz not null default now()
);
insert into regional (nome) select valor from dominio where campo = 'ufbio' on conflict do nothing;
alter table regional enable row level security;
create policy usuario_le_regional on regional for select to authenticated using (is_usuario());
create policy gpcif_regional on regional for all to authenticated using (is_gpcif()) with check (is_gpcif());
grant select, insert, update, delete on regional to authenticated;
create trigger regional_auditoria before insert or update or delete on regional for each row execute function tg_auditoria('nome');

-- ---------------------------------------------------------------------
-- 4. Cadastro da UC (PIPCIF seção 3 + sede 4.1)
-- ---------------------------------------------------------------------
create table uc_cadastro (
  nome_uc          text primary key references uc(nome_uc) on update cascade on delete cascade,
  gerente_nome     text,
  gerente_contatos jsonb not null default '[]',      -- [{tipo:'tel'|'email', valor, obs}]
  func_adm         int check (func_adm >= 0),
  func_oper        int check (func_oper >= 0),
  responsaveis     jsonb not null default '[]',      -- [{nome, telefone, email}] — na ausência do gerente (mín. 2)
  decretos         text,                             -- decreto(s) de criação/alteração, com datas
  area_decreto_ha  numeric(12,2),
  biomas           text[],
  fitofisionomia   text,
  topografia       text,
  clima            text,
  meses_criticos   int[] check (meses_criticos <@ array[1,2,3,4,5,6,7,8,9,10,11,12]),
  meses_obs        text,
  ref_lat          numeric(10,6),                    -- ponto de referência da UC (SIRGAS 2000)
  ref_lon          numeric(10,6),
  ref_geom         geometry(Point, 4674) generated always as
                   (case when ref_lat is not null and ref_lon is not null then st_setsrid(st_makepoint(ref_lon::float8, ref_lat::float8), 4674) end) stored,
  altitude_min     int,
  altitude_max     int,
  fundiaria_pct    numeric(5,2) check (fundiaria_pct between 0 and 100),
  fundiaria_ha     numeric(12,2),
  fundiaria_obs    text,
  sede_municipio   text,
  sede_endereco    text,
  sede_lat         numeric(10,6),
  sede_lon         numeric(10,6),
  sede_geom        geometry(Point, 4674) generated always as
                   (case when sede_lat is not null and sede_lon is not null then st_setsrid(st_makepoint(sede_lon::float8, sede_lat::float8), 4674) end) stored,
  obs              text,
  atualizado_por   text,
  atualizado_em    timestamptz not null default now(),
  check (ref_lat  is null or (ref_lat  between -23.5 and -14 and ref_lon  between -51.5 and -39.5)),
  check (sede_lat is null or (sede_lat between -23.5 and -14 and sede_lon between -51.5 and -39.5))
);
comment on table uc_cadastro is 'PIPCIF seção 3 (informações gerais) e 4.1 (sede). Uma linha por UC.';
insert into uc_cadastro (nome_uc, gerente_nome)
select nome_uc, gerente from uc where ativo on conflict do nothing;

alter table uc_cadastro enable row level security;
create policy usuario_le_cadastro on uc_cadastro for select to authenticated using (is_usuario());
create policy edita_cadastro on uc_cadastro for update to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc));
create policy gpcif_inclui_cadastro on uc_cadastro for insert to authenticated with check (is_gpcif());
grant select, insert, update on uc_cadastro to authenticated;
create trigger cadastro_auditoria before insert or update or delete on uc_cadastro for each row execute function tg_auditoria('nome_uc');

-- o nome do gerente e o 1º telefone continuam alimentando o formulário do ROI (tabela uc)
create or replace function tg_cadastro_para_uc() returns trigger
language plpgsql security definer set search_path = public as $$
declare tel text;
begin
  select c ->> 'valor' into tel from jsonb_array_elements(new.gerente_contatos) c where c ->> 'tipo' = 'tel' limit 1;
  update uc set gerente = new.gerente_nome, telefone = coalesce(tel, telefone)
   where nome_uc = new.nome_uc and (gerente is distinct from new.gerente_nome or (tel is not null and telefone is distinct from tel));
  return new;
end $$;
create trigger cadastro_para_uc after insert or update of gerente_nome, gerente_contatos on uc_cadastro
  for each row execute function tg_cadastro_para_uc();

-- nova UC no cadastro fixo ganha linha de cadastro automaticamente
create or replace function tg_uc_novo_cadastro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into uc_cadastro (nome_uc, gerente_nome) values (new.nome_uc, new.gerente) on conflict do nothing;
  return new;
end $$;
create trigger uc_novo_cadastro after insert on uc for each row execute function tg_uc_novo_cadastro();

-- usuários logados (gerentes) leem o cadastro fixo das UCs (já é público) e os limites
-- (políticas de leitura pública já existentes em uc e uc_limite)

-- ---------------------------------------------------------------------
-- 5. Visão para a lista: dados fixos + cadastro + área do limite + completude
-- ---------------------------------------------------------------------
create or replace view vw_uc_cadastro with (security_invoker = true) as
select u.nome_uc, u.categoria, u.grupo, u.bioma_uc, u.ufbio, u.base_op, u.municipios, u.ativo,
       c.gerente_nome, c.atualizado_por, c.atualizado_em,
       (select round((sum(st_area(l.geom::geography)) / 10000)::numeric, 2) from uc_limite l where l.nome_uc = u.nome_uc and l.tipo = 'uc') as area_limite_ha,
       (select array_agg(l.email order by l.email) from usuario_uc l where l.nome_uc = u.nome_uc) as gerentes_login,
       round(100.0 * (
         (c.gerente_nome is not null)::int + (jsonb_array_length(c.gerente_contatos) > 0)::int +
         (c.func_adm is not null or c.func_oper is not null)::int + (jsonb_array_length(c.responsaveis) >= 2)::int +
         (c.decretos is not null)::int + (c.area_decreto_ha is not null)::int + (coalesce(array_length(c.biomas,1),0) > 0)::int +
         (c.fitofisionomia is not null)::int + (c.topografia is not null)::int + (c.clima is not null)::int +
         (coalesce(array_length(c.meses_criticos,1),0) > 0)::int + (c.ref_lat is not null)::int +
         (c.altitude_min is not null or c.altitude_max is not null)::int +
         (c.fundiaria_pct is not null or c.fundiaria_ha is not null or c.fundiaria_obs is not null)::int +
         (c.sede_endereco is not null)::int + (c.sede_lat is not null)::int
       ) / 16) as completo_pct
from uc u left join uc_cadastro c on c.nome_uc = u.nome_uc
where u.ativo;
grant select on vw_uc_cadastro to authenticated;
revoke all on vw_uc_cadastro from anon;
revoke all on function tg_auditoria(), tg_cadastro_para_uc(), tg_uc_novo_cadastro() from public, anon, authenticated;
