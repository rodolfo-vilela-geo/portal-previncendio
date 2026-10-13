-- =====================================================================
--  43 · Base para o plano operacional (protocolos conjuntos CBMMG × IEF)
--  · uc_cadastro: unidade do CBMMG responsável pela área da UC (UEOp/fração) e seus contatos;
--  · ri: informações do acionamento (Protocolo Conjunto 03/2026, item 4.2) e se o CBMMG foi acionado.
--  O pessoal empenhado continua só na aba "Recursos empenhados" (atuacao).
-- =====================================================================
alter table uc_cadastro
  add column if not exists cbmmg_unidade  text,                          -- ex.: "3º Pelotão / 2ª Cia — Curvelo"
  add column if not exists cbmmg_contatos jsonb not null default '[]';   -- [{tipo:'tel'|'email', valor, obs}]
comment on column uc_cadastro.cbmmg_unidade is 'Unidade ou fração do CBMMG responsável pelo atendimento na área da UC (Protocolo Conjunto 03/2026).';

alter table ri
  add column if not exists setor           text,     -- setor/região da UC
  add column if not exists linha_fogo      text,     -- dimensão da linha de fogo
  add column if not exists acesso          text,     -- acesso para veículos e pessoas (estradas, trilhas)
  add column if not exists apoio_logistico text,     -- pontos de apoio, equipamentos, veículos 4x4
  add column if not exists em_risco        text,     -- populações e estruturas em risco
  add column if not exists cbmmg_acionado  boolean;  -- CBMMG acionado (193 ou coordenação)
comment on column ri.em_risco is 'Populações e estruturas em risco: moradias, linhas de transmissão, escolas, nascentes, áreas de valor ambiental (Protocolo 03/2026, 4.2.5).';
