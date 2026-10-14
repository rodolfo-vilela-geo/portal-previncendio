-- =====================================================================
--  44 · RI: acionamento simplificado (decisão de 14/10/2026)
--  Ficam só "CBMMG acionado?" (cbmmg_acionado) e "Setor da UC" (setor — terá cadastro próprio, vindo do zoneamento).
--  Saem linha de fogo, acesso, apoio logístico e populações/estruturas em risco: o protocolo conjunto deve mudar em breve.
--  As colunas estavam vazias em produção.
-- =====================================================================
alter table ri
  drop column if exists linha_fogo,
  drop column if exists acesso,
  drop column if exists apoio_logistico,
  drop column if exists em_risco;
comment on column ri.setor is 'Setor da UC onde está o incêndio (texto por enquanto; depois virá do cadastro de setores/zoneamento).';
