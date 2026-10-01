-- =====================================================================
--  COLIBRI — CAMPOS DO RI QUE FALTAVAM (modelo da Força-Tarefa Previncêndio)
--  · forma de detecção e quem informou a detecção;
--  · início do combate (data, hora, quem informou) — permite o tempo de resposta;
--  · quem informou o debelamento e quem fechou o RI;
--  · contatos do registro (ri_contato) e acionamentos da PM Ambiental (ri_pmamb);
--  · ri_para_roi passa a entregar forma de detecção e início do combate ao ROI.
-- =====================================================================

alter table ri
  add column if not exists f_detec             text,          -- mesma lista do ROI/BDG (dominio 'f_detec')
  add column if not exists informante_detec    text,
  add column if not exists dat_ini_comb        date,
  add column if not exists hr_ini_comb         time,
  add column if not exists informante_ini_comb text,
  add column if not exists informante_final    text,
  add column if not exists fechado_por         text,
  add column if not exists fechado_em          timestamptz;
alter table ri drop constraint if exists ri_ini_comb_ok;
alter table ri add constraint ri_ini_comb_ok check (dat_ini_comb is null or dat_detec is null or dat_ini_comb >= dat_detec);

-- novo tipo de evento: início do combate
alter table ri_evento drop constraint if exists ri_evento_tipo_check;
alter table ri_evento add constraint ri_evento_tipo_check
  check (tipo in ('acionamento','atualizacao','inicio_combate','retificacao','apoio_aereo','debelado','outro'));

-- contatos do registro
create table if not exists ri_contato (
  id         bigint generated always as identity primary key,
  ano        int not null,
  ri         text not null,
  nome       text not null,
  orgao      text,                       -- órgão / função
  municipio  text,
  telefone   text,
  criado_por text default (auth.jwt() ->> 'email'),
  criado_em  timestamptz not null default now(),
  foreign key (ano, ri) references ri (ano, ri) on update cascade on delete cascade
);
create index if not exists ri_contato_ri_idx on ri_contato (ano, ri);

-- acionamentos da Polícia Militar Ambiental
create table if not exists ri_pmamb (
  id          bigint generated always as identity primary key,
  ano         int not null,
  ri          text not null,
  contato     text not null,             -- contato / nome / e-mail
  municipio   text,
  telefone    text,
  data_hora   timestamp,
  responsavel text,                      -- quem fez o contato
  obs         text,
  criado_por  text default (auth.jwt() ->> 'email'),
  criado_em   timestamptz not null default now(),
  foreign key (ano, ri) references ri (ano, ri) on update cascade on delete cascade
);
create index if not exists ri_pmamb_ri_idx on ri_pmamb (ano, ri);

alter table ri_contato enable row level security;
alter table ri_pmamb   enable row level security;
drop policy if exists equipe_ri_contato on ri_contato;
drop policy if exists equipe_ri_pmamb on ri_pmamb;
create policy equipe_ri_contato on ri_contato for all to authenticated using (is_equipe()) with check (is_equipe());
create policy equipe_ri_pmamb   on ri_pmamb   for all to authenticated using (is_equipe()) with check (is_equipe());
grant select, insert, update, delete on ri_contato, ri_pmamb to authenticated;
revoke all on ri_contato, ri_pmamb from anon;

-- ROI: além do que já vinha, forma de detecção e início do combate registrados pela sala
create or replace function ri_para_roi(p_ano int, p_ri text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('ano', r.ano, 'ri', r.ri, 'base_op', r.base_op, 'status', r.status, 'nome_uc', r.nome_uc,
           'local', r.local, 'municipio', r.municipio, 'dat_detec', r.dat_detec, 'hr_detec', r.hr_detec,
           'dat_final', r.dat_final, 'hr_final', r.hr_final, 'lat', r.lat, 'lon', r.lon,
           'f_detec', r.f_detec, 'f_detec_quem', r.informante_detec,
           'dat_ini_comb', r.dat_ini_comb, 'hr_ini_comb', to_char(r.hr_ini_comb, 'HH24:MI'),
           'evolucao', (select json_agg(json_build_object('data', d.data, 'hr_inicio', to_char(d.hr_inicio, 'HH24:MI'),
                                 'hr_fim', to_char(d.hr_fim, 'HH24:MI'),
                                 'comb_uc', d.comb_uc, 'comb_ftp', d.comb_ftp, 'comb_par', d.comb_par + d.comb_out,
                                 'comb_sm', d.comb_sm, 'comb_vol', d.comb_vol, 'comb_pm', d.comb_pm, 'comb_bm', d.comb_bm) order by d.data)
                        from vw_atuacao_dia d where d.ano = r.ano and d.ri = r.ri),
           'veiculos', (select json_build_object(
                          'vc_4x4', max(vc_4x4_uc), 'vc_4x4_d', max(vc_4x4 - vc_4x4_uc),
                          'vc_4x2', max(vc_4x2_uc), 'vc_4x2_d', max(vc_4x2 - vc_4x2_uc),
                          'vc_pipa', max(vc_pipa_uc), 'vc_pipa_d', max(vc_pipa - vc_pipa_uc),
                          'vc_moto', max(vc_moto_uc), 'vc_moto_d', max(vc_moto - vc_moto_uc),
                          'vc_trator', max(vc_trator_uc), 'vc_trator_d', max(vc_trator - vc_trator_uc),
                          'a_helicop', max(a_helicop), 'a_air_tr', max(a_air_tr),
                          'vc_outro', nullif(concat_ws('; ',
                              case when max(vc_out) > 0 then 'Outros veículos, ' || max(vc_out) end,
                              case when max(a_drone) > 0 then 'Drone, ' || max(a_drone) end), ''))
                        from vw_atuacao_dia d where d.ano = r.ano and d.ri = r.ri having count(*) > 0),
           'instituicoes', (select string_agg(distinct i.nome, '; ') from atuacao a join instituicao i on i.id = a.instituicao_id
                            where a.ano = r.ano and a.ri = r.ri and i.categoria <> 'uc'))
  from ri r where r.ano = p_ano and r.ri = lpad(p_ri, 4, '0') and r.status <> 'cancelado';
$$;
revoke all on function ri_para_roi(int, text) from public;
grant execute on function ri_para_roi(int, text) to anon, authenticated;
