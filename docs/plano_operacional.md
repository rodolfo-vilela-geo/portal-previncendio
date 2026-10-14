# Plano operacional (módulo 7) — rascunho da lógica

Seção 15 do PIPCIF ("Plano operacional de combate a incêndio florestal da UC"). Os novos planos serão construídos em conjunto com o CBMMG, a partir do Decreto nº 48.767/2024 (Força-Tarefa Previncêndio) e dos protocolos conjuntos:

| Protocolo | Assunto |
|---|---|
| 01/2025 | Acionamento de aeronaves da FTP em UCs estaduais |
| 02/2026 | Registro de ocorrências de incêndios florestais em UCs |
| 03/2026 | Acionamento mútuo CBMMG × IEF em UCs e zonas de amortecimento |
| 04/2025 | Mensuração de área queimada em UCs |

## O que os PIPCIFs mostram (levantamento de 13/10/2026, ~70 textos)

- Cerca de 1 em 4 está vazio (só o texto de instrução do modelo).
- Os preenchidos repetem o mesmo esqueleto: detecção → confirmação → aviso à Sala (RI) → deslocamento → avaliação → combate → apoio → rescaldo → fechamento do RI → ROI.
- Divergências com os protocolos: ordem do acionamento (muitos só chamam o CBMMG "se necessário"), comando, prazo e destino do ROI, telefones próprios, pedido de aeronave sem passar pela coordenação da FTP, REDS quase nunca citado, informações do acionamento quase nunca listadas.

## Decisões (13/10/2026, Rodolfo)

- **Telefones:** Sala de Situação do IEF = 0800 283 2323. Para o CBMMG, o plano diz "ligar para a coordenação do CBMMG — telefone a definir" (o número pode mudar; não fixar).
- **Comando antes da chegada do CBMMG e quando ele não vai:** gerente ou responsável pela UC (IEF).
- **Prazo:** ROI com a medição da área em até 10 dias corridos da extinção (o do PIPCIF). Não se usa prazo próprio da UC.
- **Coordenadas:** padrão graus, minutos e segundos.
- **Base oficial:** para o IEF, o Colibri é a informação oficial. A homologação como base conjunta com o CBMMG fica para depois (não entra no plano agora).

## Estrutura do módulo 7

Duas camadas:

1. **Parte comum (fixa, igual para todas as UCs)** — o fluxo abaixo, com a referência aos protocolos. Mantida pelo Previncêndio; muda num lugar só quando um protocolo mudar.
2. **Parte da UC (construída com a unidade do CBMMG da área)** — setores operacionais desenhados no mapa (acesso, água, ponto de apoio, pista/heliponto, parceiro mais próximo, tempo de chegada), estruturas e populações em risco, cenários que se aplicam, quadro de comando por porte, prontidão da brigada. Contatos vêm do cadastro (módulos 1 e 4, apoio aéreo), não são digitados de novo. Falta no cadastro: unidade/fração do CBMMG responsável pela área.

## Parte comum — rascunho do fluxo

1. **Detecção.** Monitoramento contínuo da UC e da zona de amortecimento: focos de calor, observação em campo, comunicação da comunidade.
2. **Acionamento imediato e simultâneo.** O responsável pela UC (gerente, coordenador, supervisor ou funcionário indicado no PIPCIF) liga para:
   - o **CBMMG** — 193 ou a coordenação do CBMMG (telefone a definir);
   - a **Sala de Situação do IEF — 0800 283 2323**, que abre o Registro de Incêndio (RI).
3. **Informações do acionamento** (mesma lista dos protocolos 01 e 03):
   - UC e setor; coordenada em graus, minutos e segundos; data e hora em que o foco foi visto;
   - dimensão da linha de fogo;
   - acesso para veículos e pessoas (estradas, trilhas);
   - pessoal em combate ou em deslocamento (quantidade);
   - apoio logístico: pontos de apoio, equipamentos, veículos 4x4;
   - populações e estruturas em risco (moradias, linhas de transmissão, escolas, nascentes, áreas de valor ambiental);
   - fotos ou vídeos, se houver.
4. **Primeiro combate.** Se a UC tem pessoal treinado ou brigada, o combate começa logo após a detecção, sempre que for seguro. **Até a chegada do CBMMG, ou durante toda a operação quando o CBMMG não for, o comando é do gerente ou do responsável pela UC.**
5. **Chegada do CBMMG.** O CBMMG abre o chamado (CAD), coordena o combate e instala o Sistema de Comando em Operações com posto de comando unificado; o responsável pela UC integra o comando e repassa as informações de campo.
6. **Atualização do RI.** O responsável pela UC mantém a Sala de Situação informada durante toda a operação.
7. **Apoio aéreo.** Pedido à coordenação da FTP/CBMMG (telefone a definir), com as informações do item 3 e, para avião, as pistas próximas (situação, superfície, coordenada, acesso, largura e comprimento). Critérios do protocolo 01: avião — pista de pelo menos 25 × 1.000 m a até 17 km, com água para reabastecer; helicóptero — terreno para pouso ou embarque em voo pairado, acesso para o caminhão de combustível, ponto de água próximo (até 7 min entre lançamentos), ao menos 1 equipe em solo por aeronave; drone — acesso a até 400 m do incêndio, com visada.
8. **Extinção.** Comunicar a Sala de Situação para fechar o RI. Se o IEF atuou sem o CBMMG, informar o CBMMG no mesmo dia (REDS).
9. **Registro.** ROI no Colibri, com a área medida, em até **10 dias corridos da extinção**. Medição, em ordem de preferência: percurso do perímetro em campo com GPS; drone; imagem de satélite (dNBR). Polígono, fotos, método, data e equipe vão no ROI. Frentes distantes entre si = ROIs separados; frentes próximas no mesmo perímetro = um ROI.
10. **Avaliação pós-incêndio** com a equipe.

## Feito em 13/10/2026 (migração 43)

- Cadastro da UC (módulo 1): bloco "Corpo de Bombeiros (CBMMG) da área" — `uc_cadastro.cbmmg_unidade` e `cbmmg_contatos`.
- RI da Sala: bloco "Acionamento" — `ri.cbmmg_acionado` e `setor`; mostra o CBMMG da área ao escolher a UC; sai no PDF do RI. (14/10/2026: linha de fogo, acesso, apoio logístico e populações/estruturas em risco foram retirados — migração 44 — porque o protocolo deve mudar em breve. O setor terá cadastro próprio, vindo do zoneamento da UC. O ROI não foi alterado.)
- Coordenadas em graus, minutos e segundos (`coord.js`) no cadastro e módulos da UC, no RI, no apoio aéreo e nas fichas de ponto do Geo Colibri (o ROI já usava). O banco continua em decimal; o valor exato é preservado quando o campo não é mexido.

## Zoneamento do plano de manejo (14/10/2026, migração 45)

- Decisão do Rodolfo: o zoneamento do plano de manejo fica **à parte**, como camada de referência (não é específico para incêndios); pode ou não compor os setores do plano operacional. Os planos de manejo só serão enviados se for preciso extrair as normas de cada zona (máquina, aceiro, retardante, queima) para o módulo 7.
- Tabela `uc_zoneamento` (zona, sigla, fonte, geom, area_ha). Carga pelo importador (`formato: "colibri-zoneamento-1"`, função `zoneamento_carregar`, só Previncêndio). Geo Colibri: camada "Zoneamento (plano de manejo)" em Limites. RI: mostra a zona onde cai a coordenada (`zona_no_ponto`) e leva ao PDF.
- Carga inicial: 14 UCs do IDE-Sisema (`ide_2021_mg_zon*_uc_*_pol`): Cachoeira das Andorinhas, São José (APA), Vargem das Flores, Água Limpa, Mar de Espanha, Tripuí, Serra das Araras, Veredas do Acari, Libélulas da Serra de São José, Botumirim, Nova Baden, Serra Negra da Mantiqueira, Serra do Sobrado, Serra Verde — 70 zonas. Acentuação corrigida (arquivos em UTF-8 declarados como ISO-8859-1); siglas só quando vêm no arquivo e sem repetição; geometria simplificada ~2 m sem perda de área.
- Problemas dos arquivos do IDE: Nova Baden e Serra Verde vinham com latitude e longitude trocadas (corrigido); mesmo assim ficam 40–60 m a sudoeste do limite oficial (sobreposição 94% e 88%) — deixado como publicado. As áreas digitadas nas tabelas de atributos de alguns arquivos não batem com o desenho (vale o desenho).

## Módulo 7 construído (14/10/2026, migração 46)

- **Parte comum** no código (`modulo_operacional.js`: `BASE`, `VERSAO`, `FLUXO`, `CENARIOS`, `POS`) — muda num lugar só quando os protocolos mudarem.
- **Setores operacionais** (`uc_setor`): desenhados, importados (KML, KMZ, GeoJSON, Shapefile .zip — `geo_entrada.js`) ou copiados do zoneamento. `setores_resumo()` calcula: pista mais próxima, pista para Air Tractor (≥ 25 × 1.000 m a até 17 km, sem "não" no cadastro aéreo), heliponto/área de pouso mais próximo, ponto de água da UC (módulo 2), zonas do plano de manejo (> 5% do setor), ocorrências 2013–2025 (ponto do ROI **ou** polígono do BDG) e área queimada. Gravação por `setor_salvar()` (security invoker → vale `pode_editar_uc`).
- **Cenários** (6), **comando** por porte (5 funções; comando pré-preenchido com o gerente no pequeno e "comando unificado com o CBMMG" no grande), **prontidão**, **pós-incêndio**, **revisão com o CBMMG** (`uc_operacional`).
- **Impressão**: ficha de acionamento de uma página (telefones, quem comanda, figura e tabela dos setores) + seção 15 completa.
- **RI**: "Setor da UC" lista os setores da UC (`uc_setor`) e é preenchido pela coordenada (`setor_no_ponto`), com aviso se o informado for diferente.

## Mapa de risco no módulo 7 (14/10/2026, migração 47)

- Nas UCs com mapa de risco (`uc_risco`), o mapa de risco é o fundo para desenhar os setores (camada ligável), com as marcações da última conferência da UC na mesma versão (`uc_risco_revisao`).
- Cada setor ganha o resumo do risco, calculado no navegador pelas células do mapa (centro da célula dentro do setor): % em atenção alta + muito alta, motivos principais, % que já queimou e marcações da UC dentro do setor. Aparece na tabela, no painel do setor e na impressão. Conferido: quadrante D5 da Serra do Cabral = 85% nos dois módulos.
- Opção "Usar os quadrantes do risco" (5 × 5 km, mesmos da seção 14): marcar na lista ou no mapa e juntar os vizinhos; `setor_salvar` funde as partes encostadas (`st_unaryunion`). Origem do setor: `quadrantes`.

## Pendências

- Telefone da coordenação do CBMMG (a definir com o CBMMG).
- Parte da UC do módulo 7: setores no mapa, cenários, quadro de comando, prontidão.
- Conferir o texto do Decreto 48.767/2024 (competências, art. 6º).
