-- 51 — Módulo Análise de Incêndio Florestal (Monitoramento e Investigação): imóveis rurais (CAR / importados / desenhados),
-- busca do CAR no SICAR em volta das UCs (pg_net, direto do banco), cruzamento com as áreas queimadas do BDG e ficha do imóvel.
-- Acesso: só Previncêndio e Sala Técnica (is_tecnica() = tecnica, gpcif, admin). Nada aqui é público.
create extension if not exists pg_net;

-- ---------------------------------------------------------------- tabelas
create table if not exists imovel (
  id              bigint generated always as identity primary key,
  origem          text not null check (origem in ('car','importado','desenhado')),
  cod_car         text unique,                 -- código do imóvel no SICAR (MG-3104502-...)
  nome            text,                        -- nome dado pela equipe (importado/desenhado) ou apelido
  municipio       text,
  cod_ibge        int,
  car_status      text,                        -- AT ativo, PE pendente, SU suspenso, CA cancelado
  car_condicao    text,                        -- situação da análise no SICAR
  car_tipo        text,                        -- IRU, AST (assentamento), PCT (povos e comunidades tradicionais)
  car_area_ha     numeric,
  car_modulos     numeric,                     -- módulos fiscais
  car_criacao     timestamptz,
  car_atualizacao timestamptz,
  car_visto_em    timestamptz,                 -- última busca em que o imóvel veio do SICAR
  ucs             text[] not null default '{}',-- UCs em cuja área de busca o imóvel está
  area_ha         numeric,
  geom            geometry(MultiPolygon,4674) not null,
  obs             text,
  criado_em       timestamptz not null default now(),
  criado_por      text default lower(auth.jwt() ->> 'email'),
  atualizado_em   timestamptz,
  atualizado_por  text
);
create index if not exists imovel_geom_idx on imovel using gist (geom);
create index if not exists imovel_ucs_idx on imovel using gin (ucs);

create table if not exists imovel_versao (           -- limites antigos do CAR (retificações)
  id              bigint generated always as identity primary key,
  imovel_id       bigint not null references imovel(id) on delete cascade,
  geom            geometry(MultiPolygon,4674),
  area_ha         numeric,
  car_status      text,
  car_condicao    text,
  car_atualizacao timestamptz,
  guardado_em     timestamptz not null default now()
);
create index if not exists imovel_versao_im_idx on imovel_versao (imovel_id);

create table if not exists imovel_fogo (             -- cicatriz do BDG x imóvel (mantida pelos gatilhos)
  imovel_id        bigint not null references imovel(id) on delete cascade,
  area_queimada_id bigint not null references area_queimada(id) on delete cascade,
  cod_bdp          text not null,
  ano              int,
  area_ha          numeric,                          -- área queimada dentro do imóvel
  pct              numeric,                          -- % do imóvel atingido
  primary key (imovel_id, area_queimada_id)
);
create index if not exists imovel_fogo_cod_idx on imovel_fogo (cod_bdp);

create table if not exists imovel_nota (             -- anotações da investigação (proprietário, campo, conclusões)
  id         bigint generated always as identity primary key,
  imovel_id  bigint not null references imovel(id) on delete cascade,
  tipo       text not null default 'anotacao' check (tipo in ('anotacao','proprietario','campo','conclusao')),
  texto      text not null,
  criado_em  timestamptz not null default now(),
  criado_por text default lower(auth.jwt() ->> 'email')
);
create index if not exists imovel_nota_im_idx on imovel_nota (imovel_id);

create table if not exists car_busca (                -- cada busca do CAR em volta de uma UC
  id           bigint generated always as identity primary key,
  nome_uc      text not null references uc(nome_uc) on update cascade,
  faixa_km     numeric not null,
  area         geometry(MultiPolygon,4674),
  pedidos      int not null default 0,
  recebidos    int not null default 0,
  falhas       int not null default 0,
  imoveis      int not null default 0,
  novos        int not null default 0,
  alterados    int not null default 0,
  status       text not null default 'buscando' check (status in ('buscando','pronto','erro')),
  erro         text,
  iniciado_em  timestamptz not null default now(),
  concluido_em timestamptz,
  pedido_por   text default lower(auth.jwt() ->> 'email')
);
create table if not exists car_pedido (                -- um pedido WFS por quadrícula
  busca_id   bigint not null references car_busca(id) on delete cascade,
  request_id bigint not null,
  bbox       text not null,
  tentativas int not null default 1,
  status     text not null default 'esperando' check (status in ('esperando','ok','falha')),
  n          int,
  primary key (busca_id, request_id)
);

-- ---------------------------------------------------------------- RLS (só Previncêndio e Sala Técnica)
alter table imovel enable row level security;
alter table imovel_versao enable row level security;
alter table imovel_fogo enable row level security;
alter table imovel_nota enable row level security;
alter table car_busca enable row level security;
alter table car_pedido enable row level security;
drop policy if exists imovel_ler on imovel;           create policy imovel_ler on imovel for select to authenticated using (is_tecnica());
drop policy if exists imovel_incluir on imovel;       create policy imovel_incluir on imovel for insert to authenticated with check (is_tecnica() and origem <> 'car');
drop policy if exists imovel_alterar on imovel;       create policy imovel_alterar on imovel for update to authenticated using (is_tecnica()) with check (is_tecnica());
drop policy if exists imovel_excluir on imovel;       create policy imovel_excluir on imovel for delete to authenticated using (is_tecnica() and origem <> 'car');
drop policy if exists imovel_versao_ler on imovel_versao; create policy imovel_versao_ler on imovel_versao for select to authenticated using (is_tecnica());
drop policy if exists imovel_fogo_ler on imovel_fogo; create policy imovel_fogo_ler on imovel_fogo for select to authenticated using (is_tecnica());
drop policy if exists imovel_nota_ler on imovel_nota; create policy imovel_nota_ler on imovel_nota for select to authenticated using (is_tecnica());
drop policy if exists imovel_nota_incluir on imovel_nota; create policy imovel_nota_incluir on imovel_nota for insert to authenticated with check (is_tecnica());
drop policy if exists imovel_nota_excluir on imovel_nota; create policy imovel_nota_excluir on imovel_nota for delete to authenticated
  using (is_tecnica() and (criado_por = lower(auth.jwt() ->> 'email') or is_gpcif()));
drop policy if exists car_busca_ler on car_busca;     create policy car_busca_ler on car_busca for select to authenticated using (is_tecnica());
drop policy if exists car_pedido_ler on car_pedido;   create policy car_pedido_ler on car_pedido for select to authenticated using (is_tecnica());
revoke all on imovel, imovel_versao, imovel_fogo, imovel_nota, car_busca, car_pedido from anon;
grant select, insert, update, delete on imovel, imovel_nota to authenticated;
grant select on imovel_versao, imovel_fogo, car_busca, car_pedido to authenticated;

-- ---------------------------------------------------------------- geometria e cruzamento com o BDG
create or replace function poligono_valido(g geometry) returns geometry
language sql immutable as $$
  select st_multi(st_collectionextract(st_makevalid(st_force2d(st_setsrid(g, 4674))), 3))::geometry(MultiPolygon,4674)
$$;

-- recalcula as cicatrizes de um imóvel
create or replace function imovel_fogo_calc(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from imovel_fogo where imovel_id = p_id;
  insert into imovel_fogo (imovel_id, area_queimada_id, cod_bdp, ano, area_ha, pct)
  select i.id, a.id, a.cod_bdp, coalesce(r.ano, nullif(left(a.cod_bdp, 4), '')::int),
         round((st_area(x.g::geography) / 10000)::numeric, 2),
         round((100 * st_area(x.g::geography) / nullif(st_area(i.geom::geography), 0))::numeric, 1)
  from imovel i
  join area_queimada a on st_intersects(a.geom, i.geom)
  left join roi r on r.cod_bdp = a.cod_bdp
  cross join lateral (select st_intersection(st_makevalid(a.geom), i.geom) g) x
  where i.id = p_id and not st_isempty(x.g) and st_area(x.g::geography) >= 100;   -- ignora toques de menos de 0,01 ha
end $$;

create or replace function tg_imovel_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.geom is distinct from old.geom then
    new.geom := poligono_valido(new.geom);
    new.area_ha := round((st_area(new.geom::geography) / 10000)::numeric, 2);
    if new.origem <> 'car' or cardinality(new.ucs) = 0 then          -- UCs perto (UC/ZA + 5 km)
      new.ucs := array(select distinct u from unnest(new.ucs || array(
        select distinct l.nome_uc from uc_limite l where st_dwithin(l.geom::geography, new.geom::geography, 5000))) u order by 1);
    end if;
  end if;
  return new;
end $$;
create or replace function tg_imovel_depois() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.geom is distinct from old.geom then perform imovel_fogo_calc(new.id); end if;
  return null;
end $$;
drop trigger if exists imovel_antes on imovel;
create trigger imovel_antes before insert or update on imovel for each row execute function tg_imovel_antes();
drop trigger if exists imovel_depois on imovel;
create trigger imovel_depois after insert or update of geom on imovel for each row execute function tg_imovel_depois();
drop trigger if exists imovel_auditoria on imovel;
create trigger imovel_auditoria before insert or update or delete on imovel for each row execute function tg_auditoria('id');
drop trigger if exists imovel_nota_auditoria on imovel_nota;
create trigger imovel_nota_auditoria before insert or delete on imovel_nota for each row execute function tg_auditoria('id');

-- polígono novo (ou alterado) no BDG: atualiza os imóveis que ele toca
create or replace function tg_area_queimada_imovel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from imovel_fogo where area_queimada_id = new.id;
  insert into imovel_fogo (imovel_id, area_queimada_id, cod_bdp, ano, area_ha, pct)
  select i.id, new.id, new.cod_bdp, coalesce((select r.ano from roi r where r.cod_bdp = new.cod_bdp limit 1), nullif(left(new.cod_bdp, 4), '')::int),
         round((st_area(x.g::geography) / 10000)::numeric, 2),
         round((100 * st_area(x.g::geography) / nullif(st_area(i.geom::geography), 0))::numeric, 1)
  from imovel i cross join lateral (select st_intersection(st_makevalid(new.geom), i.geom) g) x
  where st_intersects(i.geom, new.geom) and not st_isempty(x.g) and st_area(x.g::geography) >= 100;
  return null;
end $$;
drop trigger if exists area_queimada_imovel on area_queimada;
create trigger area_queimada_imovel after insert or update of geom, cod_bdp on area_queimada for each row execute function tg_area_queimada_imovel();

-- ---------------------------------------------------------------- busca do CAR (SICAR, WFS) em volta de uma UC
-- Divide a área (UC + ZA + faixa) em quadrículas e pede cada uma ao GeoServer do SICAR pelo pg_net (assíncrono).
create or replace function car_buscar(p_uc text, p_faixa_km numeric default 5) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare b bigint; ar geometry; ex box2d; passo float8 := 0.05; x float8; y float8; rq bigint; n int := 0;
begin
  if not is_tecnica() then raise exception 'Somente Previncêndio e Sala Técnica.'; end if;
  if p_faixa_km is null or p_faixa_km < 0 or p_faixa_km > 20 then raise exception 'Faixa entre 0 e 20 km.'; end if;
  select id into b from car_busca where nome_uc = p_uc and status = 'buscando' and iniciado_em > now() - interval '15 minutes' order by id desc limit 1;
  if b is not null then return b; end if;
  select poligono_valido(st_buffer(st_union(geom)::geography, p_faixa_km * 1000)::geometry) into ar from uc_limite where nome_uc = p_uc;
  if ar is null then raise exception 'UC sem limite cadastrado: %', p_uc; end if;
  insert into car_busca (nome_uc, faixa_km, area) values (p_uc, p_faixa_km, ar) returning id into b;
  ex := st_extent(ar);
  x := floor(st_xmin(ex) / passo) * passo;
  while x < st_xmax(ex) loop
    y := floor(st_ymin(ex) / passo) * passo;
    while y < st_ymax(ex) loop
      if st_intersects(ar, st_makeenvelope(x, y, x + passo, y + passo, 4674)) then
        select net.http_get(
          'https://geoserver.car.gov.br/geoserver/sicar/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=sicar:sicar_imoveis_mg'
          || '&outputFormat=application/json&srsName=EPSG:4674&bbox=' || concat_ws(',', round(x::numeric, 4), round(y::numeric, 4), round((x + passo)::numeric, 4), round((y + passo)::numeric, 4)) || ',EPSG:4674',
          timeout_milliseconds := 120000) into rq;
        insert into car_pedido (busca_id, request_id, bbox) values (b, rq, concat_ws(',', x, y, x + passo, y + passo));
        n := n + 1;
      end if;
      y := y + passo;
    end loop;
    x := x + passo;
  end loop;
  update car_busca set pedidos = n where id = b;
  return b;
end $$;

-- Processa as respostas que já chegaram (chamada repetida pela página até terminar; cada chamada trabalha ~3,5 s, abaixo dos 8 s do PostgREST).
create or replace function car_processar(p_busca bigint) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare bu car_busca; pe record; rs record; js jsonb; nn int; na int; ni int; rq bigint;
begin
  if not is_tecnica() then raise exception 'Somente Previncêndio e Sala Técnica.'; end if;
  select * into bu from car_busca where id = p_busca;
  if bu.id is null then raise exception 'Busca não encontrada.'; end if;
  perform set_config('portal.sem_auditoria', '1', true);
  for pe in select * from car_pedido where busca_id = p_busca and status = 'esperando' order by request_id loop
    exit when clock_timestamp() - statement_timestamp() > interval '3500 milliseconds';
    select status_code, content, timed_out, error_msg into rs from net._http_response where id = pe.request_id;
    if not found then
      continue;                                               -- ainda não chegou
    end if;
    if rs.status_code is distinct from 200 or rs.content is null or left(ltrim(rs.content), 1) <> '{' then
      if pe.tentativas < 3 then                               -- tenta de novo
        select net.http_get('https://geoserver.car.gov.br/geoserver/sicar/wfs?service=WFS&version=1.0.0&request=GetFeature&typeName=sicar:sicar_imoveis_mg'
          || '&outputFormat=application/json&srsName=EPSG:4674&bbox=' || pe.bbox || ',EPSG:4674', timeout_milliseconds := 120000) into rq;
        update car_pedido set request_id = rq, tentativas = pe.tentativas + 1 where busca_id = p_busca and request_id = pe.request_id;
      else
        update car_pedido set status = 'falha' where busca_id = p_busca and request_id = pe.request_id;
        update car_busca set falhas = falhas + 1 where id = p_busca;
      end if;
      continue;
    end if;
    js := rs.content::jsonb;
    with f as (
      select distinct on (e -> 'properties' ->> 'cod_imovel') e -> 'properties' ->> 'cod_imovel' cod, e -> 'properties' p,
             poligono_valido(st_geomfromgeojson((e -> 'geometry')::text)) geom
      from jsonb_array_elements(js -> 'features') e
      where jsonb_typeof(e -> 'geometry') = 'object' and (e -> 'properties' ->> 'cod_imovel') is not null),
    c as (select * from f where geom is not null and not st_isempty(geom) and st_intersects(geom, bu.area)),
    cnt as (select count(*) filter (where i.id is null)::int nn, count(*) filter (where i.id is not null and not st_equals(i.geom, c.geom))::int na, count(*)::int ni
            from c left join imovel i on i.cod_car = c.cod),
    -- guarda a versão antiga de quem mudou no SICAR
    v as (insert into imovel_versao (imovel_id, geom, area_ha, car_status, car_condicao, car_atualizacao)
          select i.id, i.geom, i.area_ha, i.car_status, i.car_condicao, i.car_atualizacao
          from imovel i join c on c.cod = i.cod_car
          where (c.p ->> 'data_atualizacao')::timestamptz is distinct from i.car_atualizacao and not st_equals(i.geom, c.geom)
          returning 1),
    u as (insert into imovel as m (origem, cod_car, municipio, cod_ibge, car_status, car_condicao, car_tipo, car_area_ha, car_modulos, car_criacao, car_atualizacao,
                                   car_visto_em, ucs, geom, criado_por)
          select 'car', c.cod, c.p ->> 'municipio', (c.p ->> 'cod_municipio_ibge')::int, c.p ->> 'status_imovel', c.p ->> 'condicao', c.p ->> 'tipo_imovel',
                 (c.p ->> 'area')::numeric, (c.p ->> 'm_fiscal')::numeric, (c.p ->> 'dat_criacao')::timestamptz, (c.p ->> 'data_atualizacao')::timestamptz,
                 now(), array[bu.nome_uc], c.geom, 'SICAR'
          from c
          on conflict (cod_car) do update set
            municipio = excluded.municipio, cod_ibge = excluded.cod_ibge, car_status = excluded.car_status, car_condicao = excluded.car_condicao,
            car_tipo = excluded.car_tipo, car_area_ha = excluded.car_area_ha, car_modulos = excluded.car_modulos, car_criacao = excluded.car_criacao,
            car_atualizacao = excluded.car_atualizacao, car_visto_em = now(),
            ucs = array(select distinct x from unnest(m.ucs || excluded.ucs) x order by 1),
            geom = case when st_equals(m.geom, excluded.geom) then m.geom else excluded.geom end
          returning 1)
    select cnt.nn, cnt.na, cnt.ni into nn, na, ni from cnt;
    update car_pedido set status = 'ok', n = ni where busca_id = p_busca and request_id = pe.request_id;
    update car_busca set recebidos = recebidos + 1, novos = novos + nn, alterados = alterados + na where id = p_busca;
  end loop;
  -- terminou?
  if not exists (select 1 from car_pedido where busca_id = p_busca and status = 'esperando') then
    update car_busca set status = case when falhas > 0 and recebidos = 0 then 'erro' else 'pronto' end,
      erro = case when falhas > 0 then falhas || ' quadrícula(s) sem resposta do SICAR' end,
      imoveis = (select count(*) from imovel where bu.nome_uc = any(ucs) and origem = 'car'), concluido_em = coalesce(concluido_em, now())
    where id = p_busca and status = 'buscando';
  elsif bu.iniciado_em < now() - interval '30 minutes' then
    update car_pedido set status = 'falha' where busca_id = p_busca and status = 'esperando';
    update car_busca set status = 'erro', erro = 'O SICAR não respondeu a tempo.', concluido_em = now() where id = p_busca;
  end if;
  return (select json_build_object('id', id, 'status', status, 'pedidos', pedidos, 'recebidos', recebidos, 'falhas', falhas, 'novos', novos,
          'alterados', alterados, 'imoveis', imoveis, 'erro', erro, 'iniciado_em', iniciado_em, 'concluido_em', concluido_em) from car_busca where id = p_busca);
end $$;

-- ---------------------------------------------------------------- leitura para a página
-- imóveis de uma UC (ou de todas as UCs, se p_uc for nulo) com o resumo do fogo; geometria simplificada
create or replace function geo_imoveis(p_uc text default null, p_tol float8 default 0.00004)
returns table (id bigint, origem text, cod_car text, nome text, municipio text, car_status text, car_condicao text, car_tipo text, area_ha numeric,
               anos int, ocorrencias int, area_queimada_ha numeric, maior_pct numeric, primeiro int, ultimo int, anos_lista int[], geom jsonb)
language sql stable security definer set search_path = public as $$
  select i.id, i.origem, i.cod_car, i.nome, i.municipio, i.car_status, i.car_condicao, i.car_tipo, i.area_ha,
         coalesce(f.anos, 0), coalesce(f.ocorr, 0), coalesce(f.area, 0), coalesce(f.maior, 0), f.primeiro, f.ultimo, coalesce(f.lista, '{}'),
         st_asgeojson(st_simplifypreservetopology(i.geom, p_tol), 6)::jsonb
  from imovel i
  left join lateral (select count(distinct fo.ano)::int anos, count(distinct fo.cod_bdp)::int ocorr, sum(fo.area_ha) area, max(fo.pct) maior,
                            min(fo.ano) primeiro, max(fo.ano) ultimo, array_agg(distinct fo.ano order by fo.ano) lista
                     from imovel_fogo fo left join roi r on r.cod_bdp = fo.cod_bdp
                     where fo.imovel_id = i.id and coalesce(r.status, '') <> 'cancelado') f on true
  where is_tecnica() and (p_uc is null or p_uc = any(i.ucs))
$$;

-- ficha completa de um imóvel
create or replace function imovel_ficha(p_id bigint) returns json
language plpgsql stable security definer set search_path = public as $$
declare i imovel; r json; mon numeric;
begin
  if not is_tecnica() then raise exception 'Somente Previncêndio e Sala Técnica.'; end if;
  select * into i from imovel where id = p_id;
  if i.id is null then return null; end if;
  -- parte do imóvel dentro das UCs/ZAs (onde o BDG tem cicatrizes mapeadas)
  select round((100 * st_area(st_intersection(i.geom, st_union(l.geom))::geography) / nullif(st_area(i.geom::geography), 0))::numeric, 1)
    into mon from uc_limite l where st_intersects(l.geom, i.geom);
  select json_build_object(
    'imovel', (select to_jsonb(i) - 'geom' || jsonb_build_object('geom', st_asgeojson(i.geom, 6)::jsonb)),
    'monitorado_pct', coalesce(mon, 0),
    'versoes', (select coalesce(json_agg(json_build_object('car_atualizacao', v.car_atualizacao, 'guardado_em', v.guardado_em, 'area_ha', v.area_ha, 'car_status', v.car_status,
                       'geom', st_asgeojson(st_simplifypreservetopology(v.geom, 0.00002), 6)::jsonb) order by v.guardado_em), '[]') from imovel_versao v where v.imovel_id = i.id),
    'fogo', (select coalesce(json_agg(x order by x.ano, x.dh_detec nulls last), '[]') from (
        select f.cod_bdp, f.ano, f.area_ha area_imovel_ha, f.pct,
               r.ri, r.nome_uc, r.nome_local, r.municipio, r.dat_detec, r.hr_detec, r.dh_detec, r.dh_comb, r.dh_final, r.f_detec,
               r.causa_p, r.causa_out, r.ag_causal, r.ag_out, r.ind_aut, r.proprietario, r.descricao,
               coalesce(r.area_int, 0) + coalesce(r.area_ent, 0) area_total_ha, r.lat, r.lon,
               case when r.lat is not null and r.lon is not null then st_intersects(i.geom, st_setsrid(st_makepoint(r.lon, r.lat), 4674)) end inicio_dentro,
               st_asgeojson(st_simplifypreservetopology(st_intersection(st_makevalid(a.geom), i.geom), 0.00002), 6)::jsonb geom_dentro,
               st_asgeojson(st_simplifypreservetopology(a.geom, 0.00003), 6)::jsonb geom
        from imovel_fogo f join area_queimada a on a.id = f.area_queimada_id left join roi r on r.cod_bdp = f.cod_bdp
        where f.imovel_id = i.id and coalesce(r.status, '') <> 'cancelado') x),
    'pontos_ri', (select coalesce(json_agg(json_build_object('ano', ri.ano, 'ri', ri.ri, 'nome_uc', ri.nome_uc, 'dat_detec', ri.dat_detec, 'hr_detec', ri.hr_detec,
                       'status', ri.status, 'local', ri.local, 'lat', ri.lat, 'lon', ri.lon,
                       'distancia_m', round(st_distance(i.geom::geography, ri.geom::geography)::numeric)) order by ri.ano, ri.ri), '[]')
                  from ri where ri.geom is not null and st_dwithin(i.geom::geography, ri.geom::geography, 1000)),
    'sobreposicoes', (select coalesce(json_agg(json_build_object('id', o.id, 'cod_car', o.cod_car, 'nome', o.nome, 'origem', o.origem, 'car_status', o.car_status,
                       'area_comum_ha', round((st_area(st_intersection(o.geom, i.geom)::geography) / 10000)::numeric, 2))), '[]')
                  from imovel o where o.id <> i.id and st_intersects(o.geom, i.geom)
                   and st_area(st_intersection(o.geom, i.geom)::geography) > 1000),
    'notas', (select coalesce(json_agg(json_build_object('id', n.id, 'tipo', n.tipo, 'texto', n.texto, 'criado_em', n.criado_em, 'criado_por', n.criado_por) order by n.criado_em desc), '[]')
              from imovel_nota n where n.imovel_id = i.id)
  ) into r;
  return r;
end $$;

-- inclui um imóvel importado ou desenhado (uma geometria GeoJSON)
create or replace function imovel_incluir(p_geojson jsonb, p_nome text, p_origem text default 'importado', p_cod_car text default null,
                                          p_municipio text default null, p_obs text default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare g geometry; novo bigint;
begin
  if not is_tecnica() then raise exception 'Somente Previncêndio e Sala Técnica.'; end if;
  if p_origem not in ('importado','desenhado') then raise exception 'Origem inválida.'; end if;
  g := poligono_valido(st_geomfromgeojson(p_geojson::text));
  if g is null or st_isempty(g) then raise exception 'O arquivo não tem polígono.'; end if;
  if not st_intersects(g, st_makeenvelope(-51.5, -23.5, -39.5, -14, 4674)) then raise exception 'O polígono está fora de Minas Gerais (confira o sistema de coordenadas).'; end if;
  if st_area(g::geography) > 2e9 then raise exception 'Polígono grande demais para um imóvel (mais de 200 mil ha).'; end if;
  if nullif(trim(p_cod_car), '') is not null and exists (select 1 from imovel where cod_car = upper(trim(p_cod_car))) then
    raise exception 'Já existe um imóvel com este código do CAR.';
  end if;
  insert into imovel (origem, cod_car, nome, municipio, obs, geom)
  values (p_origem, upper(nullif(trim(p_cod_car), '')), nullif(trim(p_nome), ''),
          coalesce(nullif(trim(p_municipio), ''), (select m.nome from municipio m where st_intersects(m.geom, st_pointonsurface(g)) limit 1)),
          nullif(trim(p_obs), ''), g)
  returning id into novo;
  return novo;
end $$;

-- última busca do CAR de cada UC
create or replace function car_situacao(p_uc text) returns json
language sql stable security definer set search_path = public as $$
  select case when is_tecnica() then (select json_build_object('id', id, 'status', status, 'faixa_km', faixa_km, 'pedidos', pedidos, 'recebidos', recebidos,
          'falhas', falhas, 'novos', novos, 'alterados', alterados, 'imoveis', imoveis, 'erro', erro, 'iniciado_em', iniciado_em, 'concluido_em', concluido_em,
          'pedido_por', pedido_por) from car_busca where nome_uc = p_uc order by id desc limit 1) end
$$;

-- resumo por UC (tela inicial do módulo)
create or replace function car_resumo() returns json
language sql stable security definer set search_path = public as $$
  select case when is_tecnica() then coalesce(json_agg(x order by x.nome_uc), '[]') end from (
    select b.nome_uc, b.concluido_em, b.faixa_km, b.status,
           (select count(*) from imovel i where b.nome_uc = any(i.ucs)) imoveis,
           (select count(*) from imovel i where b.nome_uc = any(i.ucs) and exists (select 1 from imovel_fogo f where f.imovel_id = i.id)) com_fogo,
           (select count(*) from imovel i where b.nome_uc = any(i.ucs) and (select count(distinct f.ano) from imovel_fogo f where f.imovel_id = i.id) >= 2) recorrentes
    from (select distinct on (nome_uc) * from car_busca order by nome_uc, id desc) b) x
$$;

revoke all on function car_buscar(text, numeric), car_processar(bigint), geo_imoveis(text, float8), imovel_ficha(bigint),
  imovel_incluir(jsonb, text, text, text, text, text), car_situacao(text), car_resumo(), imovel_fogo_calc(bigint) from public, anon;
grant execute on function car_buscar(text, numeric), car_processar(bigint), geo_imoveis(text, float8), imovel_ficha(bigint),
  imovel_incluir(jsonb, text, text, text, text, text), car_situacao(text), car_resumo() to authenticated;
