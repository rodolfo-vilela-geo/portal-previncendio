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
- RI da Sala: bloco "Informações do acionamento" — `ri.cbmmg_acionado`, `setor`, `linha_fogo`, `acesso`, `apoio_logistico`, `em_risco`; mostra o CBMMG da área ao escolher a UC; sai no PDF do RI.
- Coordenadas em graus, minutos e segundos (`coord.js`) no cadastro e módulos da UC, no RI, no apoio aéreo e nas fichas de ponto do Geo Colibri (o ROI já usava). O banco continua em decimal; o valor exato é preservado quando o campo não é mexido.

## Pendências

- Telefone da coordenação do CBMMG (a definir com o CBMMG).
- Parte da UC do módulo 7: setores no mapa, cenários, quadro de comando, prontidão.
- Conferir o texto do Decreto 48.767/2024 (competências, art. 6º).
