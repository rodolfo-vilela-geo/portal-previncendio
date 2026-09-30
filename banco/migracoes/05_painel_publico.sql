-- =====================================================================
--  PORTAL PREVINCÊNDIO — DADOS DO DASHBOARD (acesso público, só estatística)
--  Rodar UMA vez no SQL Editor (depois do 01 a 04).
--
--  Entrega ao dashboard, numa única chamada, uma linha por ocorrência com
--  APENAS campos estatísticos. Ficam de fora: nomes, telefones, descrições,
--  proprietário, coordenadas, fotos e REDS/BOS.
--
--  Para tornar o dashboard restrito à equipe no futuro:
--    revoke execute on function painel_dados() from anon;
-- =====================================================================
create or replace function painel_dados()
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'gerado_em', now(),
    'campos', json_build_array('cod','ano','mes','dia','uc','cat','reg','bioma','local','detec',
                               'causa','agente','tr','dur','ar','area','comb','resp_min','dur_h','poli','int'),
    'linhas', coalesce(json_agg(json_build_array(
        b.cod_bdp, b.ano, extract(month from b.dat_detec)::int, b.dat_detec,
        b.nome_uc, b.categoria, b.ufbio, b.bioma_uc, b.local, b.f_detec,
        b.causa_p, b.ag_causal, b.tr_class, b.dur_class, b.ar_class,
        round(coalesce(b.area_int,0) + coalesce(b.area_ent,0), 2),
        b.total_comb,
        round(extract(epoch from b.tp_resp) / 60)::int,
        round((extract(epoch from b.dur_ocor) / 3600)::numeric, 1),
        (b.ausentes = 'Não'),
        b.int_detec
      ) order by b.cod_bdp), '[]'::json)
  )
  from vw_bdg b;
$$;

revoke all on function painel_dados() from public;
grant execute on function painel_dados() to anon, authenticated;
