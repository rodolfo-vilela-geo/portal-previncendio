-- =====================================================================
--  39 · Histórico do cadastro de apoio aéreo visível na tela apoio_aereo.html
--  (o gatilho de auditoria já existe desde a 38; aqui só a leitura, para usuários logados)
-- =====================================================================
create policy usuario_le_auditoria_aereo on auditoria for select to authenticated
  using (tabela = 'recurso_aereo' and is_usuario());
