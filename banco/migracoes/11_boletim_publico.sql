-- =====================================================================
--  PORTAL PREVINCÊNDIO — BOLETIM INFORMATIVO (público)
--  Substitui o Painel Informativo do Data Studio. Numa só chamada:
--   · RIs do ano (situação, UC, local, município, detecção, fim, recursos
--     da última atualização) — SEM descrições, informantes, atendentes
--     ou coordenadas;
--   · ponte com o histórico: média mensal e anual dos ROIs (BDG) dos anos
--     anteriores (2013 até o ano anterior ao boletim).
-- =====================================================================
create or replace function boletim_publico(p_ano int default null)
returns json language sql stable security definer set search_path = public as $$
  with par as (select coalesce(p_ano, extract(year from (now() at time zone 'America/Sao_Paulo'))::int) as ano),
  hist as (
    select extract(month from o.dat_detec)::int as mes, count(*) as n
    from roi o, par where o.ano between 2013 and par.ano - 1 and o.dat_detec is not null group by 1
  ),
  anos as (select count(distinct o.ano) as n, min(o.ano) as ini, max(o.ano) as fim from roi o, par where o.ano between 2013 and par.ano - 1),
  ris as (
    select r.ri, r.status, r.base_op, r.nome_uc, u.categoria, r.local, r.municipio,
           r.dat_detec, r.hr_detec, r.dat_final, r.hr_final,
           e.data_hora as atualizado, e.recursos_txt, (e.criado_por like 'importação%') as importado,
           json_build_object('comb_uc',e.comb_uc,'comb_ftp',e.comb_ftp,'comb_sm',e.comb_sm,'comb_par',e.comb_par,'comb_vol',e.comb_vol,
                             'comb_bm',e.comb_bm,'comb_pm',e.comb_pm,'comb_out',e.comb_out,'vc_4x4',e.vc_4x4,'vc_4x2',e.vc_4x2,
                             'vc_pipa',e.vc_pipa,'vc_moto',e.vc_moto,'vc_trator',e.vc_trator,'vc_out',e.vc_out,
                             'a_helicop',e.a_helicop,'a_air_tr',e.a_air_tr,'a_drone',e.a_drone) as rec
    from ri r cross join par
    left join uc u on u.nome_uc = r.nome_uc
    left join lateral (
      select * from ri_evento x
      where x.ano = r.ano and x.ri = r.ri
        and (x.recursos_txt is not null or num_nonnulls(x.comb_uc, x.comb_ftp, x.comb_sm, x.comb_par, x.comb_vol,
                                                       x.comb_bm, x.comb_pm, x.comb_out, x.vc_4x4, x.a_helicop) > 0)
      order by x.data_hora desc nulls last, x.id desc limit 1
    ) e on true
    where r.ano = par.ano and r.status <> 'cancelado'
  )
  select json_build_object(
    'gerado_em', now(),
    'ano', (select ano from par),
    'anos_historico', (select json_build_object('ini', ini, 'fim', fim, 'n', n) from anos),
    'media_mensal', (select json_agg(coalesce(round(h.n::numeric / nullif((select n from anos), 0), 1), 0) order by m)
                     from generate_series(1, 12) m left join hist h on h.mes = m),
    'media_anual', (select round(count(*)::numeric / nullif((select n from anos), 0), 1) from roi o, par
                    where o.ano between 2013 and par.ano - 1),
    'ris', coalesce((select json_agg(row_to_json(ris) order by ri desc) from ris), '[]'::json)
  );
$$;
revoke all on function boletim_publico(int) from public;
grant execute on function boletim_publico(int) to anon, authenticated;
