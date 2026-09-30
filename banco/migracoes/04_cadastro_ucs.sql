-- =====================================================================
--  PORTAL PREVINCÊNDIO — CADASTRO DAS UNIDADES DE CONSERVAÇÃO
--  Rodar UMA vez no SQL Editor (depois do 01, 02 e 03).
--
--  Dados fixos de cada UC. O formulário preenche e TRAVA esses campos ao
--  escolher a unidade. Para corrigir: Table Editor → uc → editar a célula.
--  Valores iniciais tirados do histórico 2013–2025 (valor mais frequente,
--  com peso maior para 2022 em diante). Conferir os casos marcados no fim.
--
--  gerente / telefone: preencher no Table Editor; o formulário sugere,
--  mas deixa editar (mudam com o tempo).
-- =====================================================================
create table uc (
  nome_uc    text primary key,
  categoria  text,
  grupo      text,
  bioma_uc   text,
  ufbio      text,
  base_op    text,
  municipios text[],          -- municípios da UC (sugestões no formulário)
  gerente    text,
  telefone   text,
  ativo      boolean not null default true,
  atualizado_em timestamptz not null default now()
);
comment on table uc is 'Cadastro fixo das UCs: o formulário do ROI preenche e trava categoria, grupo, bioma, regional e base.';
create trigger uc_atualizado before update on uc for each row execute function tg_atualizado_em();

alter table uc enable row level security;
create policy uc_leitura on uc for select to anon, authenticated using (true);
create policy equipe_uc  on uc for all to authenticated using (true) with check (true);

insert into uc (nome_uc, categoria, grupo, bioma_uc, ufbio, base_op, municipios) values
  ('Acauã', 'ESEC', 'Proteção Integral', 'Cerrado', 'Jequitinhonha', 'Base Operacional de Curvelo', array['Leme do Prado','Turmalina']::text[]),
  ('Alto Cariri', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Nordeste', 'Base Operacional de Curvelo', array['Santa Maria do Salto','Salto da Divisa']::text[]),
  ('Alto Mucuri', 'APA', 'Uso Sustentável', 'Mata Atlântica', 'Nordeste', 'Base Operacional de Curvelo', array['Ladainha','Poté','Itaipé','Teófilo Otoni','Catuji','Malacacheta','Novo Cruzeiro','Caraí','Itambacuri']::text[]),
  ('Arêdes', 'ESEC', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Itabirito']::text[]),
  ('Bacia Hidrográfica do Rio Machado', 'APA', 'Uso Sustentável', 'Mata Atlântica', 'Sul', 'Base Operacional de Curvelo', array['Machado','Poço Fundo','Ipuiúna','Alfenas','Paraguaçu','Espirito Santo Dourado','Ipuiuna','Ipuiúna, Espírito Santo do Dourado','Espírito Santo Dourado','Fama','São João da Mata','Espírito Santo do Dourado']::text[]),
  ('Baleia', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Metropolitano', 'Base Operacional de Curvelo', array['Belo Horizonte','Nova Lima']::text[]),
  ('Biribiri', 'PAR', 'Proteção Integral', 'Cerrado', 'Jequitinhonha', 'Base Operacional de Curvelo', array['Diamantina']::text[]),
  ('Botumirim', 'PAR', 'Proteção Integral', 'Cerrado', 'Norte', 'Sub Base de Januária', array['Botumirim']::text[]),
  ('Cachoeira das Andorinhas', 'APA', 'Uso Sustentável', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Ouro Preto','Mariana','Itabirito']::text[]),
  ('Caminho dos Gerais', 'PAR', 'Proteção Integral', 'Caatinga/Cerrado', 'Norte', 'Sub Base de Januária', array['Gameleiras','Monte Azul','Espinosa','Mamonas']::text[]),
  ('Campos Altos', 'PAR', 'Proteção Integral', 'Cerrado', 'Alto Paranaíba', 'Base Operacional de Curvelo', array['Campos Altos','Córrego Danta']::text[]),
  ('Cercadinho', 'ESEC', 'Proteção Integral', 'Mata Atlântica', 'Metropolitano', 'Base Operacional de Curvelo', array['Belo Horizonte']::text[]),
  ('Cochá e Gibão', 'APA', 'Uso Sustentável', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Bonito de Minas','Januária']::text[]),
  ('Corumbá', 'ESEC', 'Proteção Integral', 'Cerrado', 'Centro Oeste', 'Base Operacional de Curvelo', array['Arcos']::text[]),
  ('Fechos', 'ESEC', 'Proteção Integral', 'Mata Atlântica', 'Metropolitano', 'Base Operacional de Curvelo', array['Nova Lima']::text[]),
  ('Fernão Dias', 'APA', 'Uso Sustentável', 'Mata Atlântica', 'Sul', 'Base Operacional de Curvelo', array['Camanducaia','Extrema','Itapeva','Toledo','Sapucaí-Mirim','Paraisópolis','Brazópolis','Gonçalves']::text[]),
  ('Gruta Rei do Mato', 'MONA', 'Proteção Integral', 'Cerrado', 'Centro Norte', 'Base Operacional de Curvelo', array['Sete Lagoas']::text[]),
  ('Grão Mogol', 'PAR', 'Proteção Integral', 'Cerrado', 'Norte', 'Sub Base de Januária', array['Grão Mogol']::text[]),
  ('Ibitipoca', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Mata', 'Base Operacional de Curvelo', array['Lima Duarte','Bias Fortes','Santa Rita do Ibitipoca','Santana do Garambéu']::text[]),
  ('Itacolomi', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Mariana','Ouro Preto']::text[]),
  ('Itatiaia', 'MONA', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Ouro Preto','Ouro Branco']::text[]),
  ('Jaíba', 'REBIO', 'Proteção Integral', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Matias Cardoso']::text[]),
  ('Lagedão', 'APA', 'Uso Sustentável', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Matias Cardoso']::text[]),
  ('Lagoa do Cajueiro', 'PAR', 'Proteção Integral', 'Caatinga/Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Matias Cardoso','Jaíba','Matias Cardoso e Jaíba']::text[]),
  ('Lapa Grande', 'PAR', 'Proteção Integral', 'Cerrado', 'Norte', 'Sub Base de Januária', array['Montes Claros']::text[]),
  ('Lapa Nova de Vazante', 'MONA', 'Proteção Integral', 'Cerrado/Mata Atlântica', 'Noroeste', 'Base Operacional de Curvelo', array['Vazante']::text[]),
  ('Libélulas da Serra de São José', 'RVS', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Santa Cruz de Minas','Tiradentes','São João Del Rei','Prados','Coronel Xavier Chaves','São João del Rei','Cel.Xavier Chaves']::text[]),
  ('Macaúbas', 'RVS', 'Proteção Integral', 'Cerrado', 'Metropolitano', 'Base Operacional de Curvelo', array['Santa Luzia','Lagoa Santa']::text[]),
  ('Mata Seca', 'PAR', 'Proteção Integral', 'Caatinga/Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Manga','Itacarambi']::text[]),
  ('Mata de Krambeck', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Mata', 'Base Operacional de Curvelo', array['Juiz de Fora']::text[]),
  ('Mata do Cedro', 'ESEC', 'Proteção Integral', 'Mata Atlântica', 'Centro Oeste', 'Base Operacional de Curvelo', array['Carmópolis de Minas','Cláudio']::text[]),
  ('Mata do Limoeiro', 'PAR', 'Proteção Integral', 'Cerrado', 'Rio Doce', 'Base Operacional de Curvelo', array['Itabira','Itabirito']::text[]),
  ('Mata dos Ausentes', 'ESEC', 'Proteção Integral', 'Cerrado', 'Jequitinhonha', 'Base Operacional de Curvelo', array['Senador Modestino Gonçalves','Felício dos Santos']::text[]),
  ('Mata dos Muriquis', 'RVS', 'Proteção Integral', 'Mata Atlântica', 'Nordeste', 'Base Operacional de Curvelo', array['Santa Maria do Salto','Guaratinga']::text[]),
  ('Montezuma', 'PAR', 'Proteção Integral', 'Cerrado/Mata Atlântica', 'Norte', 'Sub Base de Januária', array['Montezuma']::text[]),
  ('Nova Baden', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Sul', 'Base Operacional de Curvelo', array['Lambari','Cambuquira','Campanha']::text[]),
  ('Pandeiros', 'APA', 'Uso Sustentável', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Bonito de Minas','Januária','Cônego Marinho']::text[]),
  ('Paracatu', 'PAR', 'Proteção Integral', 'Cerrado', 'Noroeste', 'Base Operacional de Curvelo', array['Paracatu']::text[]),
  ('Parque Cataguás', 'APA', 'Uso Sustentável', 'Mata Atlântica', 'Metropolitano', 'Base Operacional de Curvelo', array['Betim','Contagem']::text[]),
  ('Pau Furado', 'PAR', 'Proteção Integral', 'Cerrado', 'Triângulo', 'Base Operacional de Curvelo', array['Uberlândia','Araguari']::text[]),
  ('Peter Lund', 'MONA', 'Proteção Integral', 'Cerrado', 'Centro Norte', 'Base Operacional de Curvelo', array['Cordisburgo']::text[]),
  ('Pico da Ibituruna', 'MONA', 'Proteção Integral', 'Mata Atlântica', 'Rio Doce', 'Base Operacional de Curvelo', array['Governador Valadares']::text[]),
  ('Pico do Itambé', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Jequitinhonha', 'Base Operacional de Curvelo', array['Santo Antônio do Itambé','Serro','Serra Azul de Minas']::text[]),
  ('Rio Corrente', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Rio Doce', 'Base Operacional de Curvelo', array['Açucena']::text[]),
  ('Rio Doce', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Rio Doce', 'Base Operacional de Curvelo', array['Marliéria','Timóteo','Dionísio','Bom Jesus do galho','Jaguaraçu']::text[]),
  ('Rio Pandeiros', 'RVS', 'Proteção Integral', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Januária']::text[]),
  ('Rio Preto', 'PAR', 'Proteção Integral', 'Cerrado', 'Jequitinhonha', 'Base Operacional de Curvelo', array['São Gonçalo do Rio Preto','Couto de Magalhães de Minas','Felício dos Santos','Diamantina','Couto de Mag. de Minas']::text[]),
  ('Rios Tijuco e da Prata', 'RVS', 'Proteção Integral', 'Cerrado', 'Triângulo', 'Base Operacional de Curvelo', array['Ituiutaba']::text[]),
  ('Sagarana', 'PAR', 'Proteção Integral', 'Cerrado', 'Noroeste', 'Sub Base de Januária', array['Arinos','Riachinho']::text[]),
  ('Santa Izabel e Espalha', 'APE', 'Uso Sustentável', 'Cerrado', 'Noroeste', 'Base Operacional de Curvelo', array['Paracatu']::text[]),
  ('Seminário Menor de Mariana', 'APA', 'Uso Sustentável', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Mariana']::text[]),
  ('Serra Azul', 'REBIO', 'Proteção Integral', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Jaíba']::text[]),
  ('Serra Negra', 'PAR', 'Proteção Integral', 'Cerrado/Mata Atlântica', 'Jequitinhonha', 'Base Operacional de Curvelo', array['Itamarandiba']::text[]),
  ('Serra Negra da Mantiqueira', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Mata', 'Base Operacional de Curvelo', array['Olaria','Lima Duarte','Santa Bárbara do Monte Verde']::text[]),
  ('Serra Nova', 'PAR', 'Proteção Integral', 'Cerrado/Mata Atlântica', 'Norte', 'Sub Base de Januária', array['Rio Pardo de Minas','Porteirinha','Mato Verde','Serranópolis de Minas','Riacho dos Machados']::text[]),
  ('Serra Verde', 'PAR', 'Proteção Integral', 'Cerrado', 'Metropolitano', 'Base Operacional de Curvelo', array['Belo Horizonte','Vespasiano']::text[]),
  ('Serra da Boa Esperança', 'PAR', 'Proteção Integral', 'Cerrado', 'Sul', 'Base Operacional de Curvelo', array['Boa Esperança','Ilicínea','Guapé','IIicínea']::text[]),
  ('Serra da Candonga', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Rio Doce', 'Base Operacional de Curvelo', array['Guanhães']::text[]),
  ('Serra da Moeda', 'MONA', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Moeda','Itabirito','Brumadinho','Ouro Preto','Nova Lima']::text[]),
  ('Serra da Piedade', 'MONA', 'Proteção Integral', 'Mata Atlântica', 'Metropolitano', 'Base Operacional de Curvelo', array['Caeté','Sabará']::text[]),
  ('Serra das Araras', 'PAR', 'Proteção Integral', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Chapada Gaúcha','Chapada do Norte']::text[]),
  ('Serra das Aroeiras', 'RVS', 'Proteção Integral', 'Cerrado', 'Centro Norte', 'Base Operacional de Curvelo', array['Pedro Leopoldo','São José da Lapa']::text[]),
  ('Serra do Brigadeiro', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Mata', 'Base Operacional de Curvelo', array['Pedra Bonita','Ervália','Sericita','Araponga','Fervedouro','Miradouro','Muriaé','Canaã','Divino','Pouso Alto']::text[]),
  ('Serra do Cabral', 'PAR', 'Proteção Integral', 'Cerrado', 'Norte', 'Sub Base de Januária', array['Buenópolis','Joaquim Felício','Augusto de Lima']::text[]),
  ('Serra do Intendente', 'PAR', 'Proteção Integral', 'Cerrado/Mata Atlântica', 'Jequitinhonha', 'Base Operacional de Curvelo', array['Conceição do Mato Dentro','Santana do Riacho','Congonhas do Norte','Morro do Pilar']::text[]),
  ('Serra do Ouro Branco', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Ouro Branco','Ouro Preto']::text[]),
  ('Serra do Papagaio', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Sul', 'Base Operacional de Curvelo', array['Alagoa','Baependi','Aiuruoca','Itamonte','Pouso Alto']::text[]),
  ('Serra do Rola Moça', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Metropolitano', 'Base Operacional de Curvelo', array['Belo Horizonte','Ibirité','Nova Lima','Brumadinho']::text[]),
  ('Serra do Sabonetal', 'APA', 'Uso Sustentável', 'Caatinga/Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Itacarambi','Jaíba','Pedra de Maria da Cruz']::text[]),
  ('Serra do Sobrado', 'PAR', 'Proteção Integral', 'Cerrado', 'Centro Norte', 'Base Operacional de Curvelo', array['São José da Lapa','Confins','Pedro Leopoldo']::text[]),
  ('Sete Salões', 'PAR', 'Proteção Integral', 'Mata Atlântica', 'Rio Doce', 'Base Operacional de Curvelo', array['Resplendor','Conselheiro Pena','Santa Rita do Ituêto','Santa Rita do Itueto']::text[]),
  ('Sul RMBH', 'APA', 'Uso Sustentável', 'Mata Atlântica', 'Metropolitano', 'Base Operacional de Curvelo', array['Nova Lima','Brumadinho','Belo Horizonte','Itabirito','Rio Acima','Santa Bárbara','Catas Altas','Mário Campos','Caeté']::text[]),
  ('Sumidouro', 'PAR', 'Proteção Integral', 'Cerrado', 'Centro Norte', 'Base Operacional de Curvelo', array['Pedro Leopoldo','Lagoa Santa','Confins']::text[]),
  ('São José', 'APA', 'Uso Sustentável', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Santa Cruz de Minas','Tiradentes','São João Del Rei','Prados']::text[]),
  ('Todos os Santos', 'APE', 'Uso Sustentável', 'Mata Atlântica', 'Nordeste', 'Base Operacional de Curvelo', array['Teófilo Otoni']::text[]),
  ('Tripuí', 'ESEC', 'Proteção Integral', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Ouro Preto']::text[]),
  ('Uaimií', 'FLOE', 'Uso Sustentável', 'Mata Atlântica', 'Centro Sul', 'Base Operacional de Curvelo', array['Ouro Preto','Mariana','Santa Bárbara','Ouro Branco']::text[]),
  ('Vargem da Pedra', 'MONA', 'Proteção Integral', 'Cerrado', 'Centro Norte', 'Base Operacional de Curvelo', array[]::text[]),
  ('Vargem das Flores', 'APA', 'Uso Sustentável', 'Cerrado/Mata Atlântica', 'Metropolitano', 'Base Operacional de Curvelo', array['Contagem','Betim']::text[]),
  ('Verde Grande', 'PAR', 'Proteção Integral', 'Caatinga/Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Matias Cardoso']::text[]),
  ('Veredas do Acari', 'RDS', 'Uso Sustentável', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Chapada Gaúcha','Urucuia']::text[]),
  ('Veredas do Peruaçu', 'PAR', 'Proteção Integral', 'Cerrado', 'Alto Médio São Francisco', 'Sub Base de Januária', array['Januária','Cônego Marinho']::text[]),
  ('Várzea da Lapa', 'MONA', 'Proteção Integral', 'Cerrado', 'Centro Norte', 'Base Operacional de Curvelo', array['Lagoa Santa']::text[]),
  ('Várzea do Lageado e Serra do Raio', 'MONA', 'Proteção Integral', 'Mata Atlântica', 'Jequitinhonha', 'Base Operacional de Curvelo', array['Serro','serro']::text[]),
  ('Água Limpa', 'ESEC', 'Proteção Integral', 'Mata Atlântica', 'Mata', 'Base Operacional de Curvelo', array['Cataguases']::text[]),
  ('Águas Vertentes', 'APA', 'Uso Sustentável', 'Cerrado/Mata Atlântica', 'Jequitinhonha', 'Base Operacional de Curvelo', array['Serro','Couto de Magalhães de Minas','Serra Azul de Minas','Diamantina','Santo Antônio do Itambé','Felício dos Santos','Rio Vermelho']::text[]);

-- NOTAS:
--   Mata de Krambeck : era APA, virou Parque Estadual (~2023). O cadastro vale
--                      para ROIs novos (PAR); os registros antigos mantêm a
--                      categoria da época na tabela roi.
--   Pandeiros (APA) e Rio Pandeiros (RVS): são duas UCs distintas, cada uma
--                      com seu cadastro. O formulário mostra a categoria ao
--                      lado do nome para evitar confusão.
--   Sagarana         : regional Noroeste (18 registros) x Nordeste (2) — conferir.
