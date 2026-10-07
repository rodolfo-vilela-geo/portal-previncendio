-- =====================================================================
--  30 · ri_para_roi entrega também o empenho da Sala linha a linha
--  (instituição, pessoas, veículos, aeronaves e contrato), para o ROI
--  vir pré-preenchido na tabela nova de recursos empenhados (roi_empenho).
--  Só quantidades e o id da instituição (a observação da Sala não vai: a função é aberta ao formulário público).
-- =====================================================================
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
                            where a.ano = r.ano and a.ri = r.ri and i.categoria <> 'uc'),
           'empenho', (select json_agg(json_build_object('data', a.data, 'hr_inicio', to_char(a.hr_inicio, 'HH24:MI'), 'hr_fim', to_char(a.hr_fim, 'HH24:MI'),
                                 'instituicao_id', a.instituicao_id, 'pessoas', a.pessoas,
                                 'vc_4x4', a.vc_4x4, 'vc_4x2', a.vc_4x2, 'vc_pipa', a.vc_pipa, 'vc_moto', a.vc_moto, 'vc_trator', a.vc_trator, 'vc_out', a.vc_out,
                                 'a_helicop', a.a_helicop, 'a_air_tr', a.a_air_tr, 'a_drone', a.a_drone, 'a_contrato', a.a_contrato)
                                 order by a.data, a.hr_inicio nulls first, a.id)
                       from atuacao a where a.ano = r.ano and a.ri = r.ri))
  from ri r where r.ano = p_ano and r.ri = lpad(p_ri, 4, '0') and r.status <> 'cancelado';
$$;
revoke all on function ri_para_roi(int, text) from public;
grant execute on function ri_para_roi(int, text) to anon, authenticated;

-- instituição genérica do ROI: o formulário é aberto e não cadastra instituições; o nome vai na observação
insert into instituicao (nome, grupo, categoria, obs) values
  ('Outra instituição (ver observação)', 'out', 'out', 'Usada no ROI quando a instituição não está na lista; o nome vai na observação')
on conflict (nome) do nothing;
