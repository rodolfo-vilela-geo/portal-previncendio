-- =====================================================================
--  41 · Identificação das UCs (decisão de 08–13/10/2026)
--  · roi, ri e uc_limite passam a apontar para uc(nome_uc) com atualização em cascata
--    (as outras 18 tabelas já faziam isso): renomear uma UC = mudar uma linha em uc.
--  · uc ganha: cod_uc (código interno fixo, UC-001…, não muda nunca; novas UCs recebem o próximo número),
--    nome_oficial (nome completo, do IDE-Sisema com acentos restaurados), cod_ide (id_uc_ da camada
--    ide_2010_mg_unidades_conservacao_estaduais_pol do IDE-Sisema) e variantes (outras grafias, para busca e importação).
--  · A chave continua sendo nome_uc (nome curto); não foi trocada nas tabelas.
--  Dados abaixo: nomes públicos das UCs (IDE-Sisema), sem dado pessoal.
-- =====================================================================
alter table roi       add constraint roi_nome_uc_fk       foreign key (nome_uc) references uc(nome_uc) on update cascade;
alter table ri        add constraint ri_nome_uc_fk        foreign key (nome_uc) references uc(nome_uc) on update cascade;
alter table uc_limite add constraint uc_limite_nome_uc_fk foreign key (nome_uc) references uc(nome_uc) on update cascade;

alter table uc add column if not exists cod_uc text, add column if not exists nome_oficial text,
               add column if not exists cod_ide text, add column if not exists variantes text[] not null default '{}';
comment on column uc.cod_uc is 'Código interno fixo da UC (UC-001…). Não muda mesmo que o nome ou a categoria mudem.';
comment on column uc.nome_oficial is 'Nome oficial completo (fonte: IDE-Sisema, acentos restaurados).';
comment on column uc.cod_ide is 'id_uc_ da camada de UCs estaduais do IDE-Sisema.';
comment on column uc.variantes is 'Outras grafias da UC (IDE sem acento, sigla + nome…), para busca e importadores.';

update uc u set cod_uc = v.cod, nome_oficial = v.nome, cod_ide = v.ide, variantes = v.var
from (values
  ('Acauã', 'UC-001', 'Estação Ecológica Estadual de Acauã', null, array['EE Acauã','Estacao Ecologica Estadual de Acauã']::text[]),
  ('Água Limpa', 'UC-002', 'Estação Ecológica Estadual de Água Limpa', '691', array['EE Água Limpa','Estacao Ecologica Estadual de Agua Limpa']::text[]),
  ('Águas Vertentes', 'UC-003', 'Área de Proteção Ambiental Estadual Águas Vertentes', '644', array['APA Estadual Aguas Vertentes','APA Águas Vertentes']::text[]),
  ('Alto Cariri', 'UC-004', 'Parque Estadual Alto Cariri', '694', array['PE Alto Cariri']::text[]),
  ('Alto Mucuri', 'UC-005', 'Área de Proteção Ambiental Estadual do Alto Mucuri', '1444', array['APA Alto Mucuri','APA Estadual do Alto Mucuri']::text[]),
  ('Arêdes', 'UC-006', 'Estação Ecológica Estadual de Arêdes', '678', array['EE Arêdes','Estacao Ecologica Estadual de Aredes']::text[]),
  ('Bacia Hidrográfica do Rio Machado', 'UC-007', 'Área de Proteção Ambiental Estadual da Bacia Hidrográfica do Rio do Machado', '811', array['APA Bacia Hidrográfica do Rio Machado','APA Estadual da Bacia Hidrografica do Rio do Machado']::text[]),
  ('Bacia Hidrográfica do Rio Uberaba', 'UC-008', 'Área de Proteção Ambiental Estadual da Bacia Hidrográfica do Rio Uberaba', '1381', array['APA Bacia Hidrográfica do Rio Uberaba','APA Estadual da Bacia Hidrografica do Rio Uberaba']::text[]),
  ('Baleia', 'UC-009', 'Parque Estadual da Baleia', '767', array['PE Baleia']::text[]),
  ('Biribiri', 'UC-010', 'Parque Estadual do Biribiri', null, array['PE Biribiri']::text[]),
  ('Botumirim', 'UC-011', 'Parque Estadual de Botumirim', '1743', array['PE Botumirim']::text[]),
  ('Cachoeira das Andorinhas', 'UC-012', 'Área de Proteção Ambiental Estadual Cachoeira das Andorinhas', '680', array['APA Cachoeira das Andorinhas','APA Estadual Cachoeira das Andorinhas']::text[]),
  ('Caminho dos Gerais', 'UC-013', 'Parque Estadual Caminho dos Gerais', '701', array['PE Caminho dos Gerais']::text[]),
  ('Campos Altos', 'UC-014', 'Parque Estadual dos Campos Altos', '659', array['PE Campos Altos']::text[]),
  ('Cerca Grande', 'UC-015', 'Parque Estadual da Cerca Grande', '662', array['PE Cerca Grande']::text[]),
  ('Cercadinho', 'UC-016', 'Estação Ecológica Estadual do Cercadinho', '1370', array['EE Cercadinho','Estacao Ecologica Estadual do Cercadinho']::text[]),
  ('Cochá e Gibão', 'UC-017', 'Área de Proteção Ambiental Estadual Cochá e Gibão', null, array['APA Cochá e Gibão','APA Estadual Cocha e Gibão']::text[]),
  ('Corumbá', 'UC-018', 'Estação Ecológica Estadual de Corumbá', '670', array['EE Corumbá','Estacao Ecologica Estadual de Corumba']::text[]),
  ('Experiência da Jaguara', 'UC-019', 'Monumento Natural Estadual Experiência da Jaguara', '669', array['MN Experiência da Jaguara','Monumento Natural Estadual Experiencia da Jaguara']::text[]),
  ('Fechos', 'UC-020', 'Estação Ecológica Estadual de Fechos', '740', array['EE Fechos','Estacao Ecologica Estadual de Fechos']::text[]),
  ('Fernão Dias', 'UC-021', 'Área de Proteção Ambiental Estadual Fernão Dias', '712', array['APA Estadual Fernao Dias','APA Fernão Dias']::text[]),
  ('Grão Mogol', 'UC-022', 'Parque Estadual de Grão Mogol', '699', array['PE Grão Mogol','Parque Estadual de Grao Mogol']::text[]),
  ('Gruta Rei do Mato', 'UC-023', 'Monumento Natural Estadual Gruta Rei do Mato', '664', array['MN Gruta Rei do Mato']::text[]),
  ('Ibitipoca', 'UC-024', 'Parque Estadual de Ibitipoca', '689', array['PE Ibitipoca']::text[]),
  ('Itacolomi', 'UC-025', 'Parque Estadual do Itacolomi', '672', array['PE Itacolomi']::text[]),
  ('Itatiaia', 'UC-026', 'Monumento Natural Estadual de Itatiaia', '1372', array['MN Itatiaia']::text[]),
  ('Jaíba', 'UC-027', 'Reserva Biológica Estadual Jaíba', '651', array['REBIO Jaíba','Reserva Biologica Estadual Jaiba']::text[]),
  ('Lagedão', 'UC-028', 'Área de Proteção Ambiental Estadual Lagedão', '655', array['APA Estadual Lagedao','APA Lagedão']::text[]),
  ('Lagoa do Cajueiro', 'UC-029', 'Parque Estadual da Lagoa do Cajueiro', '646', array['PE Lagoa do Cajueiro']::text[]),
  ('Lapa Grande', 'UC-030', 'Parque Estadual da Lapa Grande', '702', array['PE Lapa Grande']::text[]),
  ('Lapa Nova de Vazante', 'UC-031', 'Monumento Natural Estadual Lapa Nova de Vazante', '1739', array['MN Lapa Nova de Vazante']::text[]),
  ('Lapa Vermelha', 'UC-032', 'Monumento Natural Estadual Lapa Vermelha', '667', array['MN Lapa Vermelha']::text[]),
  ('Libélulas da Serra de São José', 'UC-033', 'Refúgio de Vida Silvestre Estadual Libélulas da Serra de São José', '834', array['RVS Libélulas da Serra de São José','Refugio de Vida Silvestre Estadual Libelulas da Serra de Sao Jose']::text[]),
  ('Macaúbas', 'UC-034', 'Refúgio de Vida Silvestre Estadual Macaúbas', '1478', array['RVS Macaúbas','Refugio de Vida Silvestre Estadual Macaubas']::text[]),
  ('Mar de Espanha', 'UC-035', 'Estação Ecológica Estadual de Mar de Espanha', '692', array['EE Mar de Espanha','Estacao Ecologica Estadual de Mar de Espanha']::text[]),
  ('Mata de Krambeck', 'UC-036', 'Parque Estadual Mata do Krambeck', null, array['PE Mata de Krambeck']::text[]),
  ('Mata do Cedro', 'UC-037', 'Estação Ecológica Estadual da Mata do Cedro', '671', array['EE Mata do Cedro','Estacao Ecologica Estadual da Mata do Cedro']::text[]),
  ('Mata do Limoeiro', 'UC-038', 'Parque Estadual Mata do Limoeiro', '796', array['PE Mata do Limoeiro']::text[]),
  ('Mata dos Ausentes', 'UC-039', 'Estação Ecológica Estadual da Mata dos Ausentes', '643', array['EE Mata dos Ausentes','Estacao Ecologica Estadual da Mata dos Ausentes']::text[]),
  ('Mata dos Muriquis', 'UC-040', 'Refúgio de Vida Silvestre Estadual Mata dos Muriquis', '695', array['RVS Mata dos Muriquis','Refugio de Vida Silvestre Estadual Mata dos Muriquis']::text[]),
  ('Mata Seca', 'UC-041', 'Parque Estadual da Mata Seca', '647', array['PE Mata Seca']::text[]),
  ('Montezuma', 'UC-042', 'Parque Estadual de Montezuma', '703', array['PE Montezuma']::text[]),
  ('Nova Baden', 'UC-043', 'Parque Estadual de Nova Baden', null, array['PE Nova Baden']::text[]),
  ('Pandeiros', 'UC-044', 'Área de Proteção Ambiental Estadual do Rio Pandeiros', '654', array['APA Estadual do Rio Pandeiros','APA Pandeiros']::text[]),
  ('Paracatu', 'UC-045', 'Parque Estadual de Paracatu', '698', array['PE Paracatu']::text[]),
  ('Parque Cataguás', 'UC-046', 'Área de Proteção Ambiental Parque Cataguás', '1.2016.022428-01', array['APA Parque Cataguas']::text[]),
  ('Pau Furado', 'UC-047', 'Parque Estadual do Pau Furado', '713', array['PE Pau Furado']::text[]),
  ('Peter Lund', 'UC-048', 'Monumento Natural Estadual Peter Lund', '663', array['MN Peter Lund']::text[]),
  ('Pico da Ibituruna', 'UC-049', 'Monumento Natural Estadual Pico do Ibituruna', '1495', array['MN Pico da Ibituruna']::text[]),
  ('Pico do Itabirito', 'UC-050', 'Monumento Natural Estadual do Pico do Itabirito', '1483', array['MN Pico do Itabirito']::text[]),
  ('Pico do Itambé', 'UC-051', 'Parque Estadual do Pico do Itambé', '639', array['PE Pico do Itambé','Parque Estadual do Pico do Itambe']::text[]),
  ('Rio Corrente', 'UC-052', 'Parque Estadual do Rio Corrente', '705', array['PE Rio Corrente']::text[]),
  ('Rio Doce', 'UC-053', 'Parque Estadual do Rio Doce', '704', array['PE Rio Doce']::text[]),
  ('Rio Pandeiros', 'UC-054', 'Refúgio de Vida Silvestre Estadual do Rio Pandeiros', '653', array['RVS Rio Pandeiros','Refugio de Vida Silvestre Estadual do Rio Pandeiros']::text[]),
  ('Rio Preto', 'UC-055', 'Parque Estadual do Rio Preto', '637', array['PE Rio Preto']::text[]),
  ('Rios Tijuco e da Prata', 'UC-056', 'Refúgio de Vida Silvestre Estadual dos Rios Tijuco e da Prata', '714', array['RVS Rios Tijuco e da Prata','Refugio de Vida Silvestre Estadual dos Rios Tijuco e da Prata']::text[]),
  ('Sagarana', 'UC-057', 'Parque Estadual de Sagarana', '697', array['PE Sagarana']::text[]),
  ('Santa Izabel e Espalha', 'UC-058', null, null, array['APE Santa Izabel e Espalha']::text[]),
  ('Santo Antônio', 'UC-059', 'Monumento Natural Estadual Santo Antônio', '668', array['MN Santo Antônio','Monumento Natural Estadual Santo Antonio']::text[]),
  ('São José', 'UC-060', 'Área de Proteção Ambiental Estadual São José', '800', array['APA Estadual Sao Jose','APA São José']::text[]),
  ('São Judas Tadeu', 'UC-061', 'Floresta Estadual São Judas Tadeu', '685', array['FLOE São Judas Tadeu','Floresta Estadual Sao Judas Tadeu']::text[]),
  ('Seminário Menor de Mariana', 'UC-062', 'Área de Proteção Ambiental Estadual Seminário Menor de Mariana', '681', array['APA Estadual  Seminario Menor de Mariana','APA Seminário Menor de Mariana']::text[]),
  ('Serra Azul', 'UC-063', 'Reserva Biológica Estadual da Serra Azul', '652', array['REBIO Serra Azul','Reserva Biologica Estadual da Serra Azul']::text[]),
  ('Serra da Boa Esperança', 'UC-064', 'Parque Estadual Serra da Boa Esperança', '709', array['PE Serra da Boa Esperança','Parque Estadual Serra da Boa Esperanca']::text[]),
  ('Serra da Candonga', 'UC-065', 'Parque Estadual Serra da Candonga', '706', array['PE Serra da Candonga']::text[]),
  ('Serra da Moeda', 'UC-066', 'Monumento Natural Estadual da Serra da Moeda', '686', array['MN Serra da Moeda']::text[]),
  ('Serra da Piedade', 'UC-067', 'Monumento Natural Estadual da Serra da Piedade', '1386', array['MN Serra da Piedade']::text[]),
  ('Serra das Araras', 'UC-068', 'Parque Estadual da Serra das Araras', '650', array['PE Serra das Araras']::text[]),
  ('Serra das Aroeiras', 'UC-069', 'Refúgio de Vida Silvestre Estadual Serra das Aroeiras', '1456', array['RVS Serra das Aroeiras','Refugio de Vida Silvestre Estadual Serra das Aroeiras']::text[]),
  ('Serra do Brigadeiro', 'UC-070', 'Parque Estadual da Serra do Brigadeiro', '690', array['PE Serra do Brigadeiro']::text[]),
  ('Serra do Cabral', 'UC-071', 'Parque Estadual da Serra do Cabral', '661', array['PE Serra do Cabral']::text[]),
  ('Serra do Cipó', 'UC-072', 'Parque Estadual da Serra do Cipó', '1399', array['PE Serra do Cipó','Parque Estadual da Serra do Cipo']::text[]),
  ('Serra do Gambá', 'UC-073', 'Monumento Natural Estadual Serra do Gambá', '752', array['MN Serra do Gambá','Monumento Natural Estadual Serra do Gamba']::text[]),
  ('Serra do Intendente', 'UC-074', 'Parque Estadual Serra do Intendente', '640', array['PE Serra do Intendente']::text[]),
  ('Serra do Ouro Branco', 'UC-075', 'Parque Estadual Serra do Ouro Branco', '674', array['PE Serra do Ouro Branco']::text[]),
  ('Serra do Papagaio', 'UC-076', 'Parque Estadual da Serra do Papagaio', '711', array['PE Serra do Papagaio']::text[]),
  ('Serra do Rola Moça', 'UC-077', 'Parque Estadual da Serra do Rola Moça', '763', array['PE Serra do Rola Moça','Parque Estadual da Serra do Rola Moca']::text[]),
  ('Serra do Sabonetal', 'UC-078', 'Área de Proteção Ambiental Estadual Serra do Sabonetal', '657', array['APA Estadual Serra do Sabonetal','APA Serra do Sabonetal']::text[]),
  ('Serra do Sobrado', 'UC-079', 'Parque Estadual da Serra do Sobrado', '688', array['PE Serra do Sobrado']::text[]),
  ('Serra Negra', 'UC-080', 'Parque Estadual da Serra Negra', '641', array['PE Serra Negra']::text[]),
  ('Serra Negra da Mantiqueira', 'UC-081', 'Parque Estadual Serra Negra da Mantiqueira', '1744', array['PE Serra Negra da Mantiqueira']::text[]),
  ('Serra Nova', 'UC-082', 'Parque Estadual de Serra Nova e Talhado', '700', array['PE Serra Nova']::text[]),
  ('Serra Verde', 'UC-083', 'Parque Estadual Serra Verde', '673', array['PE Serra Verde']::text[]),
  ('Sete Salões', 'UC-084', 'Parque Estadual de Sete Salões', '707', array['PE Sete Salões','Parque Estadual de Sete Saloes']::text[]),
  ('Sul RMBH', 'UC-085', 'Área de Proteção Ambiental Estadual Sul RMBH', '679', array['APA Estadual Sul RMBH','APA Sul RMBH']::text[]),
  ('Sumidouro', 'UC-086', 'Parque Estadual do Sumidouro', '660', array['PE Sumidouro']::text[]),
  ('Todos os Santos', 'UC-087', null, null, array['APE Todos os Santos']::text[]),
  ('Tripuí', 'UC-088', 'Estação Ecológica Estadual do Tripuí', '677', array['EE Tripuí','Estacao Ecologica Estadual do Tripui']::text[]),
  ('Uaimií', 'UC-089', 'Floresta Estadual do Uaimií', '684', array['FLOE Uaimií','Floresta Estadual do Uaimii']::text[]),
  ('Vargem da Pedra', 'UC-090', 'Monumento Natural Estadual Vargem da Pedra', '665', array['MN Vargem da Pedra']::text[]),
  ('Vargem das Flores', 'UC-091', 'Área de Proteção Ambiental Estadual de Vargem das Flores', '682', array['APA Estadual de Vargem das Flores','APA Vargem das Flores']::text[]),
  ('Várzea da Lapa', 'UC-092', 'Monumento Natural Estadual Várzea da Lapa', '666', array['MN Várzea da Lapa','Monumento Natural Estadual Varzea da Lapa']::text[]),
  ('Várzea do Lageado e Serra do Raio', 'UC-093', 'Monumento Natural Estadual Várzea do Lageado e Serra do Raio', '1442', array['MN Várzea do Lageado e Serra do Raio','Monumento Natural Estadual Varzea do Lageado e Serra do Raio']::text[]),
  ('Verde Grande', 'UC-094', 'Parque Estadual do Verde Grande', null, array['PE Verde Grande']::text[]),
  ('Veredas do Acari', 'UC-095', 'Reserva de Desenvolvimento Sustentável Estadual Veredas do Acari', '658', array['RDS Veredas do Acari','Reserva de Desenvolvimento Sustentavel Estadual Veredas do Acari']::text[]),
  ('Veredas do Peruaçu', 'UC-096', 'Parque Estadual Veredas do Peruaçu', '648', array['PE Veredas do Peruaçu','Parque Estadual Veredas do Peruacu']::text[])
) v(nome_uc, cod, nome, ide, var)
where u.nome_uc = v.nome_uc;

-- novas UCs: próximo código automaticamente
create sequence if not exists uc_cod_seq;
select setval('uc_cod_seq', (select coalesce(max(substr(cod_uc, 4)::int), 0) from uc where cod_uc ~ '^UC-\d+$'));
alter table uc alter column cod_uc set default 'UC-' || lpad(nextval('uc_cod_seq')::text, 3, '0');
update uc set cod_uc = default where cod_uc is null;
alter table uc alter column cod_uc set not null;
alter table uc add constraint uc_cod_uc_unico unique (cod_uc);

-- o código não muda depois de criado
create or replace function tg_uc_cod_fixo() returns trigger language plpgsql as $$
begin
  if new.cod_uc is distinct from old.cod_uc then raise exception 'O código da UC (%) é fixo e não pode ser alterado.', old.cod_uc; end if;
  return new;
end $$;
create trigger uc_cod_fixo before update of cod_uc on uc for each row execute function tg_uc_cod_fixo();
