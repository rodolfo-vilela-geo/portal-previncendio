# Banco de dados do Colibri (Sistema Integrado de Gestão do Fogo em Unidades de Conservação)

A "planta" do banco: tudo o que é preciso para recriar o sistema do zero, seja no Supabase, seja num servidor PostgreSQL do Estado (PRODEMGE). O mesmo que roda hoje no projeto Supabase `nhsjsttvxixgfqnweqos`.

**O que NÃO está aqui (de propósito, porque o repositório é público):** os dados das ocorrências (ROIs históricos 2013–2025, RIs, atuações), o cadastro das UCs preenchido pelos gerentes (PIPCIF), a lista da equipe com e-mails e as senhas. Esses dados ficam só no banco. Faça backup deles (veja abaixo).

## Pastas

| Pasta | Conteúdo |
|---|---|
| `migracoes/` | Estrutura do banco, na ordem em que deve ser executada: tabelas, visões, funções, regras de acesso (RLS) e listas públicas. |
| `carga/` | Dados públicos grandes: limites das UCs e zonas de amortecimento (IDE-Sisema) e municípios de MG (IBGE, em `../dados/municipios_mg.geojson`). |
| `funcoes/usuarios/` | Função do servidor que cria login e gera senha provisória (Supabase Edge Function, Deno). |
| `ferramentas/` | `migrar_historico.py` (converte a Tabela Principal do BDG em CSV para carga) e `base_postgres_sem_supabase.sql` (para rodar fora do Supabase). |

## Ordem de execução

```
[fora do Supabase]  ferramentas/base_postgres_sem_supabase.sql
01_esquema_roi.sql            tabelas do ROI, RI (prazos), evolução, fotos, polígonos, BDG (vw_bdg)
02_listas_suspensas.sql       listas do formulário (tabela dominio)
03_poligono_formulario.sql    cálculo do polígono e envio público do ROI
04_cadastro_ucs.sql           cadastro fixo das UCs (categoria, bioma, regional, base…)
05_painel_publico.sql         dados do painel histórico
06_bdg_roi_recente.sql        linha do BDG para o shapefile do ROI recém-enviado
07_limites_ucs.sql            limites das UCs e ZAs (estrutura)
  carga/07a…07d_limites_dados.sql   (dados dos limites — rodar um por vez)
08_cataguas_fernao_dias.sql   correção de nomes (Parque Fernão Dias → Parque Cataguás)
09_equipe.sql                 equipe interna e permissões
09b_ajustes_seguranca.sql
10_ri.sql                     Registro de Incêndio da Sala de Situação
10b_prazos_sem_cancelados.sql
11_boletim_publico.sql
12_atuacoes.sql               catálogo de instituições e atuações por dia/turno
13_config_listas.sql          configurador das listas (admin) com histórico
14_cadastro_uc.sql            PIPCIF módulo 1: gerentes, cadastro das UCs, regionais, auditoria
15_municipios.sql             tabela de municípios
  carga/carregar_municipios.sql
16_analise_poligono.sql       cruzamento do polígono de campo com UC e municípios
17_painel_uc.sql              dados do Painel da UC (gestores)
18_infraestrutura.sql         módulo 2: alojamento/camping e pontos de infraestrutura (4.2–4.10)
19_recursos_apoio.sql         módulos 3 e 4: veículos, rádios, materiais; parceiros, prestadores, colaboradores, brigadistas
20_ri_campos.sql              RI: forma de detecção, início do combate, responsáveis, fechamento, contatos e PM Ambiental
21_sala_tecnica.sql           Sala Técnica: trâmite por cod_bdp (ROI, REDS/AI, processo SEI, DPC, CAINF), prazos e importação da planilha
22_atividades_preventivas.sql Módulo 5 · Atividades Preventivas: aceiros, estradas e trilhas (traçado PostGIS), elementos favoráveis/adversos, cronograma de ações, projetos e brigadistas contratados
23_execucao_acoes.sql        Registros de execução das ações preventivas (vários por ação, até 3 fotos no bucket privado acoes-fotos), motivo, pendências
24_poligonos_bdg.sql         Polígonos do BDG: importação em lote (shapefile/GeoJSON/KML), ROIs sem polígono, pontos do histórico no Painel da UC
25_pipcif_origem.sql         Ano do PIPCIF de onde vieram os dados de cada UC (acompanhamento da migração)
26_mapa_risco.sql            Mapa de risco por UC (protótipo): células compactadas, método e conferência; leitura logada, gravação Previncêndio
27_risco_revisao.sql         Conferência do mapa de risco pela UC (parecer, nota, marcações) por versão; leitura logada, gravação de quem edita a UC
28_visualizador.sql          Geo Colibri: geo_ocorrencias, geo_queimadas, geo_ocorrencia, geo_limites (só usuários logados, sem dados pessoais)
29_empenho.sql               Empenho padronizado: empenho_categoria (13 categorias → colunas históricas), instituicao.grupo/municipio, atuacao sem turno + contrato da aeronave, roi_empenho, vw_roi_empenho_resumo (no Supabase aplicada como 29a/29b; carga do catálogo de instituições fica no pacote privado)
30_ri_para_roi_empenho.sql   ri_para_roi devolve o empenho da Sala linha a linha (sem observação) para pré-preencher a 2.2 nova do ROI; instituição genérica "Outra instituição (ver observação)"
31_catalogo_historico_juntar.sql  Catálogo: auditoria em instituicao/empenho_categoria; juntar_instituicao(de, para) (só Previncêndio, sem apagar registros); trocar a categoria recalcula os ROIs com empenho novo (roi_evolucao_calculada, roi_recalcular_empenho). No Supabase: 31a/31b/31c
32_roi_gerente_fauna.sql     gerentes_uc() (gerente do cadastro, para o ROI); roi.fn_condicao e roi_fauna (fauna estruturada); envio do ROI por usuário logado (gerente) com as mesmas regras do envio aberto; roi_empenho: edição só da equipe. No Supabase: 32a/32b
33_acesso_restrito.sql       Só Painel (painel_dados) e Boletim (boletim_publico) são públicos: envio anônimo desligado (with check false), leituras abertas passam a só logados, funções revogadas do anon (inclusive o padrão para funções novas); "logado" passa a exigir usuário da equipe (is_usuario). No Supabase: 33, 33b, 33c
34_vegetacao_inventario.sql  Vegetação do ROI pelo Inventário Florestal (IDE-Sisema): veg_classe (17 classes → campo do ROI), veg_inventario (carga por vegetacao_importar.html), vegetacao_poligono(), roi.veg_campo, roi_vegetacao (detalhe), vw_bdg com veg_campo (no fim). No Supabase: 34a/34b
35_geo_vegetacao.sql         Geo Colibri: geo_vegetacao(caixa, tolerância) — inventário recortado pela tela e simplificado pelo zoom (o mapa pede a partir do zoom 11)
36_ris_da_uc.sql             ris_da_uc(nome_uc): RIs da UC (últimos ~13 meses) com situação, prazo e nº de ROIs — o ROI começa escolhendo o RI
37_aeronaves_codinome.sql    Aeronaves no empenho: a_contrato = contrato do Air Tractor AT-802 (CFM/FTP); a_heli = helicóptero pelo codinome (Pegasus PMMG, Arcanjo CBMMG, Carcará PCMG, Guará IEF/PMMG); ri_para_roi leva a_heli
38_recurso_aereo.sql        Cadastro único de pontos de apoio aéreo (recurso_aereo: aeródromos do IDE-Sisema/ANAC + pistas não registradas, helipontos e áreas de pouso dos PIPCIFs, com atributos operacionais: água, AT-802 etc.); uc_ponto.recurso_id liga o ponto da UC ao cadastro; recursos_aereos_perto(uc, km). Carga dos dados no pacote privado
39_recurso_aereo_historico.sql Histórico (auditoria) do cadastro de apoio aéreo legível por usuários logados (tela apoio_aereo.html)
40_ligar_ponto_aereo.sql    Gatilho em uc_ponto: pista/heliponto inserido (importador de PIPCIF ou módulo 2) é ligado ao recurso_aereo (pista ≤ 2 km, heliponto ≤ 300 m, ou mesmo nome) ou cria um lugar "a conferir"; nome da UC vira apelido e o informado vai para atributos.pipcif
41_identificacao_uc.sql     roi, ri e uc_limite com FK para uc(nome_uc) on update cascade; uc ganha cod_uc (UC-001…, fixo, sequência para as novas), nome_oficial (IDE-Sisema com acentos), cod_ide (id_uc_ do IDE) e variantes. A chave continua nome_uc. Em produção: 41a (estrutura) + 41b (dados)
42_correcao_nomes_uc.sql    "Mata de Krambeck" → "Mata do Krambeck" (cascata) e nome oficial "Pico da Ibituruna"; antigas grafias em variantes
43_plano_operacional_base.sql Base do plano operacional: unidade do CBMMG da área no cadastro da UC (cbmmg_unidade, cbmmg_contatos) e informações do acionamento no RI (setor, linha de fogo, acesso, apoio logístico, em risco, CBMMG acionado)
44_ri_acionamento_simples.sql RI: saem linha_fogo, acesso, apoio_logistico e em_risco (o protocolo deve mudar); ficam cbmmg_acionado e setor
45_zoneamento_uc.sql         Zoneamento das UCs (plano de manejo, referência): tabela uc_zoneamento (zona, sigla, fonte, geom, area_ha), carga zoneamento_carregar() só Previncêndio, geo_zoneamento() para o Geo Colibri e zona_no_ponto() para o RI. Carga inicial: 14 UCs do IDE-Sisema (arquivo no pacote privado; dado público)
46_plano_operacional.sql     Módulo 7: uc_setor (setores operacionais, auditoria), uc_operacional (cenários, comando, prontidão, pós, revisão com o CBMMG), setores_resumo(), setores_geo(), setor_salvar() (security invoker), setor_no_ponto(), zoneamento_uc(). Em produção: 46 (tabelas) + 46b (funções)
47_setor_unir_partes.sql     setor_salvar funde as partes encostadas (quadrantes ou zonas juntados num setor só); origem "quadrantes" (do mapa de risco)
48_setores_pistas_50km.sql   setores_resumo: sai o critério do Air Tractor (até 17 km, em desuso); entram as pistas num raio de 50 km (pistas_50km, n_pistas_50km), só informativas
49_boletim_coordenada.sql    boletim_publico: devolve lat/lon (4 casas) só das ocorrências em andamento, para o ponto do incêndio no mapa do boletim
50_boletim_semana_area.sql   boletim_publico: media_semanal (53 semanas, blocos de 7 dias desde 1º/jan) e area_anos (área queimada por ano somando os ROIs; ano corrente parcial)
51_investigacao.sql          Análise de Incêndio Florestal: imovel (CAR/importado/desenhado), imovel_versao, imovel_fogo (gatilhos com area_queimada), imovel_nota, car_busca/car_pedido; car_buscar/car_processar (SICAR WFS via pg_net), geo_imoveis, imovel_ficha, imovel_incluir, car_situacao, car_resumo. Só is_tecnica()
52_imovel_coincide_uc.sql    Aviso de imóvel do CAR que coincide com o limite de uma UC (≥ 80% nos dois sentidos): imovel_coincide_uc, imovel_avisos_uc; imovel_ficha traz uc_coincide
53_avisos_uc_rapido.sql      imovel_avisos_uc mais rápida (Serra do Papagaio, 7.180 imóveis: 8,6 s → 0,3 s)
```

Depois das migrações: carregar os dados (backup), criar o primeiro administrador
(`insert into equipe (email, nome, papel) values ('…', '…', 'admin');` e o login correspondente)
e, no Supabase, publicar a função `funcoes/usuarios` e o bucket de fotos `roi-fotos` (criado no 01).

A sequência completa foi testada do zero num PostgreSQL 16 + PostGIS limpo em 30/09/2026.

## Backup (recomendado semanalmente enquanto o projeto estiver no plano gratuito)

No Supabase: Project Settings → Database → *Connection string*. Com ela, em qualquer computador com PostgreSQL instalado:

```
pg_dump "postgresql://postgres:[SENHA]@db.nhsjsttvxixgfqnweqos.supabase.co:5432/postgres" \
  --schema=public --no-owner --format=custom --file=previncendio_AAAA-MM-DD.dump
```

Guarde o arquivo em local institucional (não neste repositório). As fotos dos ROIs ficam no Storage (bucket `roi-fotos`) e são baixadas pelo painel do Supabase.

## Migrar para os servidores do Estado (PRODEMGE)

**Caminho 1 — Supabase instalado na PRODEMGE** (código aberto, Docker): rodar as migrações (ou restaurar o backup), copiar as fotos, publicar a função `usuarios` e trocar, nas páginas HTML, o endereço e a chave (`SUPABASE_URL` e `SUPABASE_KEY`). Usuários e senhas podem ser levados junto.

**Caminho 2 — PostgreSQL + PostGIS da PRODEMGE com a autenticação do Estado:**
1. Rodar `ferramentas/base_postgres_sem_supabase.sql` e depois as migrações.
2. Expor o banco por uma API REST compatível (PostgREST) que valide o login do Estado e entregue o e-mail do usuário em `auth.jwt() ->> 'email'` — todas as permissões usam só isso.
3. Adaptar nas páginas: o login (hoje `sb.auth…`), o envio de fotos (hoje Storage) e a criação de usuários (hoje a função `usuarios`, dispensável se o Estado gerencia os logins).
4. Hospedar as bibliotecas externas no próprio servidor (Supabase JS, Leaflet, JSZip, hoje via CDN).

O SMC continua no Google Earth Engine em qualquer caso.

## Onde está a regra de negócio

Quase toda no banco, em SQL padrão — por isso a migração é viável:

- **Classes do BDG** (tempo de resposta, duração, classe de área, dia da semana): visão `vw_bdg` (01).
- **Prazos dos ROIs**: `vw_prazos` (10b).
- **Trâmite da Sala Técnica** (etapa, pendências, prazos de ROI e REDS): `vw_tramite` (21).
- **Boletim público**: `boletim_publico()` (11/12/49) — não expõe descrições nem informantes; coordenada só das ocorrências em andamento (49).
- **Consolidação das atuações** (turnos, horas-homem, recursos por instituição): `vw_atuacao_dia` (12).
- **Permissões**: `is_equipe()`, `is_usuario()`, `is_gpcif()`, `is_admin()`, `pode_editar_uc()` + políticas RLS em cada tabela.
- **Histórico de alterações**: gatilho genérico `tg_auditoria()` e tabela `auditoria` (14).
- **Cruzamento espacial do ROI**: `analisar_poligono()` (16).
