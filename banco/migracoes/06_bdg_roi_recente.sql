-- =====================================================================
--  PORTAL PREVINCÊNDIO — LINHA DO BDG DO ROI RECÉM-ENVIADO (para o shapefile)
--  Rodar UMA vez no SQL Editor (depois do 01 a 05).
--
--  O formulário, logo após o envio, pede ao banco a linha completa da
--  Tabela Principal (vw_bdg) daquele ROI, já com todas as classes
--  calculadas, e monta o shapefile no navegador.
--  Só responde para ROI enviado nas últimas 24 h (mesma trava do polígono).
-- =====================================================================
create or replace function roi_bdg_recente(p_cod text)
returns json
language sql stable security definer set search_path = public as $$
  select row_to_json(b)
  from vw_bdg b
  where b.cod_bdp = p_cod
    and roi_recente(p_cod);
$$;

revoke all on function roi_bdg_recente(text) from public;
grant execute on function roi_bdg_recente(text) to anon, authenticated;
