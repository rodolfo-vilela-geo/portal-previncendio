-- =====================================================================
--  33 · Acesso restrito (decisão de 07/10/2026)
--  Só o Painel de ocorrências (histórico) e o Boletim da FTP são públicos.
--  Todo o resto exige login: o anônimo não grava nada e não lê nada além
--  das duas funções públicas (painel_dados, boletim_publico).
--  As permissões por papel (quem edita o quê) serão revistas depois.
--  Nada é apagado: as regras anônimas ficam desligadas (with check false / só logados).
-- =====================================================================

-- 1. Envio anônimo desligado (ROI, evolução, fotos, polígono, empenho, fauna)
alter policy roi_insere_publico         on roi           with check (false);
alter policy evolucao_insere_publico    on roi_evolucao  with check (false);
alter policy foto_insere_publico        on roi_foto      with check (false);
alter policy area_insere_publico        on area_queimada with check (false);
alter policy roi_empenho_insere_publico on roi_empenho   with check (false);
alter policy roi_fauna_insere_publico   on roi_fauna     with check (false);
alter policy fotos_envio_publico        on storage.objects with check (false);
revoke insert, update, delete on roi, roi_evolucao, roi_foto, area_queimada, roi_empenho, roi_fauna from anon;

-- 2. Leituras que eram abertas passam a ser só de logados
alter policy dominio_leitura           on dominio           to authenticated;
alter policy uc_leitura                on uc                to authenticated;
alter policy uc_limite_leitura         on uc_limite         to authenticated;
alter policy municipio_leitura         on municipio         to authenticated;
alter policy empenho_categoria_leitura on empenho_categoria to authenticated;
alter policy instituicao_leitura       on instituicao       to authenticated;
revoke select on dominio, uc, uc_limite, municipio, empenho_categoria, instituicao from anon;
revoke select on vw_bdg, vw_combate, vw_inconsistencias, vw_prazos, vw_roi_empenho_resumo from anon;

-- 3. Funções: o anônimo só executa as duas públicas
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' and p.proname in ('roi_recente', 'roi_bdg_recente', 'ri_para_roi', 'gerentes_uc', 'roi_evolucao_calculada', 'roi_recalcular_empenho',
                                          'juntar_instituicao', 'uc_mapa', 'sala_tecnica_uc', 'analisar_poligono', 'coord_mg_ok', 'acao_pendente')
  loop execute format('revoke execute on function %s from anon', f.sig); end loop;
end $$;
-- funções novas não ficam abertas ao anônimo por padrão
alter default privileges in schema public revoke execute on functions from anon;
