# Receita: mapa de risco de uma UC (módulo 6)

Resultado: uma linha em `uc_risco` (por UC) com as células compactadas; aparece no módulo 6 (`ucs.html?mod=risco`), no Painel da UC e no Geo Colibri. A UC confere em `uc_risco_revisao`.

## Método (aprovado como protótipo — Serra do Cabral)

- **Área de análise** = UC + faixa de 5 km, **unida** à zona de amortecimento do plano de manejo quando houver (5 km cobre 99,7% das ocorrências 2013–2025 com limite).
- **Grade**: hexágonos de lado 152 m (~6 ha) em UTM 23S (EPSG:31983), **origem fixa** para todo o estado: `id = linha*100000 + coluna`; centro `y = linha*1,5*lado`, `x = coluna*√3*lado (+ meia largura nas linhas ímpares)`; vértices a 30°+60°k. O navegador refaz os hexágonos a partir do id.
- **Quadrantes** 5 × 5 km para comunicar/imprimir (letra = coluna, número = linha N→S). A caixa de cada quadrante é derivada do **nome** (não do centro de uma célula) — foi um erro corrigido em 06/10.
- **Histórico**: só BDG 2013–2025; célula "queimou" no ano quando a cicatriz cobre ≥10% dela. Calibração 2013–2022, conferência 2023–2025.
- **Variáveis** (GEE, `ferramentas/risco/gee/colibri_risco_variaveis.js`): MapBiomas col. 9 (último ano; % por grupo de classes), distâncias a urbano/antrópico/água (fastDistanceTransform, teto 7.680 m), NASADEM (altitude, declividade, face norte), NDVI Sentinel-2 da seca (jul–set 2022–2025).
- **Modelo** (`modelo.py`): regressão logística ambiente + histórico (anos queimados na calibração e média da vizinhança de 600 m). Sem distância ao limite (refletia viés de registro). Treino só em células de confiança alta/média.
- **Confiança**: alta = ≥50% da célula na UC; média = na ZA ou até 3 km; baixa = resto (hachurada).
- **Classes** por quantis das células de treino (50/75/90%): baixa, moderada, alta, muito alta; "sem combustível" pelo uso do solo.
- **Motivos** ("por que esta área?"): até 3 maiores contribuições positivas da célula, mostrados só para classe ≥ moderada.
- Serra do Cabral v2: AUC 2023–25 = 0,91 (área) / 0,79 (UC); blocos espaciais 0,88; muito alta = 8,7% da área e 50,7% do queimado; alta + muito alta = 21,8% da área e 83,3%.

## Passo a passo para uma UC nova

1. **Insumos** (pasta de trabalho, fora do repositório): limite das UCs (IDE-Sisema `ide_2010_mg_unidades_conservacao_estaduais_pol`), ZA do plano de manejo (`ide_2011_mg_amortecimento_uc_plano_manejo_pol`), polígonos do BDG 2013–2025 (shapefile do Rodolfo; não versionar).
2. `grade.py` — troque `UC` e `SLUG` no topo. Gera `<slug>_celulas.gpkg` (grade + histórico do BDG por célula) e o zip para subir no GEE (`gee/<slug>_celulas.zip`).
3. **GEE** (conta do Rodolfo, projeto `area-queimada-previncendio`, script à parte do SMC): subir o zip como asset em `projects/area-queimada-previncendio/assets/colibri/<slug>_celulas`; abrir `colibri_risco_variaveis.js`, ajustar `CELULAS` e `NOME`; Run; aba Tasks → RUN; o CSV cai no Drive, pasta `colibri`. Baixar como `vars.csv`.
4. `modelo.py` (ajusta, confere 2023–2025, imprime AUC e % por classe) → `<slug>_risco.gpkg/.csv`.
5. `mapa.py` → figura de conferência (PNG). Conferir com o Rodolfo antes de publicar.
6. `exportar.py` → `importar/MAPA_RISCO_<slug>.json` (formato `colibri-risco-1`: `nome_uc`, `versao`, `metodo` {resumo, calibração, conferência, AUC, % por classe}, `dados` {grade, quadrantes, motivos, baixa_confianca, cel{id,c,k,a,m}}).
7. Rodolfo importa em Gestão → Importar PIPCIF (o importador reconhece o formato e mostra "Gravar mapa de risco").
8. Escrever o resumo para o gerente (modelo: documento "Mapa de risco · PE Serra do Cabral").

Os scripts estão escritos para a Serra do Cabral (nomes de arquivo fixos); generalize ao rodar a segunda UC.

## Diário de decisões (05–06/10/2026)

### Proposta inicial (05/10)

Base: seção 14 dos PIPCIFs = tabela 15 fatores (linhas) × quadrantes A–F (colunas) + figura.

1. Grade automática sobre UC + entorno: células finas (hex 500 m–1 km) para cálculo; quadrantes A, B, C… para comunicar/imprimir.
2. Fatores:
   - automáticos: recorrência área queimada (BDG), densidade de ignições (ROIs), distância a vias/sede/helipontos/vigilância;
   - semiautomáticos: causas dos ROIs por célula;
   - cadastro: projetos, parceiros, pontos (módulos 2–5);
   - externos (fase 2): MapBiomas/combustível e declividade (GEE, como no SMC), rodovias/LT (OSM/ANEEL);
   - manuais: gerente marca no mapa (fator + nota).
3. Dois eixos: RISCO (adversos) × CAPACIDADE (favoráveis); prioridade = risco alto e capacidade baixa → liga ao cronograma (módulo 5) e plano operacional (módulo 7).
4. Notas 1–3 por fator/célula, pesos definidos pelo Previncêndio (iguais para todas as UCs).
5. Saídas: mapa no Painel da UC; seção 14 pronta (figura + tabela quadrante × fator); recálculo com novos ROIs/polígonos; revisão do gerente por ciclo, histórico anual.

Fases: (1) grade + camadas com dados existentes + marcação manual + tabela da seção 14; (2) camadas externas + índice de capacidade completo.

Decisões tomadas (06/10/2026):
- Histórico de fogo: SOMENTE BDG 2013–2025 (polígonos + ROIs). NÃO usar MapBiomas Fogo (metodologia diferente da classificação de incêndio florestal do Previncêndio).
- MapBiomas uso e cobertura: OK.
- GEE: script à parte do SMC, mesma conta/projeto Cloud; só extrai variáveis por célula (MapBiomas uso, relevo Copernicus/SRTM, NDVI seca, distância a estradas via asset) → CSV no Drive → modelo ajustado no workspace (calibra 2013–2022, valida 2023–2025) → importação no Colibri. Atualização anual.
- Escala: cálculo 30 m; células ~250 m (6 ha); quadrantes A, B, C… para o PIPCIF. Mostrar menor confiança em UCs pequenas/com pouco histórico.
- Piloto proposto: PE Serra do Cabral.
- Limitação: BDG só tem fogo que atingiu a UC/entorno registrado em ROI → modelar dentro da UC + faixa do entorno coberta pelos ROIs; fora disso, confiança menor.
- Metodologias de referência: Koproski et al. 2011 (PE Cerrado/PR, 4V+3H+1D+1E+1A); AHP (Souza/UFU 2022 no PE Pau Furado; UFOP Itabirito); regressão logística (Ferreira & Messias 2021, Canastra); PMIF ICMBio (zonas por combustível × sensibilidade da vegetação); USFS Scott/Thompson/Calkin 2013 (perigo × vulnerabilidade).

- Área de análise (proposta 06/10, Rodolfo sugeriu): faixa única de 5 km ao redor de todas as UCs (comparável entre UCs). Conferência no banco: das 9.006 ocorrências 2013–2025 com limite, 88,7% dentro da UC, 10,5% até 3 km, 0,5% de 3 a 5 km, 0,3% de 5 a 10 km, 3 acima de 10 km → 5 km cobre 99,7%. Área urbana/água dentro da faixa: não cortar o buffer; marcar células como "não combustível" (MapBiomas) e usar distância à borda urbana como variável de ignição. ZA/3 km só como linha de referência no mapa.

- Duas vertentes (ideia do Rodolfo, 06/10): (A) MAPA DE RISCO — técnico, automático, método único estadual (estatístico, do BDG; sem pesos opinativos), Previncêndio responde pelo método; uso operacional (Sala/brigadas, + camadas ao vivo: ocorrências, focos, risco meteorológico INPE). (B) MAPA DE PLANEJAMENTO — anual, da UC (competência do gerente): áreas e ações (aceiro, queima prescrita, ronda, educação ambiental) desenhadas sobre o mapa de risco como fundo; alimenta cronograma (módulo 5) e o futuro módulo de queimas; Previncêndio comenta, não decide.
- Interação para gerentes sem formação técnica: sem pesos/índices na tela; 3–4 cores em linguagem simples; "por que esta área?" com 2–3 motivos em palavras; fluxo guiado por ciclo do PIPCIF: 1) conferir o mapa (concordo/discordo + nota), 2) marcar o que só a UC sabe (ícones dos 15 fatores), 3) planejar (clicar/desenhar áreas e escolher a ação → vira item do cronograma), 4) seção 14 gerada. Sugestões ("áreas de atenção" = risco alto + capacidade baixa) aceitas ou recusadas com motivo.

PROTÓTIPO SERRA DO CABRAL (iniciado 06/10/2026)
- Arquivos em scratchpad/risco/: grade.py (gera grade), serra_do_cabral_celulas.gpkg (grade + histórico BDG por célula: q2013..q2025, anos_q, anos_q_cal 2013–2022, anos_q_val 2023–2025; "queimou" = ≥10% da célula), gee/colibri_risco_variaveis.js (script GEE), gee/serra_do_cabral_celulas.zip (enviado ao Rodolfo para subir como asset).
- Fontes locais: BDG shapefile do upload pol_2013_2025_IA_v1.zip; limite das UCs do upload ide_2010_mg_unidades_conservacao_estaduais_pol.zip (PE Serra do Cabral 22.444 ha).
- Grade: hexágonos lado 152 m (~6 ha), UTM 23S (EPSG:31983); 14.482 células na UC + 5 km; 3.732 com ≥50% na UC; quadrantes 5×5 km (letra = coluna, número = linha N→S), 46 quadrantes; 1.005 polígonos BDG na área; 5.057 células queimaram ao menos 1 ano.
- Próximo: Rodolfo roda o script no GEE e manda o CSV (colibri_risco_serra_do_cabral.csv); depois ajustar modelo (regressão logística/RF), validar 2023–2025, gerar mapa de teste.
- O workspace NÃO alcança o Supabase pela rede (só via MCP); por isso dados do BDG vêm do shapefile.

- RESULTADO 1º protótipo (06/10): vars.csv do GEE (14.482 células, MapBiomas col.9 2023). modelo.py: logística ambiente+histórico; AUC 2023–2025 = 0,90 (área toda), 0,79 dentro da UC; validação em blocos por quadrante 0,87 (RF 0,88). Classes por quantis (50/75/90%): "muito alta" = 10% da área e 47,7% das células queimadas em 2023–25; alta+muito alta = 25% da área e 81,5% do queimado. Variáveis mais fortes: recorrência na vizinhança, altitude, distância do limite (viés de registro do BDG), savana/campo. Saídas: serra_do_cabral_risco.gpkg/.csv (classe, prob, motivos), mapa_risco_serra_do_cabral.png.
- Limite: CORRETO. uc_limite do Colibri tem 2 linhas (tipo 'uc' 22.445 ha + tipo 'za_pm' 62.859 ha); os 85 mil ha eram a união UC+ZA (erro meu). Grade usa o limite da UC. A ZA do plano de manejo vai além dos 5 km a oeste (fica parcialmente fora da área de análise). Cicatrizes do BDG ficam em grande parte na ZA a oeste do parque.
- REGRA ADOTADA (06/10): área de análise = faixa de 5 km UNIDA à ZA do plano de manejo (quando houver). Grade com origem fixa (id = linha*100000 + coluna, estável entre rodadas/UCs) e coluna na_za. Serra do Cabral v2: 108.440 ha, 18.466 células, 56 quadrantes; arquivos gee/serra_do_cabral_celulas_v2.zip e colibri_risco_serra_do_cabral_v2.js (asset projects/area-queimada-previncendio/assets/colibri/serra_do_cabral_celulas_v2). CSV v2 recebido. RESULTADO v2: sem dist_uc_m; calibração só em células de confiança alta/média (UC; ZA ou ≤3 km); confiança baixa = fora disso (2.412 células, hachuradas). AUC 2023–25: 0,91 total / 0,79 na UC; blocos 0,88. Muito alta = 8,7% da área e 50,7% do queimado 2023–25; alta+muito alta = 21,8% da área e 83,3%. Só ambiente (sem histórico) AUC 0,68 → o histórico do BDG é o que mais explica; altitude, savana, declividade e afloramento sobem o risco; pastagem, floresta, mosaico, silvicultura e distância de água baixam.
- Ponto aberto: (2) distância ao limite reflete viés de registro → considerar retirar e marcar confiança menor fora da UC.

- Trilhas/acessos (pergunta 06/10): usar uc_via do módulo 5, calculado direto (sem GEE). Trilhas/estradas = acesso de pessoas → variável de ignição (risco); aceiros = barreira → eixo de capacidade, não de risco. Só usar traçados desenhados/importados (não os 'pontos' início–fim) e só quando a UC marcar o cadastro como completo; manter a variável só se melhorar a conferência 2023–2025.

Decisões pendentes (perguntadas ao Rodolfo): tamanho da célula; entorno (ZA ou faixa fixa 3 km); risco e capacidade separados ou índice único; quem define pesos (sugestão: proposta Previncêndio + pilotos Serra do Cabral e mais duas UCs).

MÓDULO 6 PUBLICADO (06/10/2026, protótipo): aba "Mapa de risco" no Cadastro da UC (ucs.html?mod=risco; risco_mapa.js + modulo_risco.js). Cabeçalho com versão e acerto por classe; mapa com "por que esta área?"; conferência da UC (parecer concordo/ressalvas/discordo + nota + marcações por tipo, tabela uc_risco_revisao, migração 27); seção 14 = figura desenhada em UTM + tabela por quadrante (janela para imprimir/PDF) e CSV; histórico de conferências. UC sem mapa: aviso. Corrigidas as caixas dos quadrantes (exportar.py agora deriva do nome; linhas ≥9 estavam deslocadas) — atualizado em produção via jsonb_set.
