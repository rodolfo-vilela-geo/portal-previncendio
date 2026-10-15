# Colibri — Sistema Integrado de Gestão do Fogo em Unidades de Conservação (IEF-MG)

Leia este arquivo inteiro antes de mexer no projeto. Ele é a "receita do bolo": como o sistema é montado, como testar, como publicar e o que já foi decidido. Mantenha-o atualizado ao fim de cada sessão de trabalho (seção "Estado atual e próximos passos").

## Quem e o quê

- Dono do projeto: Rodolfo (analista ambiental, IEF-MG), Gerência de Prevenção e Combate a Incêndios Florestais — **Previncêndio** — da Diretoria de Unidades de Conservação (DIUC). Na interface, escreva sempre "Previncêndio" (não "GPCIF"; esse nome só existe internamente em funções como `is_gpcif()`).
- Usuários: equipe do Previncêndio, Sala de Situação, Sala Técnica, gerentes das UCs (muitos sem formação técnica — a interface precisa ser simples, em português claro).
- Site estático no GitHub Pages: https://rodolfo-vilela-geo.github.io/portal-previncendio/ (este repositório, **público**).
- Banco: Supabase, projeto `nhsjsttvxixgfqnweqos` (Postgres + PostGIS, SRID 4674). Acesso nas sessões do Claude só pelo conector MCP do Supabase (a rede do espaço de trabalho não alcança o Supabase).

## Regras que não se quebram

1. **Repositório público: nada de dado pessoal aqui.** Nada de conteúdo de PIPCIF, nomes, telefones, e-mails, REDS, descrições de ROI, JSONs exportados, planilhas do BDG. `banco/` guarda só estrutura (e dados públicos: limites das UCs do IDE-Sisema, municípios do IBGE).
2. Dados sensíveis ficam no banco, protegidos por RLS (só usuários logados). Nada de arquivo estático com dados internos.
7. **Só o Painel de ocorrências (`painel.html`) e o Painel Informativo da Força Tarefa (`boletim.html`, antigo "Boletim da FTP") são públicos.** Todas as outras páginas exigem login (as que não têm tela de login própria usam `exige_login.js`, que manda para `index.html?entrar=1&volta=...`). O anônimo não grava nada no banco e só executa `painel_dados` e `boletim_publico` (migração 33). Página ou função nova: restrita por padrão.
3. Conversores de PIPCIF, exportações JSON e shapefiles do BDG ficam **fora** do repositório (pacote privado do Rodolfo — veja "Backup").
4. Histórico de fogo do mapa de risco: **somente BDG 2013–2025**. Não usar MapBiomas Fogo (metodologia diferente). MapBiomas uso e cobertura pode.
5. Diferença entre Sala e UC no ROI/RI: vale a UC ("porque é quem esteve no campo").
6. Toda alteração de banco vira um arquivo numerado em `banco/migracoes/` e uma linha em `banco/README.md`.

## Mapa do repositório

| Página / arquivo | Para quê |
|---|---|
| `exige_login.js` | Guarda das páginas restritas sem tela de login própria (ROI, SMC) |
| `index.html` | Página inicial (cabeçalho institucional IEF/DIUC/Previncêndio, login em diálogo, cards por público, seção Gestão por papel) |
| `roi.html` + `roi_empenho.js` + `gpkg.js` | Formulário do ROI (Relatório de Ocorrência de Incêndio). `?importar=1` = modo usado dentro do importador de PDFs (aí vale a tabela antiga de evolução). `roi_empenho.js`: seção 2.2 nova (recursos empenhados por dia e instituição) que calcula a evolução antiga e a seção 3. `gpkg.js` + `lib/sqljs/`: GeoPackage no pacote do BDG |
| `roi_vegetacao.js` + `vegetacao_importar.html` | Seção 4 do ROI calculada pelo Inventário Florestal de MG (`vegetacao_poligono`); página de carga do inventário (só Previncêndio, em lotes, retoma de onde parou). O shapefile recortado (UCs + ZAs + 5 km) fica no pacote privado/IDE-Sisema, não no repositório |
| `roi_importar.html` + `roi_pdf.js` | Importa ROIs em PDF (modelo Word da DIUC) lendo o PDF no navegador (pdf.js em `lib/pdfjs/`, hospedado aqui porque o cdnjs é bloqueado em máquinas do Estado) |
| `sala.html` | Sala de Situação (RI, recursos empenhados por dia sem turnos, apoios, catálogo de instituições com categorias e pendentes, listas suspensas) |
| `tecnica.html` | Sala Técnica (prazos, cobranças, SEI/PC/CAINF) |
| `bdg.html` | Polígonos do BDG (cicatrizes, polígonos ausentes) |
| `smc.html` | Ligação com o SMC (Sistema de Mapeamento de Cicatrizes, app no GEE); só abre logado (o endereço do app entra depois do login) |
| `boletim.html`, `painel.html` | Painel Informativo da Força Tarefa (nome na interface desde 15/10/2026; o arquivo continua `boletim.html`) e painel histórico, públicos (sem dados pessoais). O Painel Informativo mostra o ponto do incêndio em andamento quando o RI tem coordenada (migração 49) |
| `painel_uc.html` | Painel da UC (indicadores, mapa; inclui a camada de risco) |
| `ucs.html` + `pipcif_modulos.js` + `modulos_uc.js` | Cadastro da UC em módulos (1 Cadastro, 2 Infraestrutura, 3 Recursos, 4 Rede de apoio, 5 Atividades preventivas, 6 Mapa de risco, 7 Plano operacional) |
| `modulo_operacional.js` + `geo_entrada.js` | Módulo 7: parte comum (protocolos, no código: `FLUXO`, `CENARIOS`, `BASE`, `VERSAO`), setores operacionais (`uc_setor`, desenhar/importar/zoneamento), cenários, comando, prontidão, pós-incêndio, revisão com o CBMMG (`uc_operacional`), impressão da ficha de acionamento + seção 15. `geo_entrada.js` lê polígonos de KML/KMZ/GeoJSON/Shapefile .zip (corrige eixos trocados) |
| `risco_mapa.js` + `modulo_risco.js` | Módulo 6: mapa de risco, conferência do gerente, seção 14 do PIPCIF |
| `apoio_aereo.html` | Cadastro único de apoio aéreo (`recurso_aereo`: aeródromos do IDE-Sisema + pistas/helipontos/áreas de pouso dos PIPCIFs; `uc_ponto.recurso_id` liga a UC). Lista com revisão, mapa, edição só Previncêndio, histórico. Carga inicial no pacote privado |
| `mapa.html` | **Geo Colibri**: visualizador de todas as camadas do banco (só logados), filtro por ano, fichas, exportação GeoJSON/KML/CSV; camada do Inventário Florestal (desligada por padrão, por caixa a partir do zoom 11); camada única "Apoio aéreo" (recurso_aereo) no lugar de pistas/helipontos; `medir.js` = medir distância, área (UTM SIRGAS) e coordenada, com KML/GeoJSON; exportação recortada pela área desenhada (Turf em `lib/turf/`, carregado só nessa hora); `geo_saida.js` = Shapefile (.zip) e GeoPackage de várias camadas (sql.js) |
| `investigacao.html` | **Análise de Incêndio Florestal** (seção Monitoramento e Investigação da página inicial; só Previncêndio e Sala Técnica): busca do CAR em volta da UC (SICAR WFS via pg_net, `car_buscar`/`car_processar`), imóveis importados/desenhados (`imovel_incluir`, usa `geo_entrada.js` e `medir.js`), ranking de recorrência, ficha do imóvel (`imovel_ficha`: fogo ano a ano, padrões, gráficos, causas, ocorrências, sobreposições, versões do CAR, anotações), camadas de apoio (BDG, ocorrências, inventário, zoneamento, rodovias, ferrovias, municípios) |
| `pipcif_importar.html` | Importa PIPCIFs convertidos (JSON), mapas de risco (`formato: "colibri-risco-1"`) e zoneamentos de UC (`formato: "colibri-zoneamento-1"`) |
| `manual.html` | Manual do usuário (atualize junto com cada função nova) |
| `icones_mapa.js` | Ícones SVG dos mapas (`iconeMapa`, `iconeLegenda`, `ICONES_ROTULO`) |
| `camadas_ref.js` | Camadas de referência públicas para qualquer mapa (desligadas por padrão, baixadas ao ligar): rodovias e ferrovias de MG do IDE-Sisema (`dados/rodovias_mg.geojson`, `dados/ferrovias_mg.geojson`, simplificados ~10 m por `ferramentas/transporte/gerar_transporte.py`). `CamadasRef.adicionar(mapa, controle?)` põe as duas no seletor de camadas; usado no Geo Colibri (grupo Transporte), módulos da UC, risco, plano operacional, painel da UC e apoio aéreo |
| `coord.js` | Coordenadas em graus, minutos e segundos (padrão desde 13/10/2026): `Coord.gms`, `Coord.attr` (campo com `data-dec`), `Coord.por`, `Coord.ler` (devolve o decimal original se o texto não mudou) |
| `dados/` | GeoJSON públicos (UCs, municípios, MG) |
| `banco/` | Planta do banco (ver `banco/README.md`) |
| `docs/` | Receitas e decisões (PIPCIF, mapa de risco, plano operacional, decisões gerais) |
| `ferramentas/` | Scripts de apoio sem dado pessoal (mapa de risco, testes locais) |

## Banco: o essencial

- Papéis (`equipe.papel`): `sala`, `tecnica`, `gpcif` (= Previncêndio), `admin`, `gerente`. Gerentes ligados às UCs em `usuario_uc`.
- Funções de permissão: `is_usuario()`, `is_equipe()`, `is_gpcif()` (Previncêndio ou admin), `is_tecnica()`, `is_admin()`, `pode_editar_uc(nome_uc)`, `meu_perfil()`.
- Padrão de RLS: leitura `is_usuario()`; edição `pode_editar_uc(nome_uc)`; o que é do Previncêndio, `is_gpcif()`. Funções de leitura especiais são `security definer` e testam `is_usuario()` por dentro (ex.: `geo_*` do Geo Colibri).
- Auditoria: gatilho `tg_auditoria()` → tabela `auditoria` (histórico exibido nos módulos).
- Empenho (2027 em diante; 2026 em teste): `empenho_categoria` (13 categorias, cada uma soma numa coluna antiga do ROI: `coluna`), `instituicao` (`grupo` = categoria; o gatilho acerta `categoria` = coluna antiga; `variantes` para busca; "(juntada)" = inativa por fusão; obs "PENDENTE…" = incluída pela Sala), `atuacao` (Sala), `roi_empenho` (ROI), `vw_roi_empenho_resumo`. Catálogo carregado em 07/10/2026 (carga no pacote privado).
- UC: chave `nome_uc` (nome curto); `cod_uc` = código interno fixo (UC-001…), `nome_oficial`, `cod_ide`, `variantes` (migração 41). Renomear UC = update em `uc` (cascata em todas as tabelas).
- Tabelas principais: `roi` (ocorrências; `cod_bdp`, `ano`, `ri`), `ri` (registro inicial da Sala, eventos do ano corrente com coordenada), `area_queimada` (polígonos do BDG), `uc`, `uc_limite` (tipo `uc`, `za_pm`, `za_3km`), `uc_cadastro`, `uc_infra`, `uc_ponto`, `uc_veiculo`, `uc_radio`, `uc_material`, `uc_parceiro`, `uc_prestador`, `uc_colaborador`, `uc_via`, `uc_elemento`, `uc_acao_preventiva`, `uc_acao_execucao`, `uc_projeto`, `uc_brigada`, `uc_risco`, `uc_risco_revisao`, `uc_zoneamento` (zoneamento do plano de manejo, referência; migração 45), `uc_setor` e `uc_operacional` (módulo 7; migração 46), `regional`, `municipio`, `imovel` / `imovel_versao` / `imovel_fogo` / `imovel_nota` / `car_busca` / `car_pedido` (Análise de Incêndio Florestal; migração 51; `imovel_fogo` é mantida por gatilhos em `imovel` e `area_queimada`).
- `pg_net` está ligado (migração 51): o banco faz pedidos HTTP (hoje só ao GeoServer do SICAR). Pelo MCP dá para testar funções que exigem login com `select set_config('request.jwt.claims', '{"email":"..."}', false)` antes da chamada.
- Pelo MCP: DDL pequeno com `apply_migration`; `execute_sql` para consultas. Escritas grandes, DELETEs e DROP COLUMN são cancelados (pedem confirmação que não chega) — o Rodolfo roda no SQL Editor do Supabase (New query → colar → Run); carga de dados volumosa vai pelas páginas de importação (o usuário importa logado).

## Como trabalhar

1. Editar as páginas (na sessão original o rascunho ficava em `/home/claude/portal-roi/src/`; numa sessão nova, edite direto no repositório).
2. Testar localmente (ver `ferramentas/testes/README.md`): Postgres + PostgREST locais com o mesmo esquema, servidor estático na porta 8765 e Playwright com Chromium (`/opt/pw-browsers`). As chamadas ao Supabase são redirecionadas para o PostgREST local.
3. Ao mudar um `.js` compartilhado, troque o `?v=AAAAMMDDx` nos `<script src>` que o carregam (cache do navegador).
4. Banco: criar `banco/migracoes/NN_nome.sql`, aplicar no local, aplicar no Supabase com `apply_migration`, listar no `banco/README.md`.
5. Publicar: `git commit` (mensagem em português) e `git push` — o GitHub Pages atualiza em ~1 min.
6. Atualizar `manual.html` quando houver função nova para o usuário.

## Receitas

- **PIPCIF → banco**: `docs/pipcif.md` (roteiro de conversão, um conversor por UC, teste no banco local, exportação JSON, importação pelo próprio Colibri).
- **Mapa de risco** (grade, GEE, modelo, exportação, importação): `docs/mapa_risco.md` e `ferramentas/risco/`.
- **ROIs em PDF**: `roi_importar.html` (a equipe do Previncêndio transcreve; seções detectadas pelo título, não pelo número).
- Decisões gerais e histórico: `docs/decisoes.md`.

## Estado atual e próximos passos (atualizado em 15/10/2026)

Feito: ROI/RI/Sala/Técnica/BDG/SMC; cadastro das UCs módulos 1–5 com PIPCIF 2026 de ~30 UCs (+5 PIPCIFs 2025 da Zona da Mata convertidos em 07/10/2026: Ibitipoca, Serra do Brigadeiro, Serra Negra da Mantiqueira, Água Limpa, Mar de Espanha; e 4 PIPCIFs 2026 de Monumentos Naturais do Centro Norte: Vargem da Pedra, Lapa Vermelha, Peter Lund, Santo Antônio; em 08/10/2026 mais 4 do Centro Norte: Serra das Aroeiras, Cerca Grande, Serra do Sobrado, Sumidouro; e 8 PIPCIFs 2024/2025 do Jequitinhonha e Alto Médio São Francisco: Águas Vertentes, Biribiri (2024), Pandeiros (APA), Cochá e Gibão, Serra Azul, Serra do Sabonetal, Serra das Araras, Veredas do Acari; em 13/10/2026 mais 3 do Norte: Lapa Grande (2025), Montezuma (2024), Botumirim (2024); e 7 PIPCIFs 2025: Campos Altos, Gruta Rei do Mato, Várzea da Lapa, Seminário Menor de Mariana, Tripuí, Uaimií, Pico do Itabirito; em 15/10/2026 mais 4 PIPCIFs 2026 da URFBio Rio Doce: Pico da Ibituruna, Mata do Limoeiro, Serra da Candonga, Sete Salões; e mais 7: Rio Doce (2025), Rios Tijuco e da Prata (2024), Parque Cataguás (2024, PIPCIF ainda com o nome antigo “APA Parque Fernão Dias”, que está nas `variantes`), Vargem das Flores (2024), Cachoeira das Andorinhas (2024), Rio Preto (2025), Sagarana (2025, nova versão, com ~120 colaboradores) — JSONs no pacote privado, a importar pelo Rodolfo); importador de ROIs em PDF; módulo 6 (mapa de risco — protótipo só da Serra do Cabral, com conferência do gerente e seção 14); Geo Colibri (visualizador, sem IDE-Sisema por decisão do Rodolfo); empenho padronizado (catálogo de 140 instituições em 13 categorias; Sala por dia sem turnos; ROI 2.2 nova pré-preenchida pela Sala; pacote do BDG com colunas-resumo emp_*, CSV do empenho e GeoPackage); vegetação do ROI pelo Inventário Florestal; cadastro único de apoio aéreo (tela + camada no Geo Colibri); Painel Informativo da Força Tarefa (antigo Boletim, 15/10/2026: ponto do incêndio, recursos em ícones, gráfico por semana, área queimada). Análise de Incêndio Florestal (15/10/2026, migração 51): CAR buscado no SICAR em volta da UC, imóveis importados/desenhados, recorrência do fogo por imóvel e ficha com padrões e anotações; já buscados em produção: Sagarana e Serra do Cabral.

Próximos (sem ordem fixa):
- Mapa de risco das demais UCs (mesma receita; atualização anual).
- Vertente "planejamento" do mapa (áreas e ações desenhadas pelo gerente → cronograma do módulo 5; futuro módulo de queimas).
- Camada de trilhas/acessos (`uc_via`) como variável do risco, quando o cadastro estiver completo.
- Camada de risco na Sala de Situação; visão estadual do risco.
- Módulo 7 (Plano operacional): feito em 14/10/2026 (migração 46) — ver `docs/plano_operacional.md`. Falta: telefone da coordenação do CBMMG; revisar a parte comum quando os protocolos mudarem (texto em `modulo_operacional.js`); conferir o Decreto 48.767/2024; normas por zona do plano de manejo (se for preciso, a partir dos planos de manejo). PIPCIF como relatório gerado dos módulos.
- Empenho: revisão/migração dos textos de 2026 no fim da temporada; exportação em lote do BDG com o empenho (hoje é por ROI); favoritas da UC também a partir dos parceiros do PIPCIF; conferir as pendentes no catálogo.
- Carregar os PIPCIFs restantes (8 UCs, sem contar as 2 APEs fora da gestão: Bacia Hidrográfica do Rio Uberaba, Experiência da Jaguara, Macaúbas, Rio Corrente, Serra do Cipó, Serra do Intendente, São Judas Tadeu, Várzea do Lageado e Serra do Raio) e depois o catálogo único de recursos compartilhados (Pampulha, mirantes entre UCs). Corrigir `pipcif_ano` de Pau Furado.
- Apoio aéreo: revisar os 157 lugares "a conferir" e a pista de Itamarandiba (os 52 aeródromos fora de MG foram excluídos em 14/10/2026; cadastro com 467 lugares); módulo 2 da UC mostrando os pontos próximos (`recursos_aereos_perto`). Novos pontos de PIPCIF/módulo 2 já se ligam sozinhos (gatilho da migração 40).
- Identificação das UCs: passos 1–3 feitos em 13/10/2026 (migração 41: FKs de roi/ri/uc_limite; `uc.cod_uc` UC-001…UC-096 fixo, `nome_oficial` do IDE com acentos — faltam as 2 APEs Santa Izabel e Espalha e Todos os Santos —, `cod_ide`, `variantes`; CNUC descartado por decisão do Rodolfo). Falta o passo 4: mostrar `cod_uc`/`nome_oficial` nas exportações (BDG, Geo Colibri, CSV), no PDF do ROI e no PIPCIF gerado; importadores (ROI em PDF, PIPCIF) reconhecerem a UC pelas `variantes`; tela para o Previncêndio editar nome oficial e variantes. NÃO trocar a chave `nome_uc`.
- Ideia para depois (13/10/2026): ROI offline no navegador (PWA, sem app de loja): página guardada no aparelho (service worker), fila "salvar no aparelho" com fotos e polígono e envio quando voltar o sinal (código único por ROI para não duplicar); antes de ir a campo baixar RIs abertos da UC, gerentes e catálogo; login precisa ser feito com internet; vegetação/municípios calculados no envio. Depois: perímetro caminhando com o GPS do celular e mapa offline da UC. Hoje já existe o rascunho automático (localStorage, um só, sem fotos).
- Análise de Incêndio Florestal: buscar o CAR das demais UCs (botão na página, uma UC por vez); ideias para depois — focos de calor (INPE) como camada, ranking estadual dos imóveis mais recorrentes, exportar o ranking em CSV, relatório do imóvel em PDF para o SEI, ligar a ficha ao REDS/encaminhamentos da Sala Técnica, fogo vindo de fora (direção a partir do ponto de início), uso e cobertura (MapBiomas) por imóvel.
- Geo Colibri: resumo do que há dentro da área desenhada (ocorrências, área queimada por ano, vegetação), exportar risco.

## Backup (responsabilidade do Rodolfo)

- Código e estrutura: este repositório (GitHub).
- Dados: Supabase — exportar periodicamente (plano pago tem backup diário; no gratuito, fazer dump manual) e ter um segundo administrador nas contas GitHub e Supabase.
- Pacote privado (conversores de PIPCIF, JSONs exportados, saídas do mapa de risco): guardado fora do GitHub pelo Rodolfo (`colibri_privado_AAAA-MM-DD.zip`).
