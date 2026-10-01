-- =====================================================================
--  COLIBRI — MÓDULO 5 DO CADASTRO DA UC · ATIVIDADES PREVENTIVAS
--  10 aceiros, estradas e trilhas (traçado no mapa: desenho, arquivo
--     KML/GPX/GeoJSON ou só os pontos de início e fim do PIPCIF);
--  11 elementos favoráveis e adversos à prevenção e ao combate;
--  12 cronograma de ações preventivas (capacitação e sensibilização);
--  13 projetos de sustentabilidade dentro e no entorno da UC;
--  16 atuação dos brigadistas contratados (contratações por ano e rotina).
--  Mesmas regras dos módulos 1 a 4: usuários logados veem; o gerente edita
--  as suas UCs; Previncêndio/admin editam todas; tudo vai para a auditoria.
-- =====================================================================

-- a auditoria não guarda traçados nem geometrias (pesados e sem leitura humana);
-- a alteração do traçado aparece pelo campo tracado_em e pelo comprimento no mapa
create or replace function tg_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  quem text := coalesce(lower(auth.jwt() ->> 'email'), current_setting('portal.importacao', true), current_user);
  a jsonb; d jsonb; mud text[]; k text := tg_argv[0]; rf text;
  fora constant text[] := array['atualizado_por','atualizado_em','ref_geom','sede_geom','geom','geojson'];
begin
  if coalesce(current_setting('portal.sem_auditoria', true), '') = '1' then
    if tg_op = 'DELETE' then return old; end if;
    if to_jsonb(new) ? 'atualizado_por' then new.atualizado_por := quem; end if;
    if tg_op = 'UPDATE' and to_jsonb(new) ? 'atualizado_em' then new.atualizado_em := now(); end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    a := to_jsonb(old) - 'geom' - 'geojson';
    rf := nullif(concat_ws(': ', a ->> 'tipo', a ->> 'nome'), '');
    insert into auditoria (quem, tabela, chave, operacao, antes, ref) values (quem, tg_table_name, a ->> k, 'excluir', a, rf);
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if to_jsonb(new) ? 'atualizado_por' then new.atualizado_por := quem; end if;
    if to_jsonb(new) ? 'atualizado_em'  then new.atualizado_em  := now(); end if;
    a := to_jsonb(old); d := to_jsonb(new);
    select array_agg(x.key order by x.key) into mud from jsonb_each(d) x
     where x.key <> all (fora) and x.value is distinct from a -> x.key;
    if mud is null then return new; end if;
    rf := nullif(concat_ws(': ', d ->> 'tipo', d ->> 'nome'), '');
    insert into auditoria (quem, tabela, chave, operacao, campos, antes, depois, ref)
    values (quem, tg_table_name, d ->> k, 'alterar', mud,
            (select jsonb_object_agg(c, a -> c) from unnest(mud) c), (select jsonb_object_agg(c, d -> c) from unnest(mud) c), rf);
    return new;
  end if;
  if to_jsonb(new) ? 'atualizado_por' then new.atualizado_por := quem; end if;
  d := to_jsonb(new) - 'geom' - 'geojson';
  rf := nullif(concat_ws(': ', d ->> 'tipo', d ->> 'nome'), '');
  insert into auditoria (quem, tabela, chave, operacao, depois, ref) values (quem, tg_table_name, d ->> k, 'incluir', d, rf);
  return new;
end $$;
revoke all on function tg_auditoria() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 10 Aceiros, estradas e trilhas
-- ---------------------------------------------------------------------
create table if not exists uc_via (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  tipo           text not null check (tipo in ('aceiro','estrada','trilha')),
  nome           text not null,                 -- nome do local
  municipio      text,
  ponto_ref      text,
  manutencao     text,                          -- data / periodicidade da construção ou manutenção, e por quem
  responsavel    text,                          -- quem constrói ou mantém
  largura_m      numeric(6,1) check (largura_m >= 0),
  comprimento_m  numeric(10,1) check (comprimento_m >= 0),   -- declarado no PIPCIF
  condicao       text check (condicao in ('bom','regular','ruim','inexistente')),
  condicao_obs   text,
  geojson        jsonb,                         -- LineString ou MultiLineString (lon, lat)
  tracado_origem text check (tracado_origem in ('pontos','desenho','arquivo')),
  tracado_em     timestamptz,
  geom           geometry(MultiLineString, 4674),
  compr_mapa_m   numeric(10,1),                 -- medido sobre o traçado
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);
create index if not exists uc_via_uc_idx on uc_via (nome_uc, tipo);
create index if not exists uc_via_geom_idx on uc_via using gist (geom);

-- traçado: valida (só linhas, em MG, até 20 mil vértices), gera a geometria e mede o comprimento
create or replace function tg_via_tracado() returns trigger
language plpgsql set search_path = public as $$
declare g geometry;
begin
  if tg_op = 'UPDATE' and new.geojson is not distinct from old.geojson then return new; end if;
  new.tracado_em := case when new.geojson is null then null else now() end;
  if new.geojson is null then new.geom := null; new.compr_mapa_m := null; new.tracado_origem := null; return new; end if;
  begin
    g := st_setsrid(st_geomfromgeojson(new.geojson::text), 4674);
  exception when others then
    raise exception 'Traçado inválido: %', sqlerrm;
  end;
  if geometrytype(g) not in ('LINESTRING','MULTILINESTRING') then raise exception 'O traçado deve ser uma linha.'; end if;
  if st_npoints(g) > 20000 then raise exception 'Traçado com vértices demais (%). Simplifique antes de enviar.', st_npoints(g); end if;
  if st_xmin(g) < -51.5 or st_xmax(g) > -39.5 or st_ymin(g) < -23.5 or st_ymax(g) > -14 then raise exception 'Traçado fora de Minas Gerais.'; end if;
  new.geom := st_multi(g);
  new.compr_mapa_m := round(st_length(new.geom::geography)::numeric, 1);
  return new;
end $$;
drop trigger if exists a_tracado on uc_via;
create trigger a_tracado before insert or update on uc_via for each row execute function tg_via_tracado();   -- antes da auditoria (ordem alfabética)

-- ---------------------------------------------------------------------
-- 11 Elementos favoráveis e adversos
-- ---------------------------------------------------------------------
create table if not exists uc_elemento (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  tipo           text not null check (tipo in ('favoravel','adverso')),
  categoria      text,                          -- infraestrutura, clima e relevo, ação humana…
  nome           text not null,                 -- o elemento, como descrito
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);
create index if not exists uc_elemento_uc_idx on uc_elemento (nome_uc, tipo);

-- ---------------------------------------------------------------------
-- 12 Cronograma de ações preventivas
-- ---------------------------------------------------------------------
create table if not exists uc_acao_preventiva (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  ano            int not null check (ano between 2000 and 2100),
  categoria      text,                          -- capacitação, sensibilização, aceiros, ronda…
  nome           text not null,                 -- atividade
  responsavel    text,
  mes_ini        smallint check (mes_ini between 1 and 12),
  mes_fim        smallint check (mes_fim between 1 and 12),
  periodo        text,                          -- como escrito (datas exatas, "mai–out"…)
  local          text,
  publico        text,
  situacao       text not null default 'planejada' check (situacao in ('planejada','em_andamento','realizada','adiada','nao_realizada')),
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);
create index if not exists uc_acao_preventiva_uc_idx on uc_acao_preventiva (nome_uc, ano);

-- ---------------------------------------------------------------------
-- 13 Projetos de sustentabilidade ambiental
-- ---------------------------------------------------------------------
create table if not exists uc_projeto (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  nome           text not null,                 -- identificação do projeto
  propriedade    text,
  tipo           text,                          -- Bolsa Verde, nascente, fomento, recuperação…
  descricao      text,
  responsavel    text,
  contatos       text,
  municipio      text,
  area_ha        numeric(12,2) check (area_ha >= 0),
  altitude       int,
  ponto_ref      text,
  proprietario   text,
  proprietario_contato text,
  data_inicio    text,
  situacao       text check (situacao in ('em_andamento','concluido','suspenso')),
  lat            numeric(10,6),
  lon            numeric(10,6),
  geom           geometry(Point, 4674) generated always as
                 (case when lat is not null and lon is not null then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now(),
  check (coord_mg_ok(lat, lon))
);
create index if not exists uc_projeto_uc_idx on uc_projeto (nome_uc);

-- ---------------------------------------------------------------------
-- 16 Brigadistas contratados: contratações por ano + rotina (em uc_infra)
-- ---------------------------------------------------------------------
create table if not exists uc_brigada (
  id             bigint generated always as identity primary key,
  nome_uc        text not null references uc(nome_uc) on update cascade on delete cascade,
  ano            int not null check (ano between 2000 and 2100),
  nome           text,                          -- contratante / programa (Previncêndio, compensação minerária…)
  quantidade     int check (quantidade >= 0),
  lideres        int check (lideres >= 0),
  mes_ini        smallint check (mes_ini between 1 and 12),
  mes_fim        smallint check (mes_fim between 1 and 12),
  veiculos       text,
  obs            text,
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);
create index if not exists uc_brigada_uc_idx on uc_brigada (nome_uc, ano);

alter table uc_infra add column if not exists brig_atividades text;
alter table uc_infra add column if not exists brig_rondas     text;
alter table uc_infra add column if not exists brig_plantao    text;

-- regras de acesso e auditoria
do $$
declare t text;
begin
  foreach t in array array['uc_via','uc_elemento','uc_acao_preventiva','uc_projeto','uc_brigada'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists usuario_le on %I', t);
    execute format('drop policy if exists edita on %I', t);
    execute format('create policy usuario_le on %I for select to authenticated using (is_usuario())', t);
    execute format('create policy edita on %I for all to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('revoke all on %I from anon', t);
    execute format('drop trigger if exists auditoria on %I', t);
    execute format('create trigger auditoria before insert or update or delete on %I for each row execute function tg_auditoria(''nome_uc'')', t);
  end loop;
end $$;

drop policy if exists usuario_le_auditoria on auditoria;
create policy usuario_le_auditoria on auditoria for select to authenticated
  using ((tabela in ('uc_cadastro','regional','uc_infra','uc_ponto','uc_veiculo','uc_radio','uc_material',
                     'uc_parceiro','uc_prestador','uc_colaborador',
                     'uc_via','uc_elemento','uc_acao_preventiva','uc_projeto','uc_brigada') and is_usuario())
         or (tabela = 'tramite' and is_tecnica()) or is_admin());

-- projetos entram na camada de pontos da rede (cadastro e painel)
create or replace view vw_uc_rede_geo with (security_invoker = true) as
select nome_uc, 'uc_radio'::text as tabela, id, case when origem = 'uc' then tipo else 'parceiro_' || tipo end as tipo,
       coalesce(nome, '') as nome, lat, lon, conservacao as situacao, dist_uc_km(nome_uc, geom) as dist_uc_km
  from uc_radio where geom is not null
union all
select nome_uc, 'uc_parceiro', id, 'parceiro', nome, lat, lon, null, dist_uc_km(nome_uc, geom) from uc_parceiro where geom is not null
union all
select nome_uc, 'uc_prestador', id, tipo, nome, lat, lon, null, dist_uc_km(nome_uc, geom) from uc_prestador where geom is not null
union all
select nome_uc, 'uc_colaborador', id, tipo, nome, lat, lon, null, dist_uc_km(nome_uc, geom) from uc_colaborador where geom is not null
union all
select nome_uc, 'uc_projeto', id, 'projeto', nome, lat, lon, situacao, dist_uc_km(nome_uc, geom) from uc_projeto where geom is not null;
grant select on vw_uc_rede_geo to authenticated;
revoke all on vw_uc_rede_geo from anon;

-- resumo do módulo para o Painel da UC
create or replace function uc_prevencao_resumo(p_nome_uc text) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'vias', (select coalesce(jsonb_object_agg(tipo, jsonb_build_object('n', n, 'km', km, 'tracados', tracados, 'ruins', ruins)), '{}') from (
               -- km: medido no traçado quando ele foi desenhado/importado; senão o declarado (início–fim é só aproximação)
               select tipo, count(*) n,
                      round(sum(case when tracado_origem in ('desenho','arquivo') then compr_mapa_m else coalesce(comprimento_m, compr_mapa_m) end) / 1000, 1) km,
                      count(*) filter (where tracado_origem in ('desenho','arquivo')) tracados, count(*) filter (where condicao in ('ruim','inexistente')) ruins
                 from uc_via where nome_uc = p_nome_uc group by tipo) v),
    'favoraveis', (select count(*) from uc_elemento where nome_uc = p_nome_uc and tipo = 'favoravel'),
    'adversos',   (select count(*) from uc_elemento where nome_uc = p_nome_uc and tipo = 'adverso'),
    'acoes_ano',  (select max(ano) from uc_acao_preventiva where nome_uc = p_nome_uc),
    'acoes',      (select count(*) from uc_acao_preventiva where nome_uc = p_nome_uc and ano = (select max(ano) from uc_acao_preventiva where nome_uc = p_nome_uc)),
    'acoes_feitas', (select count(*) from uc_acao_preventiva where nome_uc = p_nome_uc and situacao = 'realizada' and ano = (select max(ano) from uc_acao_preventiva where nome_uc = p_nome_uc)),
    'projetos',   (select count(*) from uc_projeto where nome_uc = p_nome_uc),
    'brigada',    (select jsonb_build_object('ano', ano, 'quantidade', sum(quantidade)) from uc_brigada where nome_uc = p_nome_uc
                    and ano = (select max(ano) from uc_brigada where nome_uc = p_nome_uc) group by ano))
$$;
grant execute on function uc_prevencao_resumo(text) to authenticated;
revoke all on function uc_prevencao_resumo(text) from anon, public;

comment on column uc_infra.nao_possui is
  'Itens que a UC declarou não possuir (conta como informado): tipos de uc_ponto, veiculo, radio_uc:<tipo>, radio_parceiro:<tipo>, material, parceiro, prestador:<tipo>, colaborador, brigadista, via:<tipo>, elemento, acao, projeto, brigada.';
