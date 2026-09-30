-- =====================================================================
--  PORTAL PREVINCÊNDIO — RI (REGISTRO DE INCÊNDIO) DA SALA DE SITUAÇÃO
--  Documento da GPCIF: dá início à ocorrência e, depois, ao ROI da UC.
--    ri         = cabeçalho (nº sequencial único no ano, UC, detecção, fim...)
--    ri_evento  = log de ligações/atualizações com recursos empenhados
--    vw_boletim = situação atual de cada RI (recursos do último evento)
--  Acesso: só membros da equipe (tabela equipe). O formulário público do ROI
--  lê apenas o necessário para se pré-preencher (função ri_para_roi).
-- =====================================================================

-- 1. Cabeçalho do RI (a tabela ri já existia só para prazos: ganha os campos da sala)
alter table ri
  add column base_op      text,                              -- Base Operacional de Curvelo / Sub Base de Januária / ...
  add column status       text not null default 'andamento'
                          check (status in ('andamento','debelado','cancelado')),
  add column local        text,                              -- Interno / Entorno / Interno/Entorno
  add column municipio    text,
  add column dat_detec    date,
  add column hr_detec     time,
  add column hr_final     time,
  add column lat          numeric(10,6),
  add column lon          numeric(10,6),
  add column geom         geometry(Point, 4674) generated always as
                          (case when lat is not null and lon is not null
                                then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,
  add column obs          text,
  add column criado_por   text,
  add column atualizado_em timestamptz not null default now();
comment on column ri.responsavel is 'Responsável pelo ROI na UC (prazo).';

-- número automático: próximo número do ano, sem colisão entre as salas
create or replace function tg_ri_numero() returns trigger language plpgsql set search_path = public as $$
begin
  if new.ri is null or new.ri = '' then
    perform pg_advisory_xact_lock(hashtext('ri_numero'), new.ano);
    select lpad((coalesce(max(ri::int) filter (where ri ~ '^\d{4}$'), 0) + 1)::text, 4, '0')
      into new.ri from ri where ano = new.ano;
  end if;
  new.atualizado_em := now();
  if new.criado_por is null then new.criado_por := auth.jwt() ->> 'email'; end if;
  return new;
end $$;
create trigger ri_numero before insert or update on ri for each row execute function tg_ri_numero();

-- 2. Log de eventos (ligações, atualizações de efetivo, retificações...)
create table ri_evento (
  id           bigint generated always as identity primary key,
  ano          int  not null,
  ri           text not null,
  data_hora    timestamp,                      -- quando a informação chegou à sala (horário local)
  data_hora_txt text,                          -- texto original quando não foi possível interpretar (histórico)
  tipo         text not null default 'atualizacao'
               check (tipo in ('acionamento','atualizacao','retificacao','apoio_aereo','debelado','outro')),
  informante   text,                           -- quem ligou / informou
  descricao    text,
  -- recursos empenhados no momento (pessoas)
  comb_uc int, comb_ftp int, comb_sm int, comb_par int, comb_vol int, comb_bm int, comb_pm int, comb_out int,
  -- veículos e aeronaves
  vc_4x4 int, vc_4x2 int, vc_pipa int, vc_moto int, vc_trator int, vc_out int,
  a_helicop int, a_air_tr int, a_drone int,
  recursos_txt text,                           -- detalhamento livre (instituições, outros)
  atendente    text,                           -- atendente da sala
  criado_por   text default (auth.jwt() ->> 'email'),
  criado_em    timestamptz not null default now(),
  foreign key (ano, ri) references ri (ano, ri) on update cascade on delete cascade
);
create index ri_evento_ri_idx on ri_evento (ano, ri, data_hora);
comment on table ri_evento is 'Log de eventos do RI registrado pela sala de situação.';

alter table ri_evento enable row level security;
create policy equipe_ri_evento on ri_evento for all to authenticated using (is_equipe()) with check (is_equipe());

-- ao registrar evento "debelado", o RI muda de status
create or replace function tg_ri_evento_status() returns trigger language plpgsql set search_path = public as $$
begin
  if new.tipo = 'debelado' then
    update ri set status = 'debelado' where ano = new.ano and ri = new.ri and status = 'andamento';
  end if;
  update ri set atualizado_em = now() where ano = new.ano and ri = new.ri;
  return new;
end $$;
create trigger ri_evento_status after insert on ri_evento for each row execute function tg_ri_evento_status();

-- 3. Boletim: cada RI com os recursos do último evento que informou recursos
create or replace view vw_boletim with (security_invoker = true) as
select r.ano, r.ri, r.base_op, r.status, r.nome_uc, r.local, r.municipio,
       r.dat_detec, r.hr_detec, r.dat_final, r.hr_final, r.lat, r.lon,
       e.data_hora as ultima_atualizacao,
       e.comb_uc, e.comb_ftp, e.comb_sm, e.comb_par, e.comb_vol, e.comb_bm, e.comb_pm, e.comb_out,
       coalesce(e.comb_uc,0)+coalesce(e.comb_ftp,0)+coalesce(e.comb_sm,0)+coalesce(e.comb_par,0)
      +coalesce(e.comb_vol,0)+coalesce(e.comb_bm,0)+coalesce(e.comb_pm,0)+coalesce(e.comb_out,0) as total_pessoas,
       e.vc_4x4, e.vc_4x2, e.vc_pipa, e.vc_moto, e.vc_trator, e.vc_out, e.a_helicop, e.a_air_tr, e.a_drone,
       e.recursos_txt,
       (select count(*) from ri_evento x where x.ano = r.ano and x.ri = r.ri) as n_eventos,
       exists (select 1 from roi o where o.ano = r.ano and o.ri = r.ri) as tem_roi
from ri r
left join lateral (
  select * from ri_evento x
  where x.ano = r.ano and x.ri = r.ri
    and (x.recursos_txt is not null or num_nonnulls(x.comb_uc, x.comb_ftp, x.comb_sm, x.comb_par, x.comb_vol,
                                                   x.comb_bm, x.comb_pm, x.comb_out, x.vc_4x4, x.a_helicop) > 0)
  order by x.data_hora desc nulls last, x.id desc limit 1
) e on true;

-- 4. Para o formulário público do ROI: dados do RI para pré-preenchimento
create or replace function ri_para_roi(p_ano int, p_ri text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('ano', ano, 'ri', ri, 'base_op', base_op, 'status', status, 'nome_uc', nome_uc,
           'local', local, 'municipio', municipio, 'dat_detec', dat_detec, 'hr_detec', hr_detec,
           'dat_final', dat_final, 'hr_final', hr_final, 'lat', lat, 'lon', lon)
  from ri where ano = p_ano and ri = lpad(p_ri, 4, '0') and status <> 'cancelado';
$$;
revoke all on function ri_para_roi(int, text) from public;
grant execute on function ri_para_roi(int, text) to anon, authenticated;
