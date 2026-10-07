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

-- 4. (33b) Fechamento completo: algumas funções estavam abertas pela permissão padrão "public";
--    e o anônimo perde qualquer permissão direta em tabelas e visões (painel e boletim usam só as duas funções)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' and p.proname in ('uc_mapa', 'sala_tecnica_uc', 'coord_mg_ok', 'acao_pendente')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
grant select on spatial_ref_sys to anon;   -- tabela do PostGIS (pública por natureza)

-- 5. (33c) "Logado" = usuário cadastrado e ativo na equipe (is_usuario), não qualquer conta autenticada
alter policy roi_insere_logado on roi with check (is_usuario() and status = 'enviado' and cod_bdp ~ '^\d{4}-\d{4}-\d{3}$' and dat_detec is not null
  and (dat_comb is null or dat_comb >= dat_detec) and (dat_final is null or dat_final >= coalesce(dat_comb, dat_detec)));
alter policy evolucao_insere_logado    on roi_evolucao  with check (is_usuario());
alter policy foto_insere_logado        on roi_foto      with check (is_usuario());
alter policy area_insere_logado        on area_queimada with check (is_usuario() and fonte in ('SMC', 'campo') and roi_recente(cod_bdp));
alter policy roi_empenho_insere_logado on roi_empenho   with check (is_usuario());
alter policy roi_fauna_insere_logado   on roi_fauna     with check (is_usuario());
alter policy fotos_envio_logado        on storage.objects with check (bucket_id = 'roi-fotos' and is_usuario());
alter policy dominio_leitura           on dominio           using (is_usuario());
alter policy uc_leitura                on uc                using (is_usuario());
alter policy uc_limite_leitura         on uc_limite         using (is_usuario());
alter policy municipio_leitura         on municipio         using (is_usuario());
alter policy empenho_categoria_leitura on empenho_categoria using (is_usuario());
alter policy instituicao_leitura       on instituicao       using (is_usuario());
