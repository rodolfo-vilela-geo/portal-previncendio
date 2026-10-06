# Receita: PIPCIF → banco do Colibri

O PIPCIF (Plano Integrado de Prevenção e Combate a Incêndios Florestais) de cada UC chega em PDF/DOCX. O conteúdo dele (módulos 1 a 5 do cadastro) vai para o banco assim:

1. **Texto do PDF** extraído (`pdftotext -layout`; páginas com tabelas difíceis viram imagem para conferência).
2. **Um conversor por UC** (`gerar_<slug>.py`) gera SQL (cadastro, infra, recursos, apoio, prevencao) seguindo o roteiro abaixo. Os conversores contêm dados pessoais e ficam no **pacote privado**, não neste repositório. Para UC nova, copie o conversor mais parecido (modelo original: `gerar_paufurado.py`) e troque os dados.
3. **Teste no banco local** (ver `ferramentas/testes/README.md`): o SQL precisa rodar sem erro.
4. **Exportar JSON** da UC a partir do banco local com `ferramentas/pipcif/exportar_pipcif.sql`:
   `psql -d teste -Atc "\i ferramentas/pipcif/exportar_pipcif.sql" -c "select pg_temp.exp('Nome da UC')" > PIPCIF_2026_<slug>.json`
   (as duas instruções na mesma conexão; o formato é `colibri-pipcif-1`).
5. **Importar no Colibri**: o Rodolfo (Previncêndio/admin) abre Gestão → Importar PIPCIF (`pipcif_importar.html`), arrasta o JSON e confirma. O importador substitui os dados da UC nos módulos 1–5. O JSON tem dados pessoais: não publicar, não anexar em lugar público.

Convenções que já valem:
- `nome_uc` = nome curto do banco (ex.: 'Serra do Cabral'), não o nome completo.
- Documento conjunto de duas UCs (ex.: São José + Libélulas): dados duplicados nas duas. Rola-Moça/Fechos/Cercadinho: separados por UC quando o documento permite, itens comuns repetidos.
- Pontos de água da seção 14/15 não entram (exceção: Gambá, 2 pontos).
- Seções 14, 15 e 17 do PIPCIF não entram (a 14 agora é gerada pelo módulo 6).
- `uc_cadastro.pipcif_ano = 2026` marca a UC como carregada.

## Roteiro entregue a cada conversor (um PIPCIF por vez)

Você vai transformar o texto de UM PIPCIF (Plano Integrado de Prevenção e Combate a Incêndios Florestais) de uma Unidade de Conservação estadual de MG em SQL, seguindo EXATAMENTE o modelo já usado para o PE Pau Furado.

## Modelo a seguir
- `<conversores>/gerar_paufurado.py` — script Python que gera 5 arquivos SQL (cadastro, infra, recursos, apoio, prevencao). LEIA INTEIRO antes de começar. Copie a estrutura (funções dms, q, ins, tt, fone, nomeok, cond, etc.) e troque só os dados.
- Os PIPCIF 2026 seguem o modelo das seções 3 a 16 (3 Informações gerais; 4.1 sede; 4.2 alojamento; 4.3 vigilância; 4.4 veículos; 4.5/4.6 rádios; 4.7 pistas; 4.8 helipontos; 4.9 estações meteorológicas; 4.10 hidrantes/pontos de água (se houver); 5 materiais; 6 parceiros; 7 prestadores (7.1 alimentação, 7.2 saúde, 7.3 abastecimento/outros); 8 colaboradores; 9 brigadistas voluntários; 10 aceiros/estradas/trilhas; 11 elementos favoráveis/adversos; 12 cronograma; 13 projetos; 16 brigadistas contratados). Seções 14, 15 e 17 não entram.
- Exemplos de PIPCIF 2026 já carregados (para ver como foram tratados): `<conversores>/gerar_22a.py` (módulo 5 de três UCs) e os SQL `<conversores>/14a_pipcif_2026_tres_ucs.sql`, `18a_infra_tres_ucs.sql`, `19a_recursos_tres_ucs.sql` (módulos 1–4; veja formato de atributos de uc_ponto por tipo: vigilancia, pista, heliponto, estacao, agua).

## Regras
1. Fidelidade: só o que está no PDF. Não invente números, condições, categorias de dados, nomes. Quando o PDF tiver erro evidente (coordenada repetida/fora de MG, ano trocado), mantenha o dado plausível e registre no campo `obs` o que estava escrito; liste isso no seu relatório final.
2. Coordenadas: converter graus-minutos-segundos para decimal NEGATIVO (sul/oeste) com a função dms do modelo. Se vierem em UTM (zona 23S ou 24S, SIRGAS 2000), converta com pyproj (EPSG:31983 = 23S, EPSG:31984 = 24S) — veja gerar_22a.py. Toda coordenada deve cair em MG (lat -23.5 a -14, lon -51.5 a -39.5); se não cair, deixe null e explique em obs.
3. Campos vazios / "-" / "não possui": null. Marque `nao_possui` em uc_infra SÓ quando o PIPCIF declarar que não há (tabela com "-" ou "não possui"/"não há"). Chaves válidas: tipos de uc_ponto ('vigilancia','pista','heliponto','estacao','agua'), 'veiculo', 'radio_uc:repetidora|fixo|movel|portatil', 'radio_parceiro:fixo|movel|portatil', 'material', 'parceiro', 'prestador:alimentacao|saude|abastecimento|outro', 'colaborador', 'brigadista', 'via:aceiro|estrada|trilha', 'elemento', 'acao', 'projeto', 'brigada'.
4. Valores permitidos (checks do banco):
   - uc_ponto.tipo: vigilancia, pista, heliponto, estacao, agua; situacao: operante, parcial, inoperante ou null.
   - uc_veiculo.tipo (lista livre, prefira): Camionete, Carro, Moto, Caminhão, Caminhão-pipa, Trator, Quadriciclo, Barco, Outro; conservacao: bom, regular, ruim; disponivel boolean.
   - uc_radio: origem uc|parceiro; tipo repetidora|fixo|movel|portatil; conservacao bom|ruim|inoperante|null; quantidade int ≥0 (obrigatório), qtd_uso.
   - uc_material.tipo: manual, especial, epi. Use nomes padronizados quando for o mesmo item: Abafador, Bomba costal, Pinga-fogo, Motosserra, Motobomba, Roçadeira, Soprador, Caminhão-pipa, Lanterna de cabeça, Óculos de proteção, Luvas... Demanda para aquisição vai em obs ("demanda para aquisição: N", omitir 0).
   - uc_parceiro.tipo (prefira): Corpo de Bombeiros, Polícia Militar, Polícia Militar Ambiental, Prefeitura, Guarda Municipal, Defesa Civil, Brigada voluntária / ONG, Empresa, Órgão público, Outro. apoios = lista de {tipo, quantidade, obs} (strings).
   - uc_prestador.tipo: alimentacao, saude, abastecimento, outro.
   - uc_colaborador.tipo: colaborador ou brigadista.
   - uc_via.tipo: aceiro, estrada, trilha; condicao: bom, regular, ruim, inexistente ou null (use a função cond do modelo; texto original em condicao_obs quando não for claramente bom). geojson = LineString [início, fim] e tracado_origem 'pontos'; se início/fim faltarem, sem geojson.
   - uc_elemento.tipo: favoravel, adverso; categoria uma de: Infraestrutura e recursos, Comunicação, Parcerias e mobilização, Vigilância e monitoramento, Acesso e relevo, Água, Clima, Vegetação e combustível, Ação humana, Situação fundiária, Outro.
   - uc_acao_preventiva: ano = ano do PIPCIF; categoria uma de: Capacitação, Sensibilização e divulgação, Educação ambiental, Aceiros e limpeza, Ronda e monitoramento, Queima prescrita, Reunião e articulação, Brigada, Outra; mes_ini/mes_fim 1–12 ou null; periodo = texto como escrito.
   - uc_projeto.situacao: em_andamento | concluido | suspenso | null (use em_andamento só se o texto indicar andamento/contínuo, senão null). area_ha numérico.
   - uc_brigada: contratações (ano, nome = contratante, quantidade, lideres, mes_ini, mes_fim, veiculos, obs). Textos de rotina vão em uc_infra.brig_atividades / brig_rondas / brig_plantao.
   - uc_cadastro: veja o UPDATE do modelo (gerente_nome, gerente_contatos [{tipo tel|email, valor, obs}], func_adm, func_oper, responsaveis [{nome, telefone, email}], decretos, area_decreto_ha, biomas (array: Cerrado, Mata Atlântica, Caatinga), fitofisionomia, topografia, clima, meses_criticos int[], ref_lat, ref_lon, altitude_min, altitude_max, fundiaria_pct, fundiaria_ha, fundiaria_obs, sede_municipio, sede_endereco, sede_lat, sede_lon, obs) e ADICIONE `pipcif_ano = 2026`. Atualize a regional (tabela regional: telefones, coordenador, coord_contatos) só `where nome = '<regional>' and coordenador is null`.
   - uc_infra: um INSERT (nome_uc, tem_alojamento, camas, roupa_cama, sanitarios, cozinha, tem_camping, barracas, camping_sanitarios, camping_energia, alojamento_obs, nao_possui, outros_contatos jsonb [{nome, telefone, obs}], rede_obs, brig_atividades, brig_rondas, brig_plantao) — inclua os campos que houver. ATENÇÃO: o banco já pode ter linha em uc_infra? Não: para estas UCs não tem. Use INSERT.
5. Nomes em MAIÚSCULAS → Título (função tt/nomeok). Telefones de brigadistas → "(DD) NNNNN-NNNN" (função fone).
6. O nome_uc no banco é exatamente o informado na tarefa (ex.: 'Alto Cariri'), não o nome completo.
7. Texto em português correto, sem abreviar à toa; pode padronizar pontuação.
8. NÃO grave nada no Supabase. NÃO coloque nada no repositório público. Escreva o script em `<conversores>/gerar_<slug>.py` gerando os SQL em `<rascunho>/<slug>/` (cadastro.sql, infra.sql, recursos.sql, apoio.sql, prevencao.sql). Mantenha cada INSERT em lotes de no máximo ~60 linhas se necessário (arquivos podem ter vários inserts).
9. Teste no banco LOCAL: `/tmp/claude-0/subir.sh` (sobe postgres se cair), depois para cada arquivo: `su postgres -c "psql -d teste -v ON_ERROR_STOP=1 -q" < arquivo.sql`. Corrija até rodar sem erro. Se precisar refazer, antes apague os dados da UC no banco local: `delete from uc_via/uc_elemento/uc_acao_preventiva/uc_projeto/uc_brigada/uc_ponto/uc_veiculo/uc_radio/uc_material/uc_parceiro/uc_prestador/uc_colaborador where nome_uc = '...'; delete from uc_infra where nome_uc='...';` (somente no banco local `teste`).
10. Relatório final (sua resposta): contagens por tabela, lista objetiva de inconsistências/decisões (coordenadas suspeitas, campos ausentes, nao_possui marcados), e o caminho dos arquivos. Seja conciso.
