# Decisões do projeto Colibri

Registro das escolhas feitas com o Rodolfo, para não serem rediscutidas nem desfeitas por engano. Acrescente no fim de cada seção, com data.

## Visão geral
- Nome: **Colibri · Sistema Integrado de Gestão do Fogo em Unidades de Conservação** (antes SIGFogo). O Previncêndio continua sendo o programa/gerência. Identidade visual verde; logos do Colibri, Previncêndio e IEF no topo.
- Cabeçalho da página inicial (4 linhas): Instituto Estadual de Florestas - IEF MG / Diretoria de Unidades de Conservação - DIUC / Gerência de Prevenção e Combate a Incêndios Florestais - Previncêndio / Coordenação de Informações Previncêndio. O nome Colibri não se repete (já está no logo). O login é oferecido logo na página inicial.
- Construção "por partes": cada módulo entra como protótipo funcional e é ajustado com o uso.

## Ocorrências (RI, ROI, Sala Técnica)
- RI é documento da Sala de Situação (só equipe com login); ROI é da UC. Fluxo: RI → ROI (10 dias após o fim do incêndio) → REDS (PM Ambiental/Bombeiros) → processo SEI → Polícia Civil. A Sala Técnica controla prazos e cobranças.
- ROI final é exportado em PDF e autenticado no SEI (o formulário em si não exige assinatura).
- Quando Sala e UC divergem (ex.: empenho de pessoal/veículos), **vale a UC**, porque esteve no campo.
- Os eventos realmente ocorridos em 2026 são os RIs com nome de UC preenchido; os demais números foram reservados na planilha antiga.
- ROIs de 2026 em PDF são transcritos pela equipe do Previncêndio no importador de PDFs (`roi_importar.html`).
- A seção de empenho (pessoal/veículos) do RI e do ROI será redesenhada e unificada, provavelmente valendo a partir de 2027, mesmo que os dados fiquem diferentes dos anos anteriores.

## Cadastro das UCs (PIPCIF)
- O PIPCIF vira módulos do cadastro; ~60 gerentes (alguns com até 3 UCs) fazem login. Todos veem todas as UCs; cada um edita só as suas; toda alteração fica registrada (auditoria).
- O PIPCIF passa a ser um relatório gerado a partir dos módulos.
- Carga dos PIPCIF 2026: ver `docs/pipcif.md`.

## Mapa de risco (módulo 6)
- Ver `docs/mapa_risco.md` (método, receita e diário de decisões).
- Duas vertentes: **mapa de risco** (técnico, método único estadual, responsabilidade do Previncêndio) e **mapa de planejamento** (anual, competência do gerente; o Previncêndio comenta, não decide).
- Interface para gerentes sem formação técnica: sem pesos ou índices na tela; cores e frases simples; "por que esta área?"; conferência em passos (concordo/discordo + nota, marcações, seção 14 gerada).
- O mapa vive no módulo 6; os outros lugares (Painel, Geo Colibri, futura Sala) só o mostram como camada.
- Trilhas e acessos (`uc_via`) poderão entrar como variável de ignição quando o cadastro estiver completo; aceiros entram como capacidade, não como risco.

## Geo Colibri (`mapa.html`)
- Visualizador só para usuários logados (há dados não públicos).
- Ocorrências e áreas queimadas são visíveis a **todos os usuários logados**, sem dados pessoais (sem nomes, telefones, REDS, descrição). Contatos de parceiros/colaboradores ficam fora do mapa e das exportações.
- **Sem camadas do IDE-Sisema** (06/10/2026): considerado redundante; o Geo Colibri mostra só o que está no banco do Colibri.
- Na página inicial, fica ao lado do Painel da UC, com ícone próprio.

## Privacidade e infraestrutura
- Repositório público: só código, estrutura do banco e dados públicos.
- Dados internos só no Supabase, com RLS.
- pdf.js hospedado no próprio site (o cdnjs é bloqueado em computadores do Estado).

## Empenho de recursos (pessoas, veículos, aeronaves) — decisões de 07/10/2026
- Cadastro único de empenho (categorias → instituições → tipos de recurso), usado pelo RI e pelo ROI; o ROI registra por dia e turno, como o RI, e o PDF segue essa lógica.
- Vale a partir de 2027; 2026 só para testes; migração/revisão dos textos de 2026 no fim da temporada.
- Histórico 2013–2025 fica no nível de categoria (as colunas antigas do ROI); não se tenta inferir instituição.
- Categorias novas podem ser separadas (municípios, empresas, órgãos públicos etc.), mas cada uma soma numa coluna antiga para manter a série.
- CFM = Compensação Florestal Minerária; a AMDA opera o contrato de serviços com a Vale via CFM.
- PM e CBMMG sem detalhar pelotão. Brigada municipal = parceiro (categoria Municípios).
- A classificação é decidida no "Quadro de classificação do empenho" (artefato privado do Rodolfo) antes de gravar no banco.
- Shapefile do BDG: hoje leva só o empenho do maior dia (limite de colunas). Proposta: polígono com colunas-resumo + tabela de empenho à parte ligada por cod_bdp (CSV/DBF) e GeoPackage com as duas tabelas.
- Respostas do quadro (07/10/2026): Gerente da UC em categoria própria (separado dos funcionários); FTP mantém o nome "Brigada Previncêndio (FTP)" (hoje contratada via CBMMG); IEF de outras UCs/URFBio em categoria própria; COMAVE na Polícia Militar; só a Brigada CFM AMDA/Previncêndio é CFM — bases AMDA que atendem empresas contam como da empresa (AMDA como operadora, em observação); brigada de empresa operada por terceira = empresa como instituição, operadora em observação; estatais = Empresas; uma prefeitura por município; voluntário avulso = "Voluntários sem organização"; veículos e aeronaves sempre ligados à instituição; pessoas só por quantidade; empenho por dia com hora de início e fim (sem turnos); comunidade e particulares em categoria própria.
- Aeronaves: desde 2024 há dois contratos — aeronaves CFM (contratadas pelo IEF via Vale) e aeronaves FTP (contratadas pelo CBMMG); registrar o contrato da aeronave.
- Catálogo consolidado: 189 nomes viraram ~140 instituições. EPAMIG = Empresa. Brigada AMDA (Arêdes) e AMDA – UOpSV = CFM. AMDA Congonhas, Metropolitana, Barão de Cocais e AMDA/Voluntários = brigadas vinculadas a empresas contratantes (Empresas). AMDA como associação = parceiro (ONG).
