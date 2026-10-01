-- =====================================================================
--  COLIBRI — ANO DO PIPCIF DE ORIGEM (migração dos PIPCIFs para o banco)
--  Registra de qual PIPCIF vieram os dados carregados de cada UC. Serve
--  para acompanhar a migração (quais UCs ainda não enviaram); depois, o
--  histórico de alterações passa a ser a referência.
-- =====================================================================
alter table uc_cadastro add column if not exists pipcif_ano int check (pipcif_ano between 2010 and 2100);
comment on column uc_cadastro.pipcif_ano is 'Ano do PIPCIF de onde vieram os dados carregados na migração (null = PIPCIF ainda não recebido).';
