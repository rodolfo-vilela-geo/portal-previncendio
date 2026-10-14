-- =====================================================================
--  46 · Módulo 7 · Plano operacional da UC
--  · uc_setor: setores operacionais (polígonos) — desenhados, importados ou copiados do zoneamento;
--  · uc_operacional: parte da UC (cenários que se aplicam e ajustes, comando por porte, prontidão,
--    pós-incêndio, revisão com o CBMMG). A parte comum (protocolos) fica no código (modulo_operacional.js).
--  · setores_resumo(): o que cada setor tem por perto (pista, heliponto, água) e o histórico de fogo;
--  · setor_no_ponto(): setor onde cai uma coordenada (RI).
--  Leitura: usuários logados. Edição: quem edita a UC (pode_editar_uc). Histórico na auditoria.
-- =====================================================================
create table if not exists uc_setor (
  id            bigserial primary key,
  nome_uc       text not null references uc(nome_uc) on update cascade on delete cascade,
  nome          text not null,
  origem        text not null default 'desenhado' check (origem in ('desenhado', 'importado', 'zoneamento')),
  geom          geometry(MultiPolygon, 4674) not null,
  area_ha       numeric(14,2) generated always as (round((st_area(geom::geography) / 10000)::numeric, 2)) stored,
  acesso        text,      -- como chegar: estradas, trilhas, 4x4, tempo de deslocamento
  agua          text,      -- pontos de água para o combate
  apoio         text,      -- base, ponto de apoio, parceiro de referência
  obs           text,
  ordem         int,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
create index if not exists uc_setor_geom_idx on uc_setor using gist (geom);
create index if not exists uc_setor_uc_idx on uc_setor (nome_uc);
comment on table uc_setor is 'Setores operacionais da UC (módulo 7). Base da lista "Setor da UC" no RI.';
alter table uc_setor enable row level security;
create policy setor_le on uc_setor for select to authenticated using (is_usuario());
create policy setor_edita on uc_setor for all to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc));
grant select, insert, update, delete on uc_setor to authenticated;
grant usage on sequence uc_setor_id_seq to authenticated;
revoke all on uc_setor from anon;
create trigger setor_auditoria before insert or update or delete on uc_setor for each row execute function tg_auditoria('nome_uc');

create table if not exists uc_operacional (
  nome_uc       text primary key references uc(nome_uc) on update cascade on delete cascade,
  cenarios      jsonb not null default '{}',   -- {codigo: {aplica: true|false|null, ajuste: texto}}
  comando       jsonb not null default '{}',   -- {pequeno: [{funcao, responsavel, contato}], grande: [...]}
  prontidao     jsonb not null default '{}',   -- {escala, plantao, dias_risco, obs}
  pos_obs       text,
  revisao       jsonb not null default '{}',   -- {data, cbmmg, participantes, obs}
  obs           text,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
comment on table uc_operacional is 'Plano operacional da UC (módulo 7, seção 15 do PIPCIF): parte da UC. A parte comum vem dos protocolos conjuntos.';
alter table uc_operacional enable row level security;
create policy oper_le on uc_operacional for select to authenticated using (is_usuario());
create policy oper_edita on uc_operacional for all to authenticated using (pode_editar_uc(nome_uc)) with check (pode_editar_uc(nome_uc));
grant select, insert, update, delete on uc_operacional to authenticated;
revoke all on uc_operacional from anon;
create trigger operacional_auditoria before insert or update or delete on uc_operacional for each row execute function tg_auditoria('nome_uc');

-- O que cada setor tem por perto e o histórico de fogo dentro dele
create or replace function setores_resumo(p_nome_uc text)
returns json language sql stable security definer set search_path = public, extensions as $$
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
    'id', s.id,
    'pista', (select json_build_object('id', r.id, 'nome', r.nome, 'tipo', r.tipo, 'km', round((st_distance(r.geom::geography, s.geom::geography) / 1000)::numeric, 1),
                'comprimento_m', r.comprimento_m, 'largura_m', r.largura_m, 'superficie', r.superficie, 'agua', r.agua, 'recebe_at802', r.recebe_at802,
                'situacao', r.situacao)
              from recurso_aereo r where r.situacao <> 'inativo' and r.tipo in ('aerodromo_publico','aerodromo_privado','aerodromo_militar','pista_nao_registrada')
              order by r.geom <-> s.geom limit 1),
    'pista_at802', (select json_build_object('id', r.id, 'nome', r.nome, 'km', round((st_distance(r.geom::geography, s.geom::geography) / 1000)::numeric, 1))
              from recurso_aereo r where r.situacao <> 'inativo' and r.tipo in ('aerodromo_publico','aerodromo_privado','aerodromo_militar','pista_nao_registrada')
                and r.comprimento_m >= 1000 and coalesce(r.largura_m, 25) >= 25 and coalesce(r.recebe_at802, '') <> 'nao'
                and st_dwithin(r.geom::geography, s.geom::geography, 17000)
              order by r.geom <-> s.geom limit 1),
    'heliponto', (select json_build_object('id', r.id, 'nome', r.nome, 'tipo', r.tipo, 'km', round((st_distance(r.geom::geography, s.geom::geography) / 1000)::numeric, 1))
              from recurso_aereo r where r.situacao <> 'inativo' and r.tipo in ('heliponto','area_pouso')
              order by r.geom <-> s.geom limit 1),
    'agua', (select json_build_object('nome', p.nome, 'km', round((st_distance(p.geom::geography, s.geom::geography) / 1000)::numeric, 1))
              from uc_ponto p where p.nome_uc = s.nome_uc and p.tipo = 'agua' and p.geom is not null
              order by p.geom <-> s.geom limit 1),
    'ocorrencias', (select count(distinct o.cod_bdp) from roi o
                     where o.ano between 2013 and 2025
                       and ((o.geom is not null and st_intersects(o.geom, s.geom))
                            or exists (select 1 from area_queimada a where a.cod_bdp = o.cod_bdp and a.geom && s.geom and st_intersects(a.geom, s.geom)))),
    'queimado_ha', (select round((sum(st_area(st_intersection(a.geom, s.geom)::geography)) / 10000)::numeric, 1)
              from area_queimada a join roi o on o.cod_bdp = a.cod_bdp
             where a.geom && s.geom and st_intersects(a.geom, s.geom) and o.ano between 2013 and 2025),
    'zonas', (select string_agg(distinct z.zona, '; ') from uc_zoneamento z where z.nome_uc = s.nome_uc and st_intersects(z.geom, s.geom)
                and st_area(st_intersection(z.geom, s.geom)) > 0.05 * st_area(s.geom))
  ) order by s.ordem nulls last, s.nome), '[]'::json) end
  from uc_setor s where s.nome_uc = p_nome_uc;
$$;
revoke all on function setores_resumo(text) from public, anon;
grant execute on function setores_resumo(text) to authenticated;

create or replace function setor_no_ponto(p_lat float8, p_lon float8, p_nome_uc text default null)
returns table (id bigint, nome_uc text, nome text)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, s.nome_uc, s.nome from uc_setor s
   where is_usuario() and (p_nome_uc is null or s.nome_uc = p_nome_uc)
     and st_intersects(s.geom, st_setsrid(st_makepoint(p_lon, p_lat), 4674))
   order by s.ordem nulls last, s.nome;
$$;
revoke all on function setor_no_ponto(float8, float8, text) from public, anon;
grant execute on function setor_no_ponto(float8, float8, text) to authenticated;

-- Setores com o desenho (GeoJSON), para o mapa do módulo
create or replace function setores_geo(p_nome_uc text)
returns json language sql stable security definer set search_path = public, extensions as $$
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
           'id', s.id, 'nome', s.nome, 'origem', s.origem, 'area_ha', s.area_ha, 'acesso', s.acesso, 'agua', s.agua, 'apoio', s.apoio,
           'obs', s.obs, 'ordem', s.ordem, 'atualizado_por', s.atualizado_por, 'atualizado_em', s.atualizado_em,
           'geom', st_asgeojson(s.geom, 6, 0)::json) order by s.ordem nulls last, s.nome), '[]'::json) end
  from uc_setor s where s.nome_uc = p_nome_uc;
$$;
revoke all on function setores_geo(text) from public, anon;
grant execute on function setores_geo(text) to authenticated;

-- Grava um setor (novo ou existente). security invoker: vale a permissão de quem edita a UC.
create or replace function setor_salvar(p_id bigint, p_nome_uc text, p_dados jsonb, p_geom jsonb default null)
returns bigint language plpgsql security invoker set search_path = public, extensions as $$
declare g geometry; nid bigint; t text := nullif(trim(p_dados ->> 'nome'), '');
begin
  if p_geom is not null then
    g := st_multi(st_collectionextract(st_makevalid(st_setsrid(st_force2d(st_geomfromgeojson(p_geom)), 4674)), 3));
    if g is null or st_isempty(g) then raise exception 'O desenho do setor não forma uma área válida.'; end if;
  end if;
  if p_id is null then
    if g is null then raise exception 'Desenhe o setor no mapa.'; end if;
    insert into uc_setor (nome_uc, nome, origem, geom, acesso, agua, apoio, obs, ordem)
    values (p_nome_uc, coalesce(t, 'Setor'), coalesce(nullif(p_dados ->> 'origem', ''), 'desenhado'), g,
            nullif(trim(p_dados ->> 'acesso'), ''), nullif(trim(p_dados ->> 'agua'), ''), nullif(trim(p_dados ->> 'apoio'), ''),
            nullif(trim(p_dados ->> 'obs'), ''), nullif(p_dados ->> 'ordem', '')::int)
    returning id into nid;
  else
    update uc_setor set nome = coalesce(t, nome), acesso = nullif(trim(p_dados ->> 'acesso'), ''), agua = nullif(trim(p_dados ->> 'agua'), ''),
           apoio = nullif(trim(p_dados ->> 'apoio'), ''), obs = nullif(trim(p_dados ->> 'obs'), ''),
           ordem = coalesce(nullif(p_dados ->> 'ordem', '')::int, ordem), geom = coalesce(g, geom)
     where id = p_id and nome_uc = p_nome_uc returning id into nid;
    if nid is null then raise exception 'Setor não encontrado ou sem permissão para editar esta UC.'; end if;
  end if;
  return nid;
end $$;
revoke all on function setor_salvar(bigint, text, jsonb, jsonb) from public, anon;
grant execute on function setor_salvar(bigint, text, jsonb, jsonb) to authenticated;

-- Zoneamento de uma UC (para o mapa do módulo e para copiar zonas como setores)
create or replace function zoneamento_uc(p_nome_uc text)
returns json language sql stable security definer set search_path = public, extensions as $$
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
           'id', z.id, 'zona', z.zona, 'sigla', z.sigla, 'fonte', z.fonte, 'area_ha', z.area_ha,
           'geom', st_asgeojson(z.geom, 6, 0)::json) order by z.zona), '[]'::json) end
  from uc_zoneamento z where z.nome_uc = p_nome_uc;
$$;
revoke all on function zoneamento_uc(text) from public, anon;
grant execute on function zoneamento_uc(text) to authenticated;
