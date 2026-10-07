-- =====================================================================
--  36 · ROI começa escolhendo o RI: lista dos RIs de uma UC (últimos ~13 meses)
--  com a situação e se já tem ROI. Só usuários logados.
-- =====================================================================
create or replace function ris_da_uc(p_nome_uc text) returns json
language sql stable security definer set search_path = public as $$
  select case when not is_usuario() then null else coalesce(json_agg(json_build_object(
           'ano', r.ano, 'ri', r.ri, 'status', r.status, 'dat_detec', r.dat_detec, 'hr_detec', to_char(r.hr_detec, 'HH24:MI'),
           'dat_final', r.dat_final, 'municipio', r.municipio, 'local', r.local,
           'prazo', case when r.dat_final is not null then r.dat_final + 10 end,
           'rois', (select count(*) from roi o where o.ano = r.ano and o.ri = r.ri))
         order by r.dat_detec desc, r.ri desc), '[]'::json) end
  from ri r
  where r.nome_uc = p_nome_uc and r.status <> 'cancelado' and r.dat_detec >= current_date - 400;
$$;
revoke all on function ris_da_uc(text) from public, anon;
grant execute on function ris_da_uc(text) to authenticated;
