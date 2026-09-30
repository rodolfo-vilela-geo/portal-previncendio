-- =====================================================================
--  PORTAL PREVINCÊNDIO — MÓDULO 2: INFRAESTRUTURA DA UC
--  PIPCIF 4.2 alojamento/camping (uc_infra, 1 linha por UC) e
--  4.3 vigilância, 4.7 pistas de pouso, 4.8 helipontos, 4.9 estações
--  meteorológicas e 4.10 hidrantes/pontos de água (uc_ponto, georreferenciados).
--  Mesmas regras do cadastro: todos os usuários veem; gerente edita as suas
--  UCs; Previncêndio/admin editam todas; toda alteração vai para a auditoria.
-- =====================================================================

-- auditoria: referência legível do item alterado (ex.: "Heliponto: Campo de futebol")
alter table auditoria add column if not exists ref text;
create or replace function tg_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quem text := coalesce(lower(auth.jwt() ->> 'email'), current_setting('portal.importacao', true), current_user);
  a jsonb; d jsonb; mud text[]; k text := tg_argv[0]; rf text;
begin
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

drop policy if exists usuario_le_auditoria on auditoria;
create policy usuario_le_auditoria on auditoria for select to authenticated
  using ((tabela in ('uc_cadastro','regional','uc_infra','uc_ponto') and is_usuario()) or is_admin());

-- ---------------------------------------------------------------------
-- 4.2 Alojamento e camping + tipos declarados como inexistentes
-- ---------------------------------------------------------------------
create table uc_infra (
  nome_uc            text primary key references uc(nome_uc) on update cascade on delete cascade,
  tem_alojamento     boolean,
  camas              int check (camas >= 0),
  roupa_cama         text,
  sanitarios         int check (sanitarios >= 0),
  cozinha            text,
  tem_camping        boolean,
  barracas           int check (barracas >= 0),
  camping_sanitarios int check (camping_sanitarios >= 0),
  camping_energia    boolean,
  alojamento_obs     text,
  nao_possui         text[] not null default '{}',   -- tipos de uc_ponto que a UC declarou não ter
  atualizado_por     text,
  atualizado_em      timestamptz not null default now()
);
comment on table uc_infra is 'PIPCIF 4.2 (alojamento/camping) e tipos de infraestrutura que a UC declarou não possuir.';

-- ---------------------------------------------------------------------
-- 4.3 / 4.7 / 4.8 / 4.9 / 4.10 — pontos georreferenciados
-- ---------------------------------------------------------------------
create table uc_ponto (
  id            bigint generated always as identity primary key,
  nome_uc       text not null references uc(nome_uc) on update cascade on delete cascade,
  tipo          text not null check (tipo in ('vigilancia','pista','heliponto','estacao','agua')),
  nome          text not null,                       -- identificação do local
  lat           numeric(10,6),
  lon           numeric(10,6),
  geom          geometry(Point, 4674) generated always as
                (case when lat is not null and lon is not null then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,
  altitude_m    int,
  ponto_ref     text,
  situacao      text check (situacao in ('operante','parcial','inoperante')),
  atributos     jsonb not null default '{}',         -- campos próprios de cada tipo (ver comentário)
  obs           text,
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  check (lat is null or (lat between -23.5 and -14 and lon between -51.5 and -39.5))
);
comment on column uc_ponto.atributos is
  'vigilancia: estrutura, localizacao · pista: largura_m, comprimento_m, pavimentacao, conservacao, reservatorio · heliponto: dimensoes, piso · estacao: responsavel, localizacao · agua: tipo_agua, responsavel, localizacao';
create index uc_ponto_uc_idx on uc_ponto (nome_uc, tipo);
create index uc_ponto_geom_idx on uc_ponto using gist (geom);

alter table uc_infra enable row level security;
alter table uc_ponto enable row level security;
create policy usuario_le_infra on uc_infra for select to authenticated using (is_usuario());
create policy edita_infra      on uc_infra for all    to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc));
create policy usuario_le_ponto on uc_ponto for select to authenticated using (is_usuario());
create policy edita_ponto      on uc_ponto for all    to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc));
grant select, insert, update, delete on uc_infra, uc_ponto to authenticated;
revoke all on uc_infra, uc_ponto from anon;
create trigger infra_auditoria before insert or update or delete on uc_infra for each row execute function tg_auditoria('nome_uc');
create trigger ponto_auditoria before insert or update or delete on uc_ponto for each row execute function tg_auditoria('nome_uc');

-- pontos com a distância até a UC (0 = dentro do limite)
create or replace view vw_uc_ponto with (security_invoker = true) as
select p.*,
       case when p.geom is null then null
            else round((st_distance(p.geom::geography, (select st_union(l.geom) from uc_limite l where l.nome_uc = p.nome_uc and l.tipo = 'uc')::geography) / 1000)::numeric, 2)
       end as dist_uc_km
from uc_ponto p;
grant select on vw_uc_ponto to authenticated;
revoke all on vw_uc_ponto from anon;
