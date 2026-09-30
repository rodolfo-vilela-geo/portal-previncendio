-- =====================================================================
--  PORTAL PREVINCÊNDIO — MÓDULOS 3 E 4 DO CADASTRO DA UC
--  Módulo 3 · Recursos e comunicação: 4.4 veículos, 4.5 radiocomunicação
--    da UC, 4.6 rádios com parceiros, 5 materiais e equipamentos.
--  Módulo 4 · Rede de apoio: 6 parceiros (e outros contatos), 7 prestadores
--    de serviço, 8 colaboradores/moradores, 9 brigadistas voluntários.
--  Mesmas regras dos módulos 1 e 2: todos os usuários logados veem; o
--  gerente edita as suas UCs; GPCIF/admin editam todas; tudo vai para a
--  auditoria. Nada disso é público (nomes e telefones de terceiros).
-- =====================================================================

-- campos da UC que não são listas: outros contatos (seção 6) e observações da rede (seção 8)
alter table uc_infra add column if not exists outros_contatos jsonb not null default '[]';
alter table uc_infra add column if not exists rede_obs text;
comment on column uc_infra.nao_possui is
  'Itens que a UC declarou não possuir (conta como informado): tipos de uc_ponto, veiculo, radio_uc:<tipo>, radio_parceiro:<tipo>, material, parceiro, prestador:<tipo>, colaborador, brigadista.';

-- coordenada em MG (mesma regra de uc_ponto)
create or replace function coord_mg_ok(lat numeric, lon numeric) returns boolean
language sql immutable set search_path = public as $$ select (lat is null and lon is null) or (lat between -23.5 and -14 and lon between -51.5 and -39.5) $$;

-- ---------------------------------------------------------------------
-- 4.4 Veículos
-- ---------------------------------------------------------------------
create table uc_veiculo (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  tipo           text not null,                 -- camionete, moto, carro…
  nome           text,                          -- marca / modelo
  placa          text,                          -- placa ou identificação interna
  conservacao    text check (conservacao in ('bom','regular','ruim')),
  disponivel     boolean,
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4.5 / 4.6 Radiocomunicação (da UC e disponibilizada por parceiros)
-- ---------------------------------------------------------------------
create table uc_radio (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  origem         text not null default 'uc' check (origem in ('uc','parceiro')),
  tipo           text not null check (tipo in ('repetidora','fixo','movel','portatil')),
  nome           text,                          -- local, veículo/placa ou parceiro
  quantidade     int not null default 1 check (quantidade >= 0),
  qtd_uso        int check (qtd_uso >= 0),      -- em condição de uso
  conservacao    text check (conservacao in ('bom','ruim','inoperante')),
  lat            numeric(10,6),
  lon            numeric(10,6),
  geom           geometry(Point, 4674) generated always as
                 (case when lat is not null and lon is not null then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now(),
  check (coord_mg_ok(lat, lon))
);

-- ---------------------------------------------------------------------
-- 5 Materiais e equipamentos (da UC ou de brigadas/parceiros guardados na UC)
-- ---------------------------------------------------------------------
create table uc_material (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  tipo           text not null check (tipo in ('manual','especial','epi')),
  nome           text not null,                 -- item
  quantidade     int check (quantidade >= 0),
  situacao       text,                          -- bom, regular, ruim, em manutenção…
  detentor       text,                          -- vazio = da UC; senão a brigada/parceiro
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6 Parceiros e apoios disponíveis
-- ---------------------------------------------------------------------
create table uc_parceiro (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  tipo           text,                          -- Corpo de Bombeiros, Polícia Militar, Prefeitura…
  nome           text not null,                 -- identificação do parceiro
  responsavel    text,
  contatos       text,
  endereco       text,
  municipio      text,
  ponto_ref      text,
  lat            numeric(10,6),
  lon            numeric(10,6),
  geom           geometry(Point, 4674) generated always as
                 (case when lat is not null and lon is not null then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,
  apoios         jsonb not null default '[]',   -- [{tipo, quantidade, obs}]
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now(),
  check (coord_mg_ok(lat, lon))
);

-- ---------------------------------------------------------------------
-- 7 Prestadores de serviço (alimentação, saúde, abastecimento, outros)
-- ---------------------------------------------------------------------
create table uc_prestador (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  tipo           text not null check (tipo in ('alimentacao','saude','abastecimento','outro')),
  nome           text not null,
  responsavel    text,
  endereco       text,
  municipio      text,
  contatos       text,
  distancia      text,                          -- como informado ("500 m", "2,1 km")
  servicos       text,
  capacidade     text,                          -- alimentação: refeições
  conveniado     boolean,                       -- abastecimento: atende veículos oficiais
  lat            numeric(10,6),
  lon            numeric(10,6),
  geom           geometry(Point, 4674) generated always as
                 (case when lat is not null and lon is not null then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now(),
  check (coord_mg_ok(lat, lon))
);

-- ---------------------------------------------------------------------
-- 8 Colaboradores/moradores e 9 brigadistas voluntários
-- ---------------------------------------------------------------------
create table uc_colaborador (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  tipo           text not null check (tipo in ('colaborador','brigadista')),
  nome           text not null,
  localizacao    text,                          -- propriedade / local
  municipio      text,
  contato        text,
  apoio          text,                          -- atividade e tipo de apoio
  lat            numeric(10,6),
  lon            numeric(10,6),
  geom           geometry(Point, 4674) generated always as
                 (case when lat is not null and lon is not null then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now(),
  check (coord_mg_ok(lat, lon))
);

create index uc_veiculo_uc_idx     on uc_veiculo (nome_uc);
create index uc_radio_uc_idx       on uc_radio (nome_uc, origem, tipo);
create index uc_material_uc_idx    on uc_material (nome_uc, tipo);
create index uc_parceiro_uc_idx    on uc_parceiro (nome_uc);
create index uc_prestador_uc_idx   on uc_prestador (nome_uc, tipo);
create index uc_colaborador_uc_idx on uc_colaborador (nome_uc, tipo);

-- regras de acesso e auditoria (iguais para as seis tabelas)
do $$
declare t text;
begin
  foreach t in array array['uc_veiculo','uc_radio','uc_material','uc_parceiro','uc_prestador','uc_colaborador'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy usuario_le on %I for select to authenticated using (is_usuario())', t);
    execute format('create policy edita on %I for all to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('revoke all on %I from anon', t);
    execute format('create trigger auditoria before insert or update or delete on %I for each row execute function tg_auditoria(''nome_uc'')', t);
  end loop;
end $$;

drop policy if exists usuario_le_auditoria on auditoria;
create policy usuario_le_auditoria on auditoria for select to authenticated
  using ((tabela in ('uc_cadastro','regional','uc_infra','uc_ponto','uc_veiculo','uc_radio','uc_material',
                     'uc_parceiro','uc_prestador','uc_colaborador') and is_usuario()) or is_admin());

-- distância até o limite da UC (0 = dentro)
create or replace function dist_uc_km(p_nome_uc text, p_geom geometry) returns numeric
language sql stable security invoker set search_path = public as $$
  select case when p_geom is null then null else
    round((st_distance(p_geom::geography, (select st_union(l.geom) from uc_limite l where l.nome_uc = p_nome_uc and l.tipo = 'uc')::geography) / 1000)::numeric, 2) end
$$;
grant execute on function dist_uc_km(text, geometry) to authenticated;
revoke all on function dist_uc_km(text, geometry) from anon, public;

-- todos os pontos dos módulos 3 e 4 (para os mapas do cadastro e do painel)
create or replace view vw_uc_rede_geo with (security_invoker = true) as
select nome_uc, 'uc_radio'::text as tabela, id, case when origem = 'uc' then tipo else 'parceiro_' || tipo end as tipo,
       coalesce(nome, '') as nome, lat, lon, conservacao as situacao, dist_uc_km(nome_uc, geom) as dist_uc_km
  from uc_radio where geom is not null
union all
select nome_uc, 'uc_parceiro', id, 'parceiro', nome, lat, lon, null, dist_uc_km(nome_uc, geom) from uc_parceiro where geom is not null
union all
select nome_uc, 'uc_prestador', id, tipo, nome, lat, lon, null, dist_uc_km(nome_uc, geom) from uc_prestador where geom is not null
union all
select nome_uc, 'uc_colaborador', id, tipo, nome, lat, lon, null, dist_uc_km(nome_uc, geom) from uc_colaborador where geom is not null;
grant select on vw_uc_rede_geo to authenticated;
revoke all on vw_uc_rede_geo from anon;

-- resumo por UC para o Painel da UC
create or replace function uc_recursos_resumo(p_nome_uc text) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'veiculos',       (select count(*) from uc_veiculo where nome_uc = p_nome_uc),
    'veiculos_disp',  (select count(*) from uc_veiculo where nome_uc = p_nome_uc and disponivel is not false and coalesce(conservacao,'') <> 'ruim'),
    'ht',             (select coalesce(sum(quantidade),0) from uc_radio where nome_uc = p_nome_uc and origem = 'uc' and tipo = 'portatil'),
    'ht_uso',         (select coalesce(sum(coalesce(qtd_uso, quantidade)),0) from uc_radio where nome_uc = p_nome_uc and origem = 'uc' and tipo = 'portatil'),
    'repetidoras',    (select count(*) from uc_radio where nome_uc = p_nome_uc and tipo = 'repetidora'),
    'radios_fixos',   (select coalesce(sum(quantidade),0) from uc_radio where nome_uc = p_nome_uc and origem = 'uc' and tipo in ('fixo','movel')),
    'abafadores',     (select coalesce(sum(quantidade),0) from uc_material where nome_uc = p_nome_uc and nome ilike 'abafador%'),
    'bombas_costais', (select coalesce(sum(quantidade),0) from uc_material where nome_uc = p_nome_uc and (nome ilike 'bomba costal%' or nome ilike 'mochila costal%' or nome ilike 'bolsa costal%')),
    'itens_material', (select count(*) from uc_material where nome_uc = p_nome_uc),
    'parceiros',      (select count(*) from uc_parceiro where nome_uc = p_nome_uc),
    'prestadores',    (select count(*) from uc_prestador where nome_uc = p_nome_uc),
    'saude',          (select count(*) from uc_prestador where nome_uc = p_nome_uc and tipo = 'saude'),
    'colaboradores',  (select count(*) from uc_colaborador where nome_uc = p_nome_uc and tipo = 'colaborador'),
    'brigadistas',    (select count(*) from uc_colaborador where nome_uc = p_nome_uc and tipo = 'brigadista'))
$$;
grant execute on function uc_recursos_resumo(text) to authenticated;
revoke all on function uc_recursos_resumo(text) from anon, public;
