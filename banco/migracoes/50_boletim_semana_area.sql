-- 50 · Boletim público: média semanal e área queimada por ano (15/10/2026, pedido do Rodolfo)
--  · media_semanal: média 2013..ano-1 de ocorrências por semana do ano (blocos de 7 dias desde 1º/jan, 1 a 53)
--  · area_anos: área queimada (ha) por ano somando os ROIs (interior e entorno da UC) e quantos têm medição;
--    o ano corrente é parcial: a área só entra quando o ROI com a medição é concluído (até 10 dias após a extinção).
--  · lat/lon continuam só para ocorrências em andamento (49).

create or replace function boletim_publico(p_ano int default null)
returns json language sql stable security definer set search_path = public as $$
  with par as (select coalesce(p_ano, extract(year from (now() at time zone 'America/Sao_Paulo'))::int) as ano),
  hist as (
    select extract(month from o.dat_detec)::int as mes, count(*) as n
    from roi o, par where o.ano between 2013 and par.ano - 1 and o.dat_detec is not null group by 1
  ),
  anos as (select count(distinct o.ano) as n, min(o.ano) as ini, max(o.ano) as fim from roi o, par where o.ano between 2013 and par.ano - 1),
  -- semana do ano = blocos de 7 dias a partir de 1º de janeiro (1 a 53), igual na página
  hist_sem as (
    select ((extract(doy from o.dat_detec)::int - 1) / 7) + 1 as sem, count(*) as n
    from roi o, par where o.ano between 2013 and par.ano - 1 and o.dat_detec is not null group by 1
  ),
  area as (
    select o.ano, round(sum(coalesce(o.area_int,0))::numeric, 1) as int, round(sum(coalesce(o.area_ent,0))::numeric, 1) as ent,
           count(*) filter (where coalesce(o.area_int,0) + coalesce(o.area_ent,0) > 0) as medidas
    from roi o, par where o.ano between 2013 and par.ano group by o.ano
  ),
  ris as (
    select b.ri, b.status, b.base_op, b.nome_uc, u.categoria, b.local, b.municipio,
           b.dat_detec, b.hr_detec, b.dat_final, b.hr_final,
           b.ultima_atualizacao as atualizado, b.recursos_txt, b.importado, b.fonte_recursos as fonte,
           case when b.status = 'andamento' then round(b.lat::numeric, 4) end as lat,
           case when b.status = 'andamento' then round(b.lon::numeric, 4) end as lon,
           json_build_object('comb_uc',b.comb_uc,'comb_ftp',b.comb_ftp,'comb_sm',b.comb_sm,'comb_par',b.comb_par,'comb_vol',b.comb_vol,
                             'comb_bm',b.comb_bm,'comb_pm',b.comb_pm,'comb_out',b.comb_out,'vc_4x4',b.vc_4x4,'vc_4x2',b.vc_4x2,
                             'vc_pipa',b.vc_pipa,'vc_moto',b.vc_moto,'vc_trator',b.vc_trator,'vc_out',b.vc_out,
                             'a_helicop',b.a_helicop,'a_air_tr',b.a_air_tr,'a_drone',b.a_drone) as rec
    from vw_boletim b cross join par
    left join uc u on u.nome_uc = b.nome_uc
    where b.ano = par.ano and b.status <> 'cancelado'
  )
  select json_build_object(
    'gerado_em', now(),
    'ano', (select ano from par),
    'anos_historico', (select json_build_object('ini', ini, 'fim', fim, 'n', n) from anos),
    'media_mensal', (select json_agg(coalesce(round(h.n::numeric / nullif((select n from anos), 0), 1), 0) order by m)
                     from generate_series(1, 12) m left join hist h on h.mes = m),
    'media_semanal', (select json_agg(coalesce(round(h.n::numeric / nullif((select n from anos), 0), 2), 0) order by w)
                      from generate_series(1, 53) w left join hist_sem h on h.sem = w),
    -- área queimada por ano (soma dos ROIs); o ano corrente é parcial (só ROIs já medidos)
    'area_anos', (select json_agg(json_build_object('ano', a.ano, 'int', a.int, 'ent', a.ent, 'medidas', a.medidas) order by a.ano) from area a),
    'media_anual', (select round(count(*)::numeric / nullif((select n from anos), 0), 1) from roi o, par
                    where o.ano between 2013 and par.ano - 1),
    'ris', coalesce((select json_agg(row_to_json(ris) order by ri desc) from ris), '[]'::json)
  );
$$;
revoke all on function boletim_publico(int) from public;
grant execute on function boletim_publico(int) to anon, authenticated;
