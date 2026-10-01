// Módulos 3 (Recursos e comunicação), 4 (Rede de apoio) e 5 (Atividades Preventivas) do Cadastro da UC.
// Motor genérico: cada módulo é uma lista de blocos (seções do PIPCIF) de quatro modos:
//   fichas  — registros com formulário próprio e, se houver, coordenada (aparecem no mapa do módulo);
//             com largo:true ficam em largura total, fora da coluna do mapa (ex.: cronograma);
//   linhas  — como fichas, mas com traçado (aceiros, estradas, trilhas): desenho no mapa, arquivo
//             KML/KMZ/GPX/GeoJSON ou linha reta entre início e fim;
//   tabela  — registros curtos editados em linha (veículos, materiais, brigadistas);
//   infra   — campos da própria UC guardados em uc_infra (outros contatos, observações).
// Usa as funções e variáveis globais de ucs.html (sb, $, $$, esc, msg, podeEditar, UCS, GEO, htmlCoord…).
(function(){
const DISP = [["true","Disponível"],["false","Indisponível"]];
const CONS3 = [["bom","Bom"],["regular","Regular"],["ruim","Ruim"]];
const CONSR = [["bom","Bom"],["ruim","Ruim"],["inoperante","Inoperante"]];
const SITUACAO_MAT = ["Bom","Regular","Ruim","Em manutenção"];
const PADRAO_MAT = {
  manual:["Abafador","Bomba costal","Cavadeira (boca de lobo)","Chibanca","Enxada","Enxadão","Facão","Foice","Gorgui","Machado","McLeod","Pá","Pá dobrável","Picareta","Pinga-fogo","Pulaski","Rastelo"],
  especial:["Motosserra","Motobomba","Roçadeira","Soprador","Kit de combate (Guarani)","Trator","Caminhão-pipa","GPS","Bússola","Lanterna"],
  epi:["Capacete","Balaclava","Óculos de proteção","Luvas","Perneira","Gandola","Calça","Coturno","Cantil","Apito","Lanterna de cabeça","Mochila"]
};
const tel = r => [r.municipio, r.distancia && "a " + r.distancia].filter(Boolean).join(" · ");
const MESES_OP = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m, i) => [String(i + 1), m]);
const COND_VIA = [["bom","Bom"],["regular","Regular"],["ruim","Ruim — precisa de manutenção"],["inexistente","Inexistente — refazer"]];
const SIT_ACAO = [["planejada","Planejada"],["em_andamento","Em andamento"],["realizada","Realizada"],["adiada","Adiada"],["nao_realizada","Não realizada"]];
const CAT_ACAO = {"Capacitação":"#7c3aed","Sensibilização e divulgação":"#0b7fab","Educação ambiental":"#0f9d58","Aceiros e limpeza":"#e8590c",
  "Ronda e monitoramento":"#c2255c","Queima prescrita":"#d9480f","Reunião e articulação":"#5c7cfa","Brigada":"#a0522d","Outra":"#868e96"};
const CAT_ELEM = ["Infraestrutura e recursos","Comunicação","Parcerias e mobilização","Vigilância e monitoramento","Acesso e relevo","Água","Clima",
  "Vegetação e combustível","Ação humana","Situação fundiária","Outro"];
const mesesTxt = r => r.mes_ini ? MESES_OP[r.mes_ini - 1][1] + (r.mes_fim && r.mes_fim !== r.mes_ini ? "–" + MESES_OP[r.mes_fim - 1][1] : "") : "";
const fmtM = m => m == null ? "" : m >= 1000 ? (m / 1000).toLocaleString("pt-BR", {maximumFractionDigits:2}) + " km" : Math.round(m) + " m";

const MODULOS = {
  recursos: [
    {id:"radUC", s:"4.5", t:"Radiocomunicação instalada na UC", modo:"fichas", tab:"uc_radio", fixo:{origem:"uc"}, np:"radio_uc:",
     subtipos:{repetidora:"Estações repetidoras", fixo:"Rádios fixos", movel:"Rádios móveis (veiculares)", portatil:"Rádios portáteis (HT)"},
     coord:["repetidora","fixo"], icone: r => r.tipo === "repetidora" ? "antena" : "radio",
     campos:[{k:"nome", rot:"Local", so:["repetidora","fixo"], duplo:true}, {k:"nome", rot:"Placa / veículo", so:["movel"], duplo:true}, {k:"nome", rot:"Onde ficam", so:["portatil"], duplo:true},
             {k:"quantidade", rot:"Quantidade", num:true, so:["fixo","movel","portatil"]}, {k:"qtd_uso", rot:"Em condição de uso", num:true, so:["portatil"]},
             {k:"conservacao", rot:"Estado de conservação", opcoes:CONSR, so:["repetidora","fixo","movel"]}, {k:"obs", rot:"Observação", largo:true}],
     titulo: r => r.tipo === "portatil" ? `${r.quantidade ?? "?"} rádio(s) HT` : (r.nome || "(sem identificação)"),
     resumo: r => [r.tipo === "portatil" && r.qtd_uso != null && `${r.qtd_uso} em condição de uso`, r.tipo !== "portatil" && r.quantidade > 1 && `${r.quantidade} unidades`, r.nome && r.tipo === "portatil" && r.nome, r.obs].filter(Boolean).join(" · "),
     situacao: r => r.conservacao},
    {id:"radPar", s:"4.6", t:"Rádios disponibilizados por parceiros", modo:"fichas", tab:"uc_radio", fixo:{origem:"parceiro"}, np:"radio_parceiro:",
     subtipos:{fixo:"Rádios fixos", movel:"Rádios móveis", portatil:"Rádios portáteis (HT)"}, coord:["fixo"], icone: () => "radio",
     campos:[{k:"nome", rot:"Parceiro / local", duplo:true, obrig:true}, {k:"quantidade", rot:"Quantidade em condição de uso", num:true},
             {k:"conservacao", rot:"Estado de conservação", opcoes:CONSR}, {k:"obs", rot:"Observação", largo:true}],
     titulo: r => r.nome || "(parceiro)", resumo: r => [r.quantidade != null && `${r.quantidade} rádio(s)`, r.obs].filter(Boolean).join(" · "), situacao: r => r.conservacao},
    {id:"veic", s:"4.4", t:"Veículos da UC", modo:"tabela", tab:"uc_veiculo", np:"veiculo",
     cols:[{k:"tipo", rot:"Tipo", w:"140px", lista:["Camionete","Carro","Moto","Caminhão","Caminhão-pipa","Trator","Quadriciclo","Barco","Outro"], obrig:true},
           {k:"nome", rot:"Marca / modelo", w:"minmax(0,1.3fr)"}, {k:"placa", rot:"Placa / identificação", w:"minmax(0,1fr)"},
           {k:"conservacao", rot:"Conservação", w:"118px", opcoes:CONS3}, {k:"disponivel", rot:"Disponibilidade", w:"128px", opcoes:DISP, bool:true},
           {k:"obs", rot:"Observação", w:"minmax(0,1.3fr)"}]},
    {id:"mat", s:"5", t:"Materiais e equipamentos", modo:"tabela", tab:"uc_material", np:"material",
     dica:"Deixe “Detentor” vazio para o que é da UC; informe a brigada ou o parceiro quando o material for dele (ex.: Brigada 1).",
     grupos:{col:"tipo", valores:{manual:"Ferramentas manuais", especial:"Equipamentos especiais", epi:"Equipamentos de proteção individual (EPI)"}},
     padrao: PADRAO_MAT,
     cols:[{k:"nome", rot:"Item", w:"minmax(0,1.4fr)", obrig:true, listaGrupo:PADRAO_MAT}, {k:"quantidade", rot:"Qtd.", w:"78px", num:true},
           {k:"situacao", rot:"Situação", w:"minmax(0,1fr)", lista:SITUACAO_MAT}, {k:"detentor", rot:"Detentor (vazio = UC)", w:"minmax(0,1fr)"},
           {k:"obs", rot:"Observação", w:"minmax(0,1.3fr)"}]}
  ],
  apoio: [
    {id:"parc", s:"6", t:"Parceiros e apoios disponíveis", modo:"fichas", tab:"uc_parceiro", np:"parceiro", rotulo:"Parceiros", coord:true, icone: () => "parceiro", apoios:true,
     campos:[{k:"tipo", rot:"Tipo de parceiro", lista:["Corpo de Bombeiros","Polícia Militar","Polícia Militar Ambiental","Prefeitura","Guarda Municipal","Defesa Civil","Brigada voluntária / ONG","Empresa","Órgão público","Outro"]},
             {k:"nome", rot:"Identificação do parceiro", duplo:true, obrig:true}, {k:"responsavel", rot:"Responsável(is)", area:true, largo:true},
             {k:"contatos", rot:"Telefones e e-mails", area:true, largo:true}, {k:"endereco", rot:"Endereço", duplo:true}, {k:"municipio", rot:"Município"},
             {k:"ponto_ref", rot:"Ponto de referência", duplo:true}, {k:"obs", rot:"Observação", largo:true}],
     titulo: r => r.nome, resumo: r => [r.tipo, r.municipio, (r.apoios||[]).length && (r.apoios||[]).map(a => a.tipo).filter(Boolean).join(", ")].filter(Boolean).join(" · ")},
    {id:"prest", s:"7", t:"Prestadores de serviço", modo:"fichas", tab:"uc_prestador", np:"prestador:", coord:true, icone: r => r.tipo,
     subtipos:{alimentacao:"7.1 Alimentação — restaurantes, padarias, lanchonetes", saude:"7.2 Unidades de saúde", abastecimento:"7.3 Abastecimento de veículos", outro:"7.3 Outros serviços"},
     campos:[{k:"nome", rot:"Nome", duplo:true, obrig:true}, {k:"responsavel", rot:"Responsável"}, {k:"endereco", rot:"Endereço", duplo:true}, {k:"municipio", rot:"Município"},
             {k:"contatos", rot:"Telefones e e-mails", area:true, largo:true}, {k:"distancia", rot:"Distância da UC"},
             {k:"servicos", rot:"Serviços disponíveis (e valores)", duplo:true}, {k:"capacidade", rot:"Capacidade (refeições)", so:["alimentacao"]},
             {k:"conveniado", rot:"Abastece veículos oficiais?", opcoes:[["true","Sim (conveniado)"],["false","Não"]], bool:true, so:["abastecimento"]},
             {k:"obs", rot:"Observação", largo:true}],
     titulo: r => r.nome, resumo: r => [tel(r), r.servicos, r.conveniado === true && "conveniado"].filter(Boolean).join(" · ")},
    {id:"colab", s:"8", t:"Colaboradores e moradores", modo:"fichas", tab:"uc_colaborador", fixo:{tipo:"colaborador"}, np:"colaborador", rotulo:"Colaboradores e moradores", coord:true, icone: () => "colaborador",
     campos:[{k:"nome", rot:"Nome", duplo:true, obrig:true}, {k:"contato", rot:"Contato"}, {k:"localizacao", rot:"Localização / propriedade", duplo:true}, {k:"municipio", rot:"Município"},
             {k:"apoio", rot:"Atividade e tipo de apoio", largo:true}, {k:"obs", rot:"Observação", largo:true}],
     titulo: r => r.nome, resumo: r => [r.localizacao, r.apoio].filter(Boolean).join(" · ")},
    {id:"outros", s:"6", t:"Outros contatos importantes", modo:"infra",
     campos:[{k:"outros_contatos", rep:[{k:"nome", rot:"Contato (órgão, setor ou pessoa)", w:"minmax(0,1.6fr)"}, {k:"telefone", rot:"Telefone", w:"minmax(0,1fr)"}, {k:"obs", rot:"Obs.", w:"minmax(0,1fr)"}]}]},
    {id:"viz", s:"8", t:"Grupos e contatos com a vizinhança", modo:"infra",
     campos:[{k:"rede_obs", rot:"Grupos de mensagens, associações, conselhos e outras formas de contato com moradores do entorno", area:true}]},
    {id:"brig", s:"9", t:"Brigadistas voluntários", modo:"tabela", tab:"uc_colaborador", fixo:{tipo:"brigadista"}, np:"brigadista",
     cols:[{k:"nome", rot:"Nome", w:"minmax(0,1.8fr)", obrig:true}, {k:"municipio", rot:"Município", w:"minmax(0,1fr)"}, {k:"contato", rot:"Telefone", w:"minmax(0,1fr)"}, {k:"obs", rot:"Observação", w:"minmax(0,1.2fr)"}]}
  ],
  prevencao: [
    {id:"vias", s:"10", t:"Aceiros, estradas e trilhas", modo:"linhas", tab:"uc_via", np:"via:", importar:true,
     subtipos:{aceiro:"Aceiros", estrada:"Estradas", trilha:"Trilhas"}, icone: r => r.tipo || "aceiro",
     campos:[{k:"nome", rot:"Nome do local", duplo:true, obrig:true}, {k:"municipio", rot:"Município"},
             {k:"ponto_ref", rot:"Ponto de referência", duplo:true}, {k:"responsavel", rot:"Quem constrói / mantém"},
             {k:"manutencao", rot:"Construção / manutenção (datas, periodicidade)", largo:true},
             {k:"largura_m", rot:"Largura (m)", dec:true}, {k:"comprimento_m", rot:"Comprimento declarado (m)", dec:true},
             {k:"condicao", rot:"Condição atual", opcoes:COND_VIA}, {k:"condicao_obs", rot:"Observação sobre a condição", largo:true}, {k:"obs", rot:"Observação", largo:true}],
     titulo: r => r.nome,
     resumo: r => [r.compr_mapa_m != null && r.tracado_origem !== "pontos" ? fmtM(r.compr_mapa_m) + " no mapa" : r.comprimento_m != null && fmtM(r.comprimento_m),
                   r.largura_m != null && `${String(r.largura_m).replace(".", ",")} m de largura`, r.condicao_obs || r.manutencao].filter(Boolean).join(" · "),
     selo: r => ({bom:["operante","Bom"], regular:["parcial","Regular"], ruim:["inoperante","Ruim"], inexistente:["inoperante","Inexistente"]})[r.condicao]},
    {id:"proj", s:"13", t:"Projetos de sustentabilidade ambiental", modo:"fichas", tab:"uc_projeto", np:"projeto", rotulo:"Projetos dentro e no entorno da UC", coord:true, icone: () => "projeto",
     dica:"Bolsa Verde, proteção e cercamento de nascentes, fomento florestal, recuperação de áreas degradadas, reserva legal e outros.",
     campos:[{k:"nome", rot:"Projeto (identificação)", duplo:true, obrig:true},
             {k:"tipo", rot:"Tipo do projeto", lista:["Bolsa Verde","Proteção / cercamento de nascente","Fomento florestal","Recuperação de área degradada","Restauração / plantio","Reserva legal","Educação ambiental","Resíduos sólidos","Outro"]},
             {k:"situacao", rot:"Situação", opcoes:[["em_andamento","Em andamento"],["concluido","Concluído"],["suspenso","Suspenso"]]},
             {k:"descricao", rot:"Descrição", area:true, largo:true}, {k:"propriedade", rot:"Propriedade / local", duplo:true}, {k:"municipio", rot:"Município"},
             {k:"area_ha", rot:"Área (ha)", dec:true}, {k:"data_inicio", rot:"Início do projeto"}, {k:"altitude", rot:"Altitude (m)", num:true},
             {k:"responsavel", rot:"Responsável", duplo:true}, {k:"contatos", rot:"Telefones e e-mails do responsável", area:true, largo:true},
             {k:"proprietario", rot:"Proprietário", duplo:true}, {k:"proprietario_contato", rot:"Contato do proprietário"},
             {k:"ponto_ref", rot:"Ponto cardeal / referência / como chegar", area:true, largo:true}, {k:"obs", rot:"Observação", largo:true}],
     titulo: r => r.nome, resumo: r => [r.tipo, r.municipio, r.area_ha != null && `${String(r.area_ha).replace(".", ",")} ha`, r.data_inicio && "desde " + r.data_inicio].filter(Boolean).join(" · "),
     selo: r => ({concluido:["operante","Concluído"], suspenso:["inoperante","Suspenso"]})[r.situacao]},
    {id:"elem", s:"11", t:"Elementos favoráveis e adversos à prevenção e ao combate", modo:"tabela", tab:"uc_elemento", np:"elemento",
     dica:"Uma linha por elemento. A categoria ajuda a montar o mapa de risco e a comparar UCs.",
     grupos:{col:"tipo", valores:{favoravel:"11.1 Elementos favoráveis", adverso:"11.2 Elementos adversos"}},
     cols:[{k:"nome", rot:"Elemento", w:"minmax(0,2.6fr)", obrig:true}, {k:"categoria", rot:"Categoria", w:"minmax(0,1fr)", lista:CAT_ELEM}]},
    {id:"acoes", s:"12", t:"Cronograma de ações preventivas", modo:"fichas", largo:true, tab:"uc_acao_preventiva", np:"acao", rotulo:"Ações de capacitação e sensibilização", icone: () => "acao",
     novo: () => ({ano: new Date().getFullYear(), situacao:"planejada"}), visao: r => gantt(r),
     ordem: (a, b) => b.ano - a.ano || (a.mes_ini || 13) - (b.mes_ini || 13) || a.id - b.id,
     campos:[{k:"nome", rot:"Atividade", duplo:true, obrig:true}, {k:"ano", rot:"Ano", num:true, obrig:true},
             {k:"categoria", rot:"Categoria", opcoes:Object.keys(CAT_ACAO).map(c => [c, c])}, {k:"situacao", rot:"Situação", opcoes:SIT_ACAO},
             {k:"responsavel", rot:"Responsável(is)"}, {k:"mes_ini", rot:"Mês de início", opcoes:MESES_OP, num:true}, {k:"mes_fim", rot:"Mês de término", opcoes:MESES_OP, num:true},
             {k:"periodo", rot:"Período (datas, se houver)"}, {k:"local", rot:"Local", duplo:true}, {k:"publico", rot:"Público-alvo", duplo:true}, {k:"obs", rot:"Observação", largo:true}],
     titulo: r => r.nome, resumo: r => [r.ano, mesesTxt(r) || r.periodo, r.local, r.responsavel].filter(Boolean).join(" · "),
     selo: r => ({realizada:["operante","Realizada"], em_andamento:["parcial","Em andamento"], adiada:["parcial","Adiada"], nao_realizada:["inoperante","Não realizada"]})[r.situacao]},
    {id:"brigC", s:"16", t:"Brigadistas contratados", modo:"tabela", tab:"uc_brigada", np:"brigada",
     dica:"Uma linha por contratação (ano e contratante). Os nomes dos brigadistas não entram aqui.",
     cols:[{k:"ano", rot:"Ano", w:"76px", num:true, obrig:true}, {k:"nome", rot:"Contratante / programa", w:"minmax(0,1.6fr)", lista:["Previncêndio","Compensação minerária","Prefeitura","Parceria","Outro"]},
           {k:"quantidade", rot:"Brigadistas", w:"92px", num:true}, {k:"lideres", rot:"Líderes", w:"80px", num:true},
           {k:"mes_ini", rot:"Início", w:"84px", opcoes:MESES_OP, num:true}, {k:"mes_fim", rot:"Fim", w:"84px", opcoes:MESES_OP, num:true},
           {k:"veiculos", rot:"Veículos", w:"minmax(0,1fr)"}, {k:"obs", rot:"Observação", w:"minmax(0,1.3fr)"}]},
    {id:"brigR", s:"16", t:"Rotina dos brigadistas contratados", modo:"infra",
     campos:[{k:"brig_atividades", rot:"Atividades fora do combate (sensibilização, manutenção de equipamentos e aceiros, apoio ao ROI)", area:true},
             {k:"brig_rondas", rot:"Como as rondas preventivas são planejadas? Há rotas fixas? Os pontos críticos estão mapeados?", area:true},
             {k:"brig_plantao", rot:"No plantão, os brigadistas ficam fixos ou são distribuídos em pontos estratégicos?", area:true}]}
  ]
};
window.MODULOS_UC = MODULOS;

// rótulos para o histórico
const NP_ROT = {veiculo:"Veículos", material:"Materiais", parceiro:"Parceiros", colaborador:"Colaboradores/moradores", brigadista:"Brigadistas voluntários",
  elemento:"Elementos favoráveis e adversos", acao:"Ações preventivas", projeto:"Projetos de sustentabilidade", brigada:"Brigadistas contratados"};
Object.values(MODULOS).flat().filter(b => b.subtipos).forEach(b => Object.entries(b.subtipos).forEach(([k, t]) => NP_ROT[b.np + k] = t.replace(/^7\.\d /, "")));
window.MU_NP = NP_ROT;
window.MU_REF = {repetidora:"Repetidora", fixo:"Rádio fixo", movel:"Rádio móvel", portatil:"Rádios portáteis", manual:"Ferramenta", especial:"Equipamento", epi:"EPI",
  alimentacao:"Alimentação", saude:"Saúde", abastecimento:"Abastecimento", outro:"Prestador", colaborador:"Colaborador", brigadista:"Brigadista voluntário",
  aceiro:"Aceiro", estrada:"Estrada", trilha:"Trilha", favoravel:"Elemento favorável", adverso:"Elemento adverso"};
const ROT_NOVOS = {placa:"Placa", conservacao:"Conservação", disponivel:"Disponível", quantidade:"Quantidade", qtd_uso:"Em condição de uso", origem:"Origem",
  detentor:"Detentor", responsavel:"Responsável", contatos:"Contatos", municipio:"Município", apoios:"Apoios disponíveis", distancia:"Distância da UC",
  servicos:"Serviços", capacidade:"Capacidade", conveniado:"Conveniado", localizacao:"Localização", contato:"Contato", apoio:"Atividade/apoio",
  outros_contatos:"Outros contatos importantes", rede_obs:"Contatos com a vizinhança",
  largura_m:"Largura (m)", comprimento_m:"Comprimento declarado (m)", condicao:"Condição", condicao_obs:"Obs. da condição", manutencao:"Construção/manutenção",
  tracado_origem:"Origem do traçado", tracado_em:"Traçado alterado", compr_mapa_m:"Comprimento no mapa (m)", categoria:"Categoria", ano:"Ano",
  mes_ini:"Mês inicial", mes_fim:"Mês final", periodo:"Período", local:"Local", publico:"Público-alvo", propriedade:"Propriedade", descricao:"Descrição",
  area_ha:"Área (ha)", altitude:"Altitude", proprietario:"Proprietário", proprietario_contato:"Contato do proprietário", data_inicio:"Início",
  lideres:"Líderes", veiculos:"Veículos", brig_atividades:"Atividades dos brigadistas", brig_rondas:"Rondas preventivas", brig_plantao:"Plantão dos brigadistas"};
for (const [k, v] of Object.entries(ROT_NOVOS)) if (!(k in ROTULOS)) ROTULOS[k] = v;

let MU = null, mapaMU = null, camadaMU = null, alvoMU = false;
const regsBloco = b => (MU.dados[b.tab] || []).filter(r => Object.entries(b.fixo || {}).every(([k, v]) => r[k] === v));
const npKey = (b, st) => st ? b.np + st : b.np;
const temCoord = (b, st) => b.coord === true || (Array.isArray(b.coord) && b.coord.includes(st));
const CAMPOS_INFRA = ["outros_contatos","rede_obs","brig_atividades","brig_rondas","brig_plantao","nao_possui"];
const noMapa = b => b.modo === "linhas" || (b.modo === "fichas" && !b.largo);
const ehFichas = b => b.modo === "fichas" || b.modo === "linhas";

window.abrirModuloUC = async function(id, nome){
  const blocos = MODULOS[id], ed = podeEditar(nome), box = $("#mod-conteudo");
  box.innerHTML = `<div class="dica" style="padding:20px">Carregando…</div>`;
  const tabs = [...new Set(blocos.filter(b => b.tab).map(b => b.tab))];
  const res = await Promise.all([
    sb.from("uc_infra").select("*").eq("nome_uc", nome).maybeSingle(),
    sb.from("auditoria").select("*").in("tabela", tabs.concat("uc_infra")).eq("chave", nome).order("quando", {ascending:false}).limit(150),
    sb.from("uc_cadastro").select("meses_criticos").eq("nome_uc", nome).maybeSingle(),
    ...tabs.map(t => sb.from(t).select("*").eq("nome_uc", nome).order("id"))]);
  const erro = res.find(r => r.error);
  if (erro) return box.innerHTML = `<div class="dica" style="color:var(--erro);padding:20px">${esc(erro.error.message)}</div>`;
  const keysMod = new Set(blocos.flatMap(b => b.np ? (b.subtipos ? Object.keys(b.subtipos).map(s => b.np + s) : [b.np]) : []));
  const hist = (res[1].data || []).filter(h => h.tabela !== "uc_infra" ||
    (h.campos || []).some(c => c !== "nao_possui" && CAMPOS_INFRA.includes(c) && blocos.some(b => b.modo === "infra" && b.campos.some(x => x.k === c))) ||
    ((h.campos || []).includes("nao_possui") && [...(h.antes?.nao_possui || []), ...(h.depois?.nao_possui || [])].some(k => keysMod.has(k))));
  MU = {id, nome, ed, blocos, inf: res[0].data || {nome_uc: nome, nao_possui: [], outros_contatos: []}, novoInf: !res[0].data,
        cad: res[2].data || {}, dados: Object.fromEntries(tabs.map((t, i) => [t, res[i + 3].data || []])), edit: null, anoG: MU?.nome === nome ? MU.anoG : null};
  pararGeo();
  const fichas = blocos.filter(noMapa), outros = blocos.filter(b => !noMapa(b));
  const fs = b => `<fieldset data-bloco="${b.id}"><legend>${esc(b.s)} ${esc(b.t)}</legend>${b.dica ? `<p class="dica" style="margin:0 0 8px">${esc(b.dica)}</p>` : ""}<div class="mu-editor"></div><div class="mu-corpo"></div></fieldset>`;
  box.innerHTML = `
    ${fichas.length ? `<div class="infra-grade mu-grade"><div class="mu-mapa"><div id="mapaMU"></div><div class="dica" id="legMU" style="margin-top:4px"></div></div>
      <div>${ed ? `<p class="dica" style="margin:14px 0 0">Clique num item para ver ou editar. ${fichas.some(b => b.modo === "linhas") ? "Os traçados podem ser desenhados no mapa ou importados de arquivo (KML, KMZ, GPX ou GeoJSON); os pontos, digitados ou marcados no mapa." : "A coordenada pode ser digitada (decimal, graus-minutos-segundos ou UTM) ou marcada no mapa."}</p>` : ""}${fichas.map(fs).join("")}</div></div>` : ""}
    ${outros.map(fs).join("")}
    <details class="historico"><summary>Histórico de alterações deste módulo (${hist.length})</summary>${htmlHistorico(hist)}</details>`;
  fichas.forEach(listaFichas);
  outros.forEach(b => b.modo === "tabela" ? tabelaBloco(b) : b.modo === "fichas" ? listaFichas(b) : infraBloco(b));
  if (fichas.length) montarMapaMU();
};

/* ---------- "não possui" ---------- */
function npHtml(key, n){
  const np = new Set(MU.inf.nao_possui || []);
  return n ? "" : `<label title="Marque se a UC não possui — conta como informado"><input type="checkbox" data-np="${key}" ${np.has(key) ? "checked" : ""} ${MU.ed ? "" : "disabled"}> não possui</label>`;
}
function ligarNP(el){
  $$("[data-np]", el).forEach(c => c.onchange = async () => {
    const s = new Set(MU.inf.nao_possui || []); c.checked ? s.add(c.dataset.np) : s.delete(c.dataset.np);
    const {error} = await salvarInfra({nao_possui: [...s]});
    if (error) return msg(error.message, "erro");
    msg("Informação salva."); abrirModuloUC(MU.id, MU.nome);
  });
}
async function salvarInfra(o){
  return MU.novoInf ? await sb.from("uc_infra").insert({nome_uc: MU.nome, ...o}) : await sb.from("uc_infra").update(o).eq("nome_uc", MU.nome);
}
async function tirarNP(keys){
  const np = MU.inf.nao_possui || [];
  if (!MU.novoInf && keys.some(k => np.includes(k))) await sb.from("uc_infra").update({nao_possui: np.filter(k => !keys.includes(k))}).eq("nome_uc", MU.nome);
}

/* ---------- campos ---------- */
function campoHtml(c, v, dis){
  const cls = c.largo ? "largo" : c.duplo ? "duplo" : "";
  const rot = `<label>${esc(c.rot)}${c.obrig ? " *" : ""}</label>`;
  if (c.area) return `<div class="${cls}">${rot}<textarea data-c="${c.k}" style="min-height:54px" ${dis}>${esc(v ?? "")}</textarea></div>`;
  if (c.opcoes) return `<div class="${cls}">${rot}<select data-c="${c.k}" ${dis}><option value=""></option>${c.opcoes.map(([o, t]) => `<option value="${o}" ${String(v) === o ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`;
  const dl = c.lista ? `<datalist id="dl-mu-${c.k}">${c.lista.map(o => `<option value="${esc(o)}">`).join("")}</datalist>` : "";
  return `<div class="${cls}">${rot}<input data-c="${c.k}" ${c.num ? 'type="number" min="0"' : c.dec ? 'inputmode="decimal"' : ""} ${c.lista ? `list="dl-mu-${c.k}"` : ""} value="${esc(v ?? "")}" ${dis}>${dl}</div>`;
}
const normVal = (c, v) => {
  if (v == null || String(v).trim() === "") return null;
  if (c.bool) return v === true || v === "true";
  if (c.dec){ const n = +String(v).replace(/\s/g, "").replace(",", "."); return isNaN(n) || n < 0 ? NaN : n; }
  if (c.num){ const n = Math.round(+String(v).replace(",", ".")); return isNaN(n) ? NaN : Math.max(0, n); }
  return String(v).trim();
};

/* ---------- modo fichas ---------- */
function listaFichas(b){
  const el = $(`[data-bloco="${b.id}"] .mu-corpo`), regs = regsBloco(b), np = new Set(MU.inf.nao_possui || []);
  if (b.ordem) regs.sort(b.ordem);
  const grupos = b.subtipos ? Object.entries(b.subtipos) : [[null, b.rotulo || b.t]];
  const SELO = {bom:["operante","Bom"], ruim:["parcial","Ruim"], inoperante:["inoperante","Inoperante"]};
  const aviso = r => b.modo === "linhas" ? (!r.geojson ? "sem traçado" : r.tracado_origem === "pontos" ? "traçado aproximado (início–fim)" : "")
    : temCoord(b, r.tipo) && r.lat == null ? "sem coordenada" : "";
  el.innerHTML = (b.visao ? b.visao(regs) : "")
    + (b.importar ? `<div class="mu-acoes" style="margin:0 0 10px">${MU.ed ? `<button class="btn peq" type="button" data-imp>Importar KML, KMZ, GPX ou GeoJSON…</button>` : ""}
        ${regs.some(r => r.geojson) ? `<button class="btn peq" type="button" data-kml title="Para abrir no Google Earth, Avenza ou GPS">Baixar KML</button>` : ""}
        <input type="file" data-arq accept=".kml,.kmz,.gpx,.geojson,.json" hidden><span class="dica">${MU.ed ? "Cada linha do arquivo vira um registro." : ""}</span></div>` : "")
    + grupos.map(([st, rot]) => {
    const L = regs.filter(r => !st || r.tipo === st), key = npKey(b, st);
    const tot = b.modo === "linhas" && L.length ? L.reduce((s, r) => s + (+(r.tracado_origem !== "pontos" && r.compr_mapa_m || r.comprimento_m || r.compr_mapa_m) || 0), 0) : 0;
    return `<div class="tipo-bloco"><div class="th">${b.modo === "linhas" ? `<span class="mu-traco" style="--c:${COR_VIA[st]}"></span>` : iconeLegenda(b.icone({tipo: st}), 22)}<span class="sp">${esc(rot)} <span class="dica">(${L.length}${tot ? " · " + fmtM(tot) : ""})</span></span>
      ${npHtml(key, L.length)}${MU.ed ? `<button class="btn peq" type="button" data-add="${st || ""}">+ adicionar</button>` : ""}</div>
      ${L.map(r => { const sl = b.selo ? b.selo(r) : SELO[b.situacao?.(r)], av = aviso(r), rs = b.resumo(r) || "";
        return `<div class="pt ${MU.edit && MU.edit.r.id === r.id && MU.edit.b === b ? "sel" : ""}" data-id="${r.id}"><span><b>${esc(b.titulo(r))}</b></span>
        ${sl ? `<span class="sit ${sl[0]}">${esc(sl[1])}</span>` : "<span></span>"}
        <span class="d">${esc(rs)}${av ? `${rs ? " · " : ""}<i>${av}</i>` : ""}</span></div>`; }).join("")}
      ${!L.length && np.has(key) ? `<div class="pt" style="cursor:default"><span class="d">A UC declarou não possuir.</span></div>` : ""}</div>`;
  }).join("");
  $$("[data-id]", el).forEach(x => x.onclick = () => editarFicha(b, regs.find(r => r.id === +x.dataset.id)));
  $$("[data-add]", el).forEach(x => x.onclick = () => editarFicha(b, {...(b.fixo || {}), ...(b.subtipos ? {tipo: x.dataset.add} : {}), quantidade: b.tab === "uc_radio" ? 1 : undefined,
    ...(b.novo ? b.novo() : {}), apoios: [], _novo: true}));
  $$("[data-ano-g]", el).forEach(x => x.onchange = () => { MU.anoG = +x.value; listaFichas(b); });
  $$("[data-gid]", el).forEach(x => x.onclick = () => editarFicha(b, regs.find(r => r.id === +x.dataset.gid)));
  if (b.importar){
    $("[data-imp]", el)?.addEventListener("click", () => $("[data-arq]", el).click());
    $("[data-arq]", el).onchange = async e => { const f = e.target.files[0]; e.target.value = ""; if (f) importarLinhas(b, f); };
    $("[data-kml]", el)?.addEventListener("click", () => baixarKML(b, regs));
  }
  ligarNP(el);
}

function editarFicha(b, r){
  if (sujo && MU.edit && !confirm("Descartar as alterações deste item?")) return;
  sujo = false; pararGeo(); MU.edit = {b, r};
  $$(".mu-editor").forEach(e => e.innerHTML = "");
  const st = b.subtipos ? r.tipo : null, ed = MU.ed, dis = ed ? "" : "disabled", linha = b.modo === "linhas";
  const campos = b.campos.filter(c => !c.so || c.so.includes(st)), coord = temCoord(b, st);
  const el = $(`[data-bloco="${b.id}"] .mu-editor`);
  el.innerHTML = `<div class="editor-pt" id="muEd">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${r._novo ? "Novo — " : ""}${esc(b.subtipos ? b.subtipos[st] : (b.rotulo || b.t))}</b><button class="btn peq" type="button" id="muFechar">Fechar</button></div>
    <div class="grade" style="margin-top:8px">${campos.map(c => campoHtml(c, r[c.k], dis)).join("")}</div>
    ${b.apoios ? `<div style="margin-top:10px"><label>Apoios disponíveis</label><div class="rep" id="muApoios"></div></div>` : ""}
    ${linha ? htmlGeo(ed) : ""}
    ${coord ? `<div style="margin-top:8px">${htmlCoord("fc", r.lat, r.lon, ed)}</div>` : ""}
    ${ed ? `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn primario peq" type="button" id="muSalvar">Salvar</button>${r._novo ? "" : `<button class="btn peq perigo" type="button" id="muExcluir">Excluir</button>`}</div>` : ""}
  </div>`;
  const lerApoios = b.apoios ? repetidor($("#muApoios"), (r.apoios || []).map(x => ({...x})),
    [{k:"tipo", rot:"Tipo de apoio", w:"minmax(0,1.6fr)"}, {k:"quantidade", rot:"Qtd.", w:"90px"}, {k:"obs", rot:"Observação", w:"minmax(0,1.6fr)"}], ed, {tipo:"", quantidade:"", obs:""}) : null;
  $$("#muEd [data-c]").forEach(x => x.addEventListener("input", marcarSujo));
  $("#muFechar").onclick = () => { if (sujo && !confirm("Descartar as alterações?")) return; sujo = false; pararGeo(); MU.edit = null; el.innerHTML = ""; listaFichas(b); pintarMU(); };
  if (linha) ligarGeo(r, ed);
  const atualizarRes = () => {
    if (!coord) return;
    const la = lerCoord($('#muEd [data-k="fc_lat"]').value), lo = lerCoord($('#muEd [data-k="fc_lon"]').value), res = $('#muEd [data-res="fc"]'); res.classList.remove("bad");
    if (la === null || lo === null){ res.textContent = ""; pintarMU(); return; }
    if (Number.isNaN(la) || Number.isNaN(lo) || !dentroMG(la, lo)){ res.textContent = "Coordenada não reconhecida ou fora de MG."; res.classList.add("bad"); return; }
    const f = GEO?.features.find(x => x.properties.nome_uc === MU.nome), dentro = f ? pontoNoPoligono(la, lo, f.geometry) : null;
    res.textContent = `${la.toFixed(6)}, ${lo.toFixed(6)}` + (dentro === null ? "" : dentro ? " · dentro do limite da UC" : " · fora do limite da UC");
    pintarMU({lat: la, lon: lo});
  };
  if (coord){
    $$('#muEd [data-k^="fc_"]').forEach(i => i.addEventListener("change", atualizarRes)); atualizarRes();
    $('#muEd [data-marcar="fc"]')?.addEventListener("click", () => { alvoMU = true; $("#mapaMU").style.cursor = "crosshair"; msg("Clique no mapa para marcar o local."); });
    $('#muEd [data-utm-conv]')?.addEventListener("click", () => {
      const box = $('#muEd [data-coord="fc"]'), z = +$("[data-utm=z]", box).value;
      const E = numDec($("[data-utm=e]", box).value.replace(/[^\d.,]/g, "")), N = numDec($("[data-utm=n]", box).value.replace(/[^\d.,]/g, ""));
      if (!E || !N || E < 100000 || E > 900000 || N < 7000000 || N > 10000000) return msg("Confira E (6 dígitos) e N (7 dígitos).", "erro");
      const [la, lo] = utmParaGeo(z, E, N); $('#muEd [data-k="fc_lat"]').value = la.toFixed(6); $('#muEd [data-k="fc_lon"]').value = lo.toFixed(6); atualizarRes(); marcarSujo();
    });
  }
  $("#muSalvar")?.addEventListener("click", async () => {
    const o = {};
    for (const c of campos){ const v = normVal(c, $(`#muEd [data-c="${c.k}"]`).value); if (Number.isNaN(v)) return msg(`Confira “${c.rot}”.`, "erro"); if (c.obrig && v == null) return msg(`Informe “${c.rot}”.`, "erro"); o[c.k] = v; }
    if (b.tab === "uc_radio" && o.quantidade == null) o.quantidade = st === "repetidora" ? 1 : 0;
    if (lerApoios) o.apoios = lerApoios();
    if (linha && MU.geo?.mudou){ if (MU.geo.modo === "desenhar") concluirTrecho(); o.geojson = jsonDeGeo(MU.geo.partes); o.tracado_origem = o.geojson ? MU.geo.origem : null; }
    if (coord){
      const la = lerCoord($('#muEd [data-k="fc_lat"]').value), lo = lerCoord($('#muEd [data-k="fc_lon"]').value);
      if (Number.isNaN(la) || Number.isNaN(lo) || ((la === null) !== (lo === null))) return msg("Coordenada incompleta ou não reconhecida.", "erro");
      if (la !== null && !dentroMG(la, lo)) return msg("Coordenada fora de Minas Gerais.", "erro");
      o.lat = la === null ? null : +la.toFixed(6); o.lon = lo === null ? null : +lo.toFixed(6);
    }
    const {error} = r._novo ? await sb.from(b.tab).insert({nome_uc: MU.nome, ...(b.fixo || {}), ...(st ? {tipo: st} : {}), ...o}) : await sb.from(b.tab).update(o).eq("id", r.id);
    if (error) return msg("Não foi possível salvar: " + error.message, "erro");
    if (r._novo) await tirarNP([npKey(b, st)]);
    sujo = false; pararGeo(); MU.edit = null; msg("Salvo."); abrirModuloUC(MU.id, MU.nome);
  });
  $("#muExcluir")?.addEventListener("click", async () => {
    if (!confirm(`Excluir “${b.titulo(r)}”? A exclusão fica registrada no histórico.`)) return;
    const {error} = await sb.from(b.tab).delete().eq("id", r.id);
    if (error) return msg(error.message, "erro");
    sujo = false; pararGeo(); MU.edit = null; msg("Excluído."); abrirModuloUC(MU.id, MU.nome);
  });
  listaFichas(b);
  if (linha){ pintarMU(); if (MU.geo.partes.length && mapaMU) mapaMU.fitBounds(L.latLngBounds(MU.geo.partes.flat()), {padding:[30,30], maxZoom:16}); }
  else if (r.lat != null && mapaMU && !mapaMU.getBounds().contains([r.lat, r.lon])) mapaMU.setView([r.lat, r.lon], Math.max(mapaMU.getZoom(), 13));
  else if (r.lat != null) pintarMU();
  el.scrollIntoView({behavior:"smooth", block:"nearest"});
}

/* ---------- mapa do módulo ---------- */
function pontosMU(){
  return MU.blocos.filter(b => b.modo === "fichas" && !b.largo).flatMap(b => regsBloco(b).filter(r => r.lat != null && temCoord(b, r.tipo)).map(r => ({b, r})));
}
function montarMapaMU(){
  if (mapaMU){ mapaMU.remove(); mapaMU = null; }
  mapaMU = L.map("mapaMU", {zoomSnap:.25});
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom:18, attribution:"Imagem © Esri, Maxar"}).addTo(mapaMU);
  L.control.scale({imperial:false}).addTo(mapaMU);
  const f = GEO?.features.find(x => x.properties.nome_uc === MU.nome);
  MU.lim = f ? L.geoJSON(f, {style:{color:"#8be06b", weight:2, fillColor:"#6fd34a", fillOpacity:.12}, interactive:false}).addTo(mapaMU) : null;
  mapaMU.on("click", e => { if (MU.geo?.modo === "desenhar") return addVertice(e.latlng); if (!alvoMU || !MU.edit) return;
    $('#muEd [data-k="fc_lat"]').value = e.latlng.lat.toFixed(6); $('#muEd [data-k="fc_lon"]').value = e.latlng.lng.toFixed(6);
    $('#muEd [data-k="fc_lat"]').dispatchEvent(new Event("change")); marcarSujo(); alvoMU = false; $("#mapaMU").style.cursor = ""; });
  mapaMU.on("dblclick", e => { if (MU.geo?.modo === "desenhar"){ L.DomEvent.stop(e); concluirTrecho(); } });
  mapaMU.on("mousemove", e => { if (MU.geo?.modo === "desenhar") elastico(e.latlng); });
  const vias = MU.blocos.filter(b => b.modo === "linhas").flatMap(b => Object.entries(b.subtipos));
  const tipos = [...new Map(MU.blocos.filter(b => b.modo === "fichas" && b.coord).flatMap(b => (b.subtipos ? Object.keys(b.subtipos).filter(s => temCoord(b, s)) : [null])
    .map(s => { const ic = b.icone({tipo: s}); return [ic, ICONES_ROTULO[ic] || ic]; }))).entries()];
  $("#legMU").innerHTML = vias.map(([t, rot]) => `<span style="white-space:nowrap;margin-right:10px;display:inline-block;margin-bottom:3px"><span class="mu-traco" style="--c:${COR_VIA[t]}"></span>${esc(rot)}</span>`).join("")
    + (vias.length ? `<span style="white-space:nowrap;margin-right:10px;display:inline-block"><span class="mu-traco tr" style="--c:#fff"></span>tracejado: só início e fim</span>` : "")
    + tipos.map(([t, rot]) => `<span style="white-space:nowrap;margin-right:10px;display:inline-block;margin-bottom:3px">${iconeLegenda(t)}${esc(rot)}</span>`).join("")
    + `<span style="white-space:nowrap">· verde: limite da UC</span>`;
  pintarMU(null, true);
}
function pintarMU(prov = null, enquadrar = false){
  if (!mapaMU) return;
  if (camadaMU) mapaMU.removeLayer(camadaMU);
  const sit = s => s === "inoperante" ? "inoperante" : s === "ruim" ? "parcial" : null;
  const itens = pontosMU().map(({b, r}) => {
    const sel = MU.edit && MU.edit.r.id === r.id && MU.edit.b === b;
    return L.marker([r.lat, r.lon], {icon: iconeMapa(b.icone(r), {sel, situacao: sit(b.situacao?.(r))}), zIndexOffset: sel ? 1000 : 0})
      .bindTooltip(esc(b.titulo(r))).on("click", () => { if (!MU.geo?.modo) editarFicha(b, r); });
  });
  MU.blocos.filter(b => b.modo === "linhas").forEach(b => regsBloco(b).forEach(r => {
    if (!r.geojson || (MU.edit && MU.edit.b === b && MU.edit.r.id === r.id)) return;
    const ll = geoDeJson(r.geojson), ap = r.tracado_origem === "pontos";
    itens.push(L.polyline(ll, {color:"#000", weight:6, opacity:.45, interactive:false}),
      L.polyline(ll, {color: COR_VIA[r.tipo], weight:3.5, dashArray: ap ? "7 7" : null}).bindTooltip(esc(b.titulo(r)) + (ap ? " (aproximado)" : ""), {sticky:true}).on("click", () => { if (!MU.geo?.modo) editarFicha(b, r); }));
  }));
  if (prov && MU.edit) itens.push(L.marker([prov.lat, prov.lon], {icon: iconeMapa(MU.edit.b.icone(MU.edit.r), {sel:true}), zIndexOffset:2000}));
  camadaMU = L.featureGroup(itens).addTo(mapaMU);
  if (enquadrar){
    const bb = MU.lim ? L.latLngBounds(MU.lim.getBounds().getSouthWest(), MU.lim.getBounds().getNorthEast()) : null;
    if (bb){ const perto = bb.pad(2); itens.forEach(m => { const g = m.getLatLng ? L.latLngBounds([m.getLatLng()]) : m.getBounds(); if (perto.intersects(g)) bb.extend(g); }); mapaMU.fitBounds(bb, {padding:[20,20]}); }
    else if (itens.length) mapaMU.fitBounds(camadaMU.getBounds(), {padding:[20,20], maxZoom:14}); else mapaMU.fitBounds([[-22.95,-51.1],[-14.2,-39.8]]);
  }
}

/* ---------- modo tabela ---------- */
function tabelaBloco(b){
  const el = $(`[data-bloco="${b.id}"] .mu-corpo`), ed = MU.ed, dis = ed ? "" : "disabled";
  const orig = regsBloco(b); let rows = orig.map(r => ({...r}));
  const grupos = b.grupos ? Object.entries(b.grupos.valores) : [[null, null]];
  const tmpl = b.cols.map(c => c.w || "1fr").join(" ") + (ed ? " 32px" : "");
  const cel = (c, v, i, g) => {
    if (c.opcoes) return `<select data-i="${i}" data-k="${c.k}" aria-label="${c.rot}" ${dis}><option value=""></option>${c.opcoes.map(([o, t]) => `<option value="${o}" ${String(v) === o ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    const lista = c.listaGrupo ? `dl-${b.id}-${g}` : c.lista ? `dl-${b.id}-${c.k}` : "";
    return `<input data-i="${i}" data-k="${c.k}" ${c.num ? 'type="number" min="0"' : ""} ${lista ? `list="${lista}"` : ""} value="${esc(v ?? "")}" placeholder="${esc(c.rot)}" aria-label="${esc(c.rot)}" ${dis}>`;
  };
  const listas = () => b.cols.map(c => c.lista ? `<datalist id="dl-${b.id}-${c.k}">${c.lista.map(o => `<option value="${esc(o)}">`).join("")}</datalist>`
      : c.listaGrupo ? Object.entries(c.listaGrupo).map(([g, L]) => `<datalist id="dl-${b.id}-${g}">${L.map(o => `<option value="${esc(o)}">`).join("")}</datalist>`).join("") : "").join("");
  const desenhar = () => {
    el.innerHTML = listas() + (rows.length ? "" : `<div class="dica" style="margin-bottom:6px">Nenhum registro. ${npHtml(b.np, 0)}${(MU.inf.nao_possui || []).includes(b.np) ? " — a UC declarou não possuir." : ""}</div>`)
      + grupos.map(([g, rot]) => {
        const L = rows.map((r, i) => [r, i]).filter(([r]) => !g || r[b.grupos.col] === g);
        if (b.cols.some(c => c.k === "detentor")) L.sort((x, y) => (x[0].detentor || "").localeCompare(y[0].detentor || "", "pt") || x[1] - y[1]);
        const varios = new Set(L.map(([r]) => r.detentor || "")).size > 1; let ult = null;
        return `${rot ? `<h4 class="mu-g">${esc(rot)} <span class="dica">(${L.length})</span></h4>` : ""}<div class="rep mu-tab">
          ${L.length ? `<div class="lin cab" style="grid-template-columns:${tmpl}">${b.cols.map(c => `<span>${esc(c.rot)}</span>`).join("")}${ed ? "<span></span>" : ""}</div>` : ""}
          ${L.map(([r, i]) => (varios && (r.detentor || "") !== ult ? `<div class="mu-det">${esc((ult = r.detentor || "") || "Da UC")}</div>` : "") + `<div class="lin" style="grid-template-columns:${tmpl}">${b.cols.map(c => cel(c, r[c.k], i, g)).join("")}${ed ? `<button class="btn peq perigo" type="button" data-rm="${i}" title="Remover">×</button>` : ""}</div>`).join("")}
          ${ed ? `<div><button class="btn peq" type="button" data-add="${g || ""}">+ adicionar</button></div>` : ""}</div>`;
      }).join("")
      + (ed ? `<div class="mu-acoes"><button class="btn primario peq" type="button" data-salvar>Salvar ${esc(b.t.toLowerCase())}</button>
          ${b.padrao ? `<button class="btn peq" type="button" data-padrao title="Acrescenta os itens usuais que ainda não estão na lista, para preencher a quantidade">Incluir itens usuais</button>` : ""}
          <span class="dica" data-estado></span></div>` : "");
    $$("[data-k]", el).forEach(x => x.oninput = x.onchange = () => { rows[+x.dataset.i][x.dataset.k] = x.value; rows[+x.dataset.i]._mexido = true; marcarSujo(); $("[data-estado]", el).textContent = "Alterações não salvas"; });
    $$("[data-rm]", el).forEach(x => x.onclick = () => { rows.splice(+x.dataset.rm, 1); desenhar(); marcarSujo(); $("[data-estado]", el).textContent = "Alterações não salvas"; });
    $$("[data-add]", el).forEach(x => x.onclick = () => {
      rows.push({...(b.fixo || {}), ...(b.grupos ? {[b.grupos.col]: x.dataset.add} : {})}); desenhar(); marcarSujo();
      const i = rows.length - 1; $(`[data-i="${i}"]`, el)?.focus(); });
    $("[data-padrao]", el)?.addEventListener("click", () => {
      let n = 0;
      for (const [g, L] of Object.entries(b.padrao)) for (const nome of L)
        if (!rows.some(r => r[b.grupos.col] === g && (r.nome || "").toLowerCase() === nome.toLowerCase())){ rows.push({[b.grupos.col]: g, nome, _padrao: true}); n++; }
      desenhar(); msg(n ? `${n} itens acrescentados — preencha as quantidades e salve (os que ficarem sem quantidade não são gravados).` : "Todos os itens usuais já estão na lista.");
    });
    $("[data-salvar]", el)?.addEventListener("click", salvar);
    ligarNP(el);
  };
  async function salvar(){
    const norm = r => Object.fromEntries(b.cols.map(c => [c.k, normVal(c, r[c.k])]));
    const util = rows.filter(r => { const n = norm(r); return b.cols.some(c => n[c.k] != null) && !(r._padrao && n.quantidade == null && !r._mexido) && !(r._padrao && n.quantidade == null); });
    for (const r of util){ const n = norm(r);
      for (const c of b.cols){ if (Number.isNaN(n[c.k])) return msg(`Confira “${c.rot}”.`, "erro"); if (c.obrig && n[c.k] == null) return msg(`Preencha “${c.rot}” em todas as linhas (ou remova a linha).`, "erro"); } }
    const del = orig.filter(o => !util.some(r => r.id === o.id)).map(o => o.id);
    const upd = util.filter(r => r.id).filter(r => { const o = orig.find(x => x.id === r.id); return JSON.stringify(norm(r)) !== JSON.stringify(norm(o)) || (b.grupos && r[b.grupos.col] !== o[b.grupos.col]); });
    const ins = util.filter(r => !r.id).map(r => ({nome_uc: MU.nome, ...(b.fixo || {}), ...(b.grupos ? {[b.grupos.col]: r[b.grupos.col]} : {}), ...norm(r)}));
    if (!del.length && !upd.length && !ins.length){ sujo = false; return msg("Nada a salvar."); }
    if (del.length && !confirm(`${del.length} linha(s) serão excluídas. Continuar?`)) return;
    if (del.length){ const {error} = await sb.from(b.tab).delete().in("id", del); if (error) return msg(error.message, "erro"); }
    for (const r of upd){ const {error} = await sb.from(b.tab).update(norm(r)).eq("id", r.id); if (error) return msg(error.message, "erro"); }
    if (ins.length){ const {error} = await sb.from(b.tab).insert(ins); if (error) return msg(error.message, "erro"); await tirarNP([b.np]); }
    sujo = false; msg(`Salvo: ${ins.length} incluído(s), ${upd.length} alterado(s), ${del.length} excluído(s).`); abrirModuloUC(MU.id, MU.nome);
  }
  desenhar();
}

/* ---------- modo infra (campos da UC) ---------- */
function infraBloco(b){
  const el = $(`[data-bloco="${b.id}"] .mu-corpo`), ed = MU.ed, dis = ed ? "" : "disabled", leitores = {};
  el.innerHTML = b.campos.map(c => c.rep ? `<div class="rep" data-rep="${c.k}"></div>` : `<div><label>${esc(c.rot)}</label><textarea data-c="${c.k}" ${dis}>${esc(MU.inf[c.k] || "")}</textarea></div>`).join("")
    + (ed ? `<div class="mu-acoes"><button class="btn primario peq" type="button" data-salvar>Salvar</button></div>` : "");
  b.campos.filter(c => c.rep).forEach(c => leitores[c.k] = repetidor($(`[data-rep="${c.k}"]`, el), (MU.inf[c.k] || []).map(x => ({...x})), c.rep, ed, Object.fromEntries(c.rep.map(x => [x.k, ""]))));
  $$("[data-c]", el).forEach(x => x.addEventListener("input", marcarSujo));
  $("[data-salvar]", el)?.addEventListener("click", async () => {
    const o = {}; b.campos.forEach(c => o[c.k] = c.rep ? leitores[c.k]() : txt($(`[data-c="${c.k}"]`, el).value));
    const {error} = await salvarInfra(o);
    if (error) return msg("Não foi possível salvar: " + error.message, "erro");
    sujo = false; msg("Salvo."); abrirModuloUC(MU.id, MU.nome);
  });
}

/* ---------- traçados (modo linhas): desenho, ajuste de vértices, arquivo, linha reta ---------- */
const COR_VIA = {aceiro:"#ff9f1c", estrada:"#ffe066", trilha:"#5ce1e6"};
const geoDeJson = g => !g ? [] : g.type === "LineString" ? [g.coordinates.map(([x, y]) => [y, x])]
  : g.type === "MultiLineString" ? g.coordinates.map(p => p.map(([x, y]) => [y, x])) : [];
function jsonDeGeo(partes){
  const P = partes.filter(p => p.length >= 2).map(p => p.map(([la, lo]) => [+(+lo).toFixed(6), +(+la).toFixed(6)]));
  return !P.length ? null : P.length === 1 ? {type:"LineString", coordinates:P[0]} : {type:"MultiLineString", coordinates:P};
}
const R_T = 6371008.8, rad = x => x * Math.PI / 180;
function dist(a, b){ const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2; return 2 * R_T * Math.asin(Math.sqrt(h)); }
const comprimento = partes => partes.reduce((s, p) => s + p.slice(1).reduce((t, q, i) => t + dist(p[i], q), 0), 0);
// Douglas-Peucker com tolerância em metros: trilhas de GPS ficam leves sem perder a forma
function simplificar(p, tol = 2){
  if (p.length < 3) return p;
  const c0 = Math.cos(rad(p[0][0])), xy = p.map(([la, lo]) => [rad(lo) * c0 * R_T, rad(la) * R_T]);
  const fica = new Uint8Array(p.length); fica[0] = fica[p.length - 1] = 1;
  const pilha = [[0, p.length - 1]];
  while (pilha.length){
    const [a, b] = pilha.pop(), [x1, y1] = xy[a], [x2, y2] = xy[b], dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
    let dm = 0, im = -1;
    for (let i = a + 1; i < b; i++){ const [x, y] = xy[i]; const t = L2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2)) : 0;
      const d = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)); if (d > dm){ dm = d; im = i; } }
    if (dm > tol){ fica[im] = 1; pilha.push([a, im], [im, b]); }
  }
  return p.filter((_, i) => fica[i]);
}

function htmlGeo(ed){
  return `<div class="mu-geo" id="muGeo"><div class="mu-geo-info" id="geoInfo"></div>
    ${ed ? `<div class="mu-acoes" id="geoBotoes" style="margin-top:8px">
        <button class="btn peq" type="button" data-g="desenhar">Desenhar trecho no mapa</button>
        <button class="btn peq" type="button" data-g="editar">Ajustar vértices</button>
        <button class="btn peq" type="button" data-g="importar">Importar arquivo…</button>
        <button class="btn peq perigo" type="button" data-g="apagar">Apagar traçado</button>
        <input type="file" id="geoArq" accept=".kml,.kmz,.gpx,.geojson,.json" hidden></div>
      <div class="mu-geo-barra" id="geoBarra" hidden></div>
      <details class="utm"><summary>Só tenho as coordenadas de início e fim</summary>
        <div class="grade" style="margin-top:6px">
          <div><label>Início — latitude</label><input data-gi="ini_lat" placeholder="-17.9741 ou 17°58'26&quot;S"></div><div><label>Início — longitude</label><input data-gi="ini_lon" placeholder="-43.1634 ou 43°09'48&quot;O"></div>
          <div><label>Fim — latitude</label><input data-gi="fim_lat"></div><div><label>Fim — longitude</label><input data-gi="fim_lon"></div></div>
        <button class="btn peq" type="button" data-g="reta" style="margin-top:6px">Traçar linha reta (aproximada)</button></details>` : ""}</div>`;
}
function ligarGeo(r, ed){
  MU.geo = {r, partes: geoDeJson(r.geojson), origem: r.tracado_origem || null, mudou:false, modo:null, novo:[], camada:null};
  infoGeo(); desenharGeo();
  if (!ed) return;
  $$("#geoBotoes [data-g], #muGeo details [data-g]").forEach(x => x.onclick = () => acaoGeo(x.dataset.g));
  $("#geoArq").onchange = async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try{
      const feats = await lerArquivoLinhas(f);
      if (!feats.length) return msg("Nenhuma linha encontrada no arquivo.", "erro");
      if (MU.geo.partes.length && !confirm("Substituir o traçado atual pelo do arquivo?")) return;
      MU.geo.partes = feats.flatMap(x => x.partes); MU.geo.origem = "arquivo"; mudouGeo(); enquadrarGeo();
      msg(`${MU.geo.partes.length} trecho(s) lido(s) de ${f.name}. Confira no mapa e salve.`);
    }catch(err){ msg(err.message, "erro"); }
  };
}
function acaoGeo(a){
  const G = MU.geo; if (!G) return;
  if (a === "desenhar"){
    if (!mapaMU) return;
    if (G.origem === "pontos" && G.partes.length && confirm("O traçado atual é só a linha reta entre início e fim. Apagá-lo antes de desenhar o traçado real?")){ G.partes = []; mudouGeo(); }
    G.modo = "desenhar"; G.novo = []; mapaMU.doubleClickZoom.disable(); $("#mapaMU").style.cursor = "crosshair";
    barraGeo(); desenharGeo(); $("#mapaMU").scrollIntoView({behavior:"smooth", block:"nearest"});
  } else if (a === "editar"){
    if (!G.partes.length) return msg("Ainda não há traçado para ajustar.", "erro");
    if (G.partes.reduce((s, p) => s + p.length, 0) > 1500) return msg("Traçado com vértices demais para ajuste manual. Corrija no programa de origem e importe de novo.", "erro");
    G.modo = "editar"; barraGeo(); desenharGeo();
  } else if (a === "importar") $("#geoArq").click();
  else if (a === "apagar"){ if (!G.partes.length || !confirm("Apagar todo o traçado deste registro?")) return; G.partes = []; G.modo = null; barraGeo(); mudouGeo(); }
  else if (a === "reta"){
    const c = ["ini_lat","ini_lon","fim_lat","fim_lon"].map(k => lerCoord($(`#muGeo [data-gi="${k}"]`).value));
    if (c.some(x => x == null || Number.isNaN(x))) return msg("Informe as quatro coordenadas (decimal ou graus-minutos-segundos).", "erro");
    if (!dentroMG(c[0], c[1]) || !dentroMG(c[2], c[3])) return msg("Coordenada fora de Minas Gerais.", "erro");
    if (G.partes.length && !confirm("Substituir o traçado atual pela linha reta?")) return;
    G.partes = [[[c[0], c[1]], [c[2], c[3]]]]; G.origem = "pontos"; mudouGeo(); enquadrarGeo();
  } else if (a === "concluir") concluirTrecho();
  else if (a === "desfazer"){ G.novo.pop(); desenharGeo(); barraGeo(); }
  else if (a === "cancelar"){ G.novo = []; G.modo = null; fimDesenho(); }
  else if (a === "pronto"){ G.modo = null; barraGeo(); desenharGeo(); }
}
function addVertice(ll){ MU.geo.novo.push([ll.lat, ll.lng]); desenharGeo(); barraGeo(); }
function concluirTrecho(){
  const G = MU.geo; if (!G || G.modo !== "desenhar") return;
  if (G.novo.length >= 2){ G.partes.push(G.novo); G.origem = "desenho"; G.mudou = true; marcarSujo(); }
  else if (G.novo.length) msg("Um trecho precisa de pelo menos dois pontos.", "erro");
  G.novo = []; G.modo = null; fimDesenho(); infoGeo();
}
function fimDesenho(){ if (mapaMU){ mapaMU.doubleClickZoom.enable(); $("#mapaMU").style.cursor = ""; } barraGeo(); desenharGeo(); }
function elastico(ll){ const G = MU.geo; if (G?.elas && G.novo.length) G.elas.setLatLngs([G.novo.at(-1), ll]); }
function barraGeo(){
  const G = MU.geo, el = $("#geoBarra"); if (!el || !G) return;
  el.hidden = !G.modo;
  el.innerHTML = G.modo === "desenhar"
    ? `<span>Clique no mapa para marcar os pontos do trecho <b>(${G.novo.length})</b>. Duplo clique ou “Concluir” termina o trecho.</span>
       <button class="btn primario peq" type="button" data-g="concluir">Concluir trecho</button>
       <button class="btn peq" type="button" data-g="desfazer" ${G.novo.length ? "" : "disabled"}>Desfazer ponto</button>
       <button class="btn peq" type="button" data-g="cancelar">Cancelar</button>`
    : G.modo === "editar" ? `<span>Arraste os vértices; clique num vértice para removê-lo; arraste os pontos menores (no meio dos segmentos) para criar vértices.</span>
       <button class="btn primario peq" type="button" data-g="pronto">Pronto</button>` : "";
  $$("[data-g]", el).forEach(x => x.onclick = () => acaoGeo(x.dataset.g));
  $$("#geoBotoes [data-g]").forEach(x => x.disabled = !!G.modo);
}
function mudouGeo(){ MU.geo.mudou = true; marcarSujo(); infoGeo(); desenharGeo(); }
function infoGeo(){
  const G = MU.geo, el = $("#geoInfo"); if (!el || !G) return;
  const n = G.partes.length, v = G.partes.reduce((s, p) => s + p.length, 0);
  el.innerHTML = !n ? `<b>Sem traçado.</b> ${MU.ed ? "Desenhe no mapa, importe um arquivo ou informe o início e o fim." : ""}`
    : `<b>Traçado:</b> ${n > 1 ? n + " trechos · " : ""}${fmtM(comprimento(G.partes))} medidos no mapa · ${v} vértices`
      + (G.origem === "pontos" ? ` · <span class="mu-aprox">aproximado — só a linha reta entre início e fim</span>` : G.origem === "arquivo" ? " · importado de arquivo" : G.origem === "desenho" ? " · desenhado no mapa" : "")
      + (G.mudou ? ` · <b class="mu-aprox">não salvo</b>` : "");
}
function desenharGeo(){
  const G = MU.geo; if (!mapaMU || !G) return;
  if (G.camada) mapaMU.removeLayer(G.camada);
  const cor = COR_VIA[G.r.tipo] || "#ff9f1c", ls = [];
  G.partes.forEach((p, ip) => {
    const casca = L.polyline(p, {color:"#000", weight:9, opacity:.5, interactive:false}), lin = L.polyline(p, {color:cor, weight:5, dashArray: G.origem === "pontos" ? "9 7" : null, interactive:false});
    ls.push(casca, lin);
    if (G.modo !== "editar") return;
    const redesenhar = () => { casca.setLatLngs(p); lin.setLatLngs(p); };
    p.forEach((v, iv) => {
      const mk = L.marker(v, {draggable:true, icon: L.divIcon({className:"mu-vert", iconSize:[14, 14]}), zIndexOffset:3000, title:"Arraste; clique para remover"});
      mk.on("drag", e => { p[iv] = [e.latlng.lat, e.latlng.lng]; redesenhar(); });
      mk.on("dragend", () => { G.origem = "desenho"; mudouGeo(); });
      mk.on("click", () => {
        if (p.length <= 2){ if (!confirm("Remover este trecho inteiro?")) return; G.partes.splice(ip, 1); if (!G.partes.length) G.modo = null; barraGeo(); }
        else p.splice(iv, 1);
        G.origem = "desenho"; mudouGeo(); });
      ls.push(mk);
    });
    p.slice(1).forEach((v, k) => {
      const a = p[k], meio = [(a[0] + v[0]) / 2, (a[1] + v[1]) / 2];
      const mk = L.marker(meio, {draggable:true, icon: L.divIcon({className:"mu-vert meio", iconSize:[10, 10]}), zIndexOffset:2500, title:"Arraste para criar um vértice"});
      mk.on("dragstart", () => p.splice(k + 1, 0, meio.slice()));
      mk.on("drag", e => { p[k + 1] = [e.latlng.lat, e.latlng.lng]; redesenhar(); });
      mk.on("dragend", () => { G.origem = "desenho"; mudouGeo(); });
      ls.push(mk);
    });
  });
  G.elas = null;
  if (G.modo === "desenhar"){
    ls.push(L.polyline(G.novo, {color:"#000", weight:8, opacity:.5, interactive:false}), L.polyline(G.novo, {color:cor, weight:4, interactive:false}));
    G.novo.forEach(v => ls.push(L.circleMarker(v, {radius:4, color:"#111", weight:2, fillColor:"#fff", fillOpacity:1, interactive:false})));
    G.elas = L.polyline([], {color:cor, weight:2, dashArray:"4 5", interactive:false}); ls.push(G.elas);
  }
  G.camada = L.layerGroup(ls).addTo(mapaMU);
}
function enquadrarGeo(){ if (mapaMU && MU.geo?.partes.length) mapaMU.fitBounds(L.latLngBounds(MU.geo.partes.flat()), {padding:[30, 30], maxZoom:16}); }
function pararGeo(){
  const G = MU?.geo; if (!G) return;
  if (G.camada && mapaMU) mapaMU.removeLayer(G.camada);
  if (mapaMU){ mapaMU.doubleClickZoom.enable(); $("#mapaMU").style.cursor = ""; }
  MU.geo = null;
}

/* ---------- leitura de arquivos de linhas ---------- */
async function lerArquivoLinhas(f){
  const nome = f.name.toLowerCase();
  if (f.size > 15e6) throw new Error("Arquivo grande demais (máximo de 15 MB).");
  const txt = nome.endsWith(".kmz") ? await kmlDoKmz(await f.arrayBuffer()) : await f.text();
  let feats;
  if (/\.(geo)?json$/.test(nome) || /^\s*\{/.test(txt)){
    try{ feats = linhasGeoJSON(JSON.parse(txt)); }catch(e){ throw new Error("GeoJSON inválido."); }
  } else {
    const xml = new DOMParser().parseFromString(txt, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("Arquivo não reconhecido. Use KML, KMZ, GPX ou GeoJSON.");
    feats = xml.documentElement.localName === "gpx" ? linhasGPX(xml) : linhasKML(xml);
  }
  feats = feats.map(x => ({nome: (x.nome || "").trim(), partes: x.partes.map(p => p.filter(v => isFinite(v[0]) && isFinite(v[1]))).filter(p => p.length >= 2).map(p => simplificar(p))}))
               .filter(x => x.partes.length);
  if (feats.some(x => x.partes.some(p => p.some(([la, lo]) => !dentroMG(la, lo)))))
    throw new Error("O arquivo tem linhas fora de Minas Gerais ou em outro sistema de coordenadas. Exporte em coordenadas geográficas (WGS 84 ou SIRGAS 2000).");
  return feats;
}
function linhasGeoJSON(g){
  const out = [], ll = a => a.map(([x, y]) => [y, x]);
  const nm = p => p ? (p.name || p.nome || p.Name || p.NOME || p.Nome || "") : "";
  const geo = (gm, nome) => { if (!gm) return; const c = gm.coordinates;
    if (gm.type === "LineString") out.push({nome, partes:[ll(c)]});
    else if (gm.type === "MultiLineString") out.push({nome, partes:c.map(ll)});
    else if (gm.type === "Polygon") out.push({nome, partes:[ll(c[0])]});
    else if (gm.type === "MultiPolygon") out.push({nome, partes:c.map(p => ll(p[0]))});
    else if (gm.type === "GeometryCollection") gm.geometries.forEach(x => geo(x, nome)); };
  (g.type === "FeatureCollection" ? g.features : g.type === "Feature" ? [g] : [{geometry:g}]).forEach(f => geo(f.geometry, String(nm(f.properties))));
  return out;
}
function linhasKML(x){
  const out = [], tags = (el, n) => [...el.getElementsByTagNameNS("*", n)];
  const coords = s => (s || "").trim().split(/\s+/).map(t => t.split(",").map(Number)).filter(a => a.length >= 2).map(([lo, la]) => [la, lo]);
  tags(x, "Placemark").forEach(pm => {
    const partes = [];
    tags(pm, "LineString").concat(tags(pm, "LinearRing")).forEach(l => partes.push(coords(tags(l, "coordinates")[0]?.textContent)));
    tags(pm, "Track").forEach(t => partes.push(tags(t, "coord").map(c => c.textContent.trim().split(/\s+/).map(Number)).map(([lo, la]) => [la, lo])));
    if (partes.length) out.push({nome: [...pm.children].find(c => c.localName === "name")?.textContent || "", partes});
  });
  return out;
}
function linhasGPX(x){
  const out = [], tags = (el, n) => [...el.getElementsByTagNameNS("*", n)], pt = e => [+e.getAttribute("lat"), +e.getAttribute("lon")];
  const nm = el => [...el.children].find(c => c.localName === "name")?.textContent || "";
  tags(x, "trk").forEach(t => out.push({nome: nm(t), partes: tags(t, "trkseg").map(sg => tags(sg, "trkpt").map(pt))}));
  tags(x, "rte").forEach(t => out.push({nome: nm(t), partes: [tags(t, "rtept").map(pt)]}));
  return out;
}
// KMZ = zip com um .kml dentro (lido sem biblioteca: diretório central + DecompressionStream)
async function kmlDoKmz(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf), td = new TextDecoder();
  let e = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50){ e = i; break; }
  if (e < 0) throw new Error("KMZ inválido.");
  let p = dv.getUint32(e + 16, true);
  for (let k = 0, n = dv.getUint16(e + 10, true); k < n; k++){
    const met = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), ln = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const nome = td.decode(u8.subarray(p + 46, p + 46 + ln));
    p += 46 + ln + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    if (!/\.kml$/i.test(nome)) continue;
    const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), dados = u8.slice(ini, ini + tam);
    if (met === 0) return td.decode(dados);
    if (met !== 8 || !window.DecompressionStream) throw new Error("Não foi possível abrir o KMZ neste navegador. Salve como KML e importe de novo.");
    return await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  throw new Error("O KMZ não contém um arquivo KML.");
}

// importação em lote: cada linha do arquivo vira um registro
async function importarLinhas(b, f){
  let feats;
  try{ feats = await lerArquivoLinhas(f); }catch(e){ return msg(e.message, "erro"); }
  if (!feats.length) return msg("Nenhuma linha encontrada no arquivo.", "erro");
  if (sujo && MU.edit && !confirm("Descartar as alterações do item aberto?")) return;
  sujo = false; pararGeo(); MU.edit = null; $$(".mu-editor").forEach(x => x.innerHTML = ""); listaFichas(b); pintarMU();
  const el = $(`[data-bloco="${b.id}"] .mu-editor`), sing = {aceiro:"Aceiro", estrada:"Estrada", trilha:"Trilha"};
  const adivinha = n => /estrada|rodovia|acesso/i.test(n) ? "estrada" : /trilha|caminho/i.test(n) ? "trilha" : "aceiro";
  el.innerHTML = `<div class="editor-pt" id="muEd">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>Importar ${feats.length} linha(s) de ${esc(f.name)}</b><button class="btn peq" type="button" id="muFechar">Cancelar</button></div>
    <p class="dica" style="margin:6px 0">Confira o nome e o tipo de cada linha (em azul tracejado no mapa). Depois, abra cada uma para completar largura, condição e manutenção.</p>
    <div class="rep">${feats.map((x, i) => `<div class="lin" style="grid-template-columns:24px minmax(0,2fr) minmax(90px,.8fr) 74px">
      <input type="checkbox" data-ii="${i}" checked aria-label="Importar esta linha" style="width:auto">
      <input data-in="${i}" value="${esc(x.nome || `Linha ${i + 1}`)}" aria-label="Nome">
      <select data-it="${i}" aria-label="Tipo">${Object.keys(b.subtipos).map(k => `<option value="${k}" ${adivinha(x.nome) === k ? "selected" : ""}>${sing[k] || k}</option>`).join("")}</select>
      <span class="dica" style="align-self:center;text-align:right">${fmtM(comprimento(x.partes))}</span></div>`).join("")}</div>
    <div class="mu-acoes"><button class="btn primario peq" type="button" id="muImp">Incluir as selecionadas</button></div></div>`;
  const prev = mapaMU ? L.featureGroup(feats.map(x => L.polyline(x.partes, {color:"#1c7ed6", weight:4, dashArray:"6 5"}))).addTo(mapaMU) : null;
  if (prev) mapaMU.fitBounds(prev.getBounds(), {padding:[30, 30]});
  const fechar = () => { if (prev) mapaMU.removeLayer(prev); el.innerHTML = ""; };
  $("#muFechar").onclick = fechar;
  $("#muImp").onclick = async () => {
    const rows = feats.map((x, i) => [x, i]).filter(([, i]) => $(`[data-ii="${i}"]`, el).checked).map(([x, i]) => ({nome_uc: MU.nome, tipo: $(`[data-it="${i}"]`, el).value,
      nome: $(`[data-in="${i}"]`, el).value.trim() || `Linha ${i + 1}`, geojson: jsonDeGeo(x.partes), tracado_origem:"arquivo"}));
    if (!rows.length) return msg("Nenhuma linha selecionada.", "erro");
    const {error} = await sb.from(b.tab).insert(rows);
    if (error) return msg("Não foi possível importar: " + error.message, "erro");
    await tirarNP([...new Set(rows.map(r => npKey(b, r.tipo)))]);
    fechar(); msg(`${rows.length} linha(s) incluída(s). Abra cada uma para completar os dados.`); abrirModuloUC(MU.id, MU.nome);
  };
  el.scrollIntoView({behavior:"smooth", block:"nearest"});
}
function baixarKML(b, regs){
  const x = s => String(s ?? "").replace(/[<&>]/g, c => ({"<":"&lt;", "&":"&amp;", ">":"&gt;"})[c]);
  const abgr = h => "ff" + h.slice(5, 7) + h.slice(3, 5) + h.slice(1, 3);
  const pm = regs.filter(r => r.geojson).map(r => {
    const P = geoDeJson(r.geojson), ls = P.map(p => `<LineString><tessellate>1</tessellate><coordinates>${p.map(([la, lo]) => `${lo},${la},0`).join(" ")}</coordinates></LineString>`).join("");
    return `<Placemark><name>${x(r.nome)}</name><styleUrl>#${r.tipo}</styleUrl><description>${x([b.subtipos[r.tipo], b.resumo(r), r.tracado_origem === "pontos" ? "traçado aproximado (início–fim)" : ""].filter(Boolean).join(" · "))}</description>${P.length > 1 ? `<MultiGeometry>${ls}</MultiGeometry>` : ls}</Placemark>`;
  }).join("\n");
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(MU.nome)} — aceiros, estradas e trilhas</name>\n`
    + Object.entries(COR_VIA).map(([t, c]) => `<Style id="${t}"><LineStyle><color>${abgr(c)}</color><width>4</width></LineStyle></Style>`).join("") + `\n${pm}\n</Document></kml>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([kml], {type:"application/vnd.google-earth.kml+xml"})); a.download = `${MU.nome} - aceiros, estradas e trilhas.kml`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* ---------- cronograma (gráfico de meses, com os meses críticos da UC) ---------- */
function gantt(regs){
  const anos = [...new Set(regs.map(r => r.ano))].sort((a, b) => b - a); if (!anos.length) return "";
  const ano = anos.includes(MU.anoG) ? MU.anoG : anos[0], L = regs.filter(r => r.ano === ano);
  const crit = new Set(MU.cad?.meses_criticos || []), h = new Date(), mAt = h.getFullYear() === ano ? h.getMonth() + 1 : 0;
  const em = (r, m) => { const a = r.mes_ini, f = r.mes_fim || r.mes_ini; return m >= 1 && m <= 12 && !!a && (a <= f ? m >= a && m <= f : m >= a || m <= f); };
  const cats = [...new Set(L.map(r => CAT_ACAO[r.categoria] ? r.categoria : "Outra"))];
  return `<div class="gantt"><div class="gantt-top"><b>Cronograma ${anos.length > 1 ? `<select data-ano-g aria-label="Ano do cronograma">${anos.map(a => `<option ${a === ano ? "selected" : ""}>${a}</option>`).join("")}</select>` : ano}</b>
      <span class="dica">${L.length} ações · ${L.filter(r => r.situacao === "realizada").length} realizadas${crit.size ? " · em laranja, os meses críticos da UC" : ""}</span></div>
    <div class="g-rolagem"><div class="g-lin g-cab"><span></span>${MESES_OP.map(([m, t]) => `<span class="${crit.has(+m) ? "crit" : ""} ${+m === mAt ? "hoje" : ""}" ${crit.has(+m) ? 'title="Mês crítico da UC"' : ""}>${t[0]}<i>${t.slice(1)}</i></span>`).join("")}</div>
    ${L.map(r => { const c = CAT_ACAO[r.categoria] || CAT_ACAO.Outra, ok = r.situacao === "realizada", nao = r.situacao === "nao_realizada";
      return `<div class="g-lin" data-gid="${r.id}" title="${esc([r.nome, r.periodo || mesesTxt(r), r.local, SIT_ACAO.find(s => s[0] === r.situacao)?.[1]].filter(Boolean).join(" · "))}">
        <span class="g-nome">${ok ? "✓ " : ""}${esc(r.nome)}</span>${r.mes_ini ? MESES_OP.map(([m]) => { m = +m; const on = em(r, m);
          return `<span class="g-c ${crit.has(m) ? "crit" : ""}">${on ? `<b class="${em(r, m - 1) ? "" : "i"} ${em(r, m + 1) ? "" : "f"}" style="--c:${nao ? "#adb5bd" : c};${ok || nao ? "" : "opacity:.85"}"></b>` : ""}</span>`; }).join("")
          : `<span class="g-sem">${esc(r.periodo || "sem mês definido")}</span>`}</div>`; }).join("")}</div>
    <div class="g-leg">${cats.map(k => `<span style="--c:${CAT_ACAO[k]}">${esc(k)}</span>`).join("")}</div></div>`;
}

/* ---------- estilos do módulo 5 ---------- */
document.head.insertAdjacentHTML("beforeend", `<style>
  .mu-traco{display:inline-block;width:22px;height:0;border-top:4px solid var(--c);box-shadow:0 0 0 1px rgba(0,0,0,.4);vertical-align:middle;margin-right:6px;border-radius:2px;flex:none}
  .mu-traco.tr{border-top:3px dashed #555;box-shadow:none}
  .mu-geo{margin-top:10px;padding:10px;border:1px dashed #c9cdb8;border-radius:8px;background:#fafbf6}
  .mu-geo-info{font-size:13px} .mu-aprox{color:#8a5a00}
  .mu-geo-barra{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;padding:8px 10px;background:#fff4cc;border-radius:6px;font-size:12.5px}
  .mu-geo-barra span{flex:1 1 220px}
  .mu-vert{background:#fff;border:2.5px solid #111;border-radius:50%;box-shadow:0 0 0 1.5px #fff;cursor:move}
  .mu-vert.meio{background:rgba(255,255,255,.75);border:1.5px solid #333}
  .pt .d i{font-style:normal;color:#8a5a00}
  .gantt{border:1px solid var(--linha);border-radius:10px;padding:10px 12px;margin-bottom:12px}
  .gantt-top{display:flex;justify-content:space-between;gap:6px 12px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
  .gantt-top select{width:auto;padding:2px 6px;font-weight:700}
  .g-rolagem{overflow-x:auto}
  .g-lin{display:grid;grid-template-columns:minmax(190px,3.6fr) repeat(12,minmax(24px,1fr));align-items:stretch;min-width:640px;cursor:pointer;border-radius:4px}
  .g-lin:not(.g-cab):hover{background:#f1f5e6}
  .g-cab{cursor:default;font-size:11.5px;font-weight:700;color:var(--suave);text-align:center}
  .g-cab span{padding:3px 0} .g-cab span.crit{background:#fde3d3;color:#b4400a;border-radius:5px 5px 0 0} .g-cab span.hoje{text-decoration:underline 2px}
  .g-cab i{font-style:normal} @media (max-width:760px){ .g-cab i{display:none} }
  .g-nome{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:5px 8px 5px 2px}
  .g-c{position:relative;border-left:1px solid #eef0e6;min-height:28px} .g-c.crit{background:#fff4ed}
  .g-c b{position:absolute;top:8px;bottom:8px;left:0;right:0;background:var(--c)}
  .g-c b.i{left:3px;border-radius:5px 0 0 5px} .g-c b.f{right:3px;border-radius:0 5px 5px 0} .g-c b.i.f{border-radius:5px}
  .g-sem{grid-column:2/-1;font-size:12px;color:var(--suave);font-style:italic;padding:6px}
  .g-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--suave);margin-top:8px}
  .g-leg span::before{content:"";display:inline-block;width:14px;height:10px;border-radius:3px;background:var(--c);margin-right:5px;vertical-align:-1px}
</style>`);
})();
