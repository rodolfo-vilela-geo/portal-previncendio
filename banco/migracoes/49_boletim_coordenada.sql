-- 49 · Boletim público: ponto do incêndio em andamento (15/10/2026, decisão do Rodolfo)
--  · boletim_publico() passa a devolver lat/lon do RI, SOMENTE para ocorrências em andamento
--    (as debeladas continuam sem coordenada na página pública).
--  · arredondado a 4 casas (~10 m); o banco segue com o valor original.
--  · RI sem coordenada: lat/lon nulos; a página mantém a UC em vermelho e avisa "coordenada não informada".

create or replace function boletim_publico(p_ano int default null)
returns json language sql stable security definer set search_path = public as $$
  with par as (select coalesce(p_ano, extract(year from (now() at time zone 'America/Sao_Paulo'))::int) as ano),
  hist as (
    select extract(month from o.dat_detec)::int as mes, count(*) as n
    from roi o, par where o.ano between 2013 and par.ano - 1 and o.dat_detec is not null group by 1
  ),
  anos as (select count(distinct o.ano) as n, min(o.ano) as ini, max(o.ano) as fim from roi o, par where o.ano between 2013 and par.ano - 1),
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
    'media_anual', (select round(count(*)::numeric / nullif((select n from anos), 0), 1) from roi o, par
                    where o.ano between 2013 and par.ano - 1),
    'ris', coalesce((select json_agg(row_to_json(ris) order by ri desc) from ris), '[]'::json)
  );
$$;
revoke all on function boletim_publico(int) from public;
grant execute on function boletim_publico(int) to anon, authenticated;
