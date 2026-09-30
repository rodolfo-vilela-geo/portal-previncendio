// Módulos 3 (Recursos e comunicação) e 4 (Rede de apoio) do Cadastro da UC.
// Motor genérico: cada módulo é uma lista de blocos (seções do PIPCIF) de três modos:
//   fichas  — registros com formulário próprio e, se houver, coordenada (aparecem no mapa do módulo);
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
  ]
};
window.MODULOS_UC = MODULOS;

// rótulos para o histórico
const NP_ROT = {veiculo:"Veículos", material:"Materiais", parceiro:"Parceiros", colaborador:"Colaboradores/moradores", brigadista:"Brigadistas voluntários"};
Object.values(MODULOS).flat().filter(b => b.subtipos).forEach(b => Object.entries(b.subtipos).forEach(([k, t]) => NP_ROT[b.np + k] = t.replace(/^7\.\d /, "")));
window.MU_NP = NP_ROT;
window.MU_REF = {repetidora:"Repetidora", fixo:"Rádio fixo", movel:"Rádio móvel", portatil:"Rádios portáteis", manual:"Ferramenta", especial:"Equipamento", epi:"EPI",
  alimentacao:"Alimentação", saude:"Saúde", abastecimento:"Abastecimento", outro:"Prestador", colaborador:"Colaborador", brigadista:"Brigadista voluntário"};
const ROT_NOVOS = {placa:"Placa", conservacao:"Conservação", disponivel:"Disponível", quantidade:"Quantidade", qtd_uso:"Em condição de uso", origem:"Origem",
  detentor:"Detentor", responsavel:"Responsável", contatos:"Contatos", municipio:"Município", apoios:"Apoios disponíveis", distancia:"Distância da UC",
  servicos:"Serviços", capacidade:"Capacidade", conveniado:"Conveniado", localizacao:"Localização", contato:"Contato", apoio:"Atividade/apoio",
  outros_contatos:"Outros contatos importantes", rede_obs:"Contatos com a vizinhança"};
for (const [k, v] of Object.entries(ROT_NOVOS)) if (!(k in ROTULOS)) ROTULOS[k] = v;

let MU = null, mapaMU = null, camadaMU = null, alvoMU = false;
const regsBloco = b => (MU.dados[b.tab] || []).filter(r => Object.entries(b.fixo || {}).every(([k, v]) => r[k] === v));
const npKey = (b, st) => st ? b.np + st : b.np;
const temCoord = (b, st) => b.coord === true || (Array.isArray(b.coord) && b.coord.includes(st));
const CAMPOS_INFRA = ["outros_contatos","rede_obs","nao_possui"];

window.abrirModuloUC = async function(id, nome){
  const blocos = MODULOS[id], ed = podeEditar(nome), box = $("#mod-conteudo");
  box.innerHTML = `<div class="dica" style="padding:20px">Carregando…</div>`;
  const tabs = [...new Set(blocos.filter(b => b.tab).map(b => b.tab))];
  const res = await Promise.all([
    sb.from("uc_infra").select("*").eq("nome_uc", nome).maybeSingle(),
    sb.from("auditoria").select("*").in("tabela", tabs.concat("uc_infra")).eq("chave", nome).order("quando", {ascending:false}).limit(150),
    ...tabs.map(t => sb.from(t).select("*").eq("nome_uc", nome).order("id"))]);
  const erro = res.find(r => r.error);
  if (erro) return box.innerHTML = `<div class="dica" style="color:var(--erro);padding:20px">${esc(erro.error.message)}</div>`;
  const keysMod = new Set(blocos.flatMap(b => b.np ? (b.subtipos ? Object.keys(b.subtipos).map(s => b.np + s) : [b.np]) : []));
  const hist = (res[1].data || []).filter(h => h.tabela !== "uc_infra" ||
    (h.campos || []).some(c => c !== "nao_possui" && CAMPOS_INFRA.includes(c) && blocos.some(b => b.modo === "infra" && b.campos.some(x => x.k === c))) ||
    ((h.campos || []).includes("nao_possui") && [...(h.antes?.nao_possui || []), ...(h.depois?.nao_possui || [])].some(k => keysMod.has(k))));
  MU = {id, nome, ed, blocos, inf: res[0].data || {nome_uc: nome, nao_possui: [], outros_contatos: []}, novoInf: !res[0].data,
        dados: Object.fromEntries(tabs.map((t, i) => [t, res[i + 2].data || []])), edit: null};
  const fichas = blocos.filter(b => b.modo === "fichas"), outros = blocos.filter(b => b.modo !== "fichas");
  const fs = b => `<fieldset data-bloco="${b.id}"><legend>${esc(b.s)} ${esc(b.t)}</legend>${b.dica ? `<p class="dica" style="margin:0 0 8px">${esc(b.dica)}</p>` : ""}<div class="mu-editor"></div><div class="mu-corpo"></div></fieldset>`;
  box.innerHTML = `
    ${fichas.length ? `<div class="infra-grade mu-grade"><div class="mu-mapa"><div id="mapaMU"></div><div class="dica" id="legMU" style="margin-top:4px"></div></div>
      <div>${ed ? `<p class="dica" style="margin:14px 0 0">Clique num item para ver ou editar. A coordenada pode ser digitada (decimal, graus-minutos-segundos ou UTM) ou marcada no mapa.</p>` : ""}${fichas.map(fs).join("")}</div></div>` : ""}
    ${outros.map(fs).join("")}
    <details class="historico"><summary>Histórico de alterações deste módulo (${hist.length})</summary>${htmlHistorico(hist)}</details>`;
  fichas.forEach(listaFichas);
  outros.forEach(b => b.modo === "tabela" ? tabelaBloco(b) : infraBloco(b));
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
  return `<div class="${cls}">${rot}<input data-c="${c.k}" ${c.num ? 'type="number" min="0"' : ""} ${c.lista ? `list="dl-mu-${c.k}"` : ""} value="${esc(v ?? "")}" ${dis}>${dl}</div>`;
}
const normVal = (c, v) => {
  if (v == null || String(v).trim() === "") return null;
  if (c.bool) return v === true || v === "true";
  if (c.num){ const n = Math.round(+String(v).replace(",", ".")); return isNaN(n) ? NaN : Math.max(0, n); }
  return String(v).trim();
};

/* ---------- modo fichas ---------- */
function listaFichas(b){
  const el = $(`[data-bloco="${b.id}"] .mu-corpo`), regs = regsBloco(b), np = new Set(MU.inf.nao_possui || []);
  const grupos = b.subtipos ? Object.entries(b.subtipos) : [[null, b.rotulo || b.t]];
  el.innerHTML = grupos.map(([st, rot]) => {
    const L = regs.filter(r => !st || r.tipo === st), key = npKey(b, st);
    return `<div class="tipo-bloco"><div class="th">${iconeLegenda(b.icone({tipo: st}), 22)}<span class="sp">${esc(rot)} <span class="dica">(${L.length})</span></span>
      ${npHtml(key, L.length)}${MU.ed ? `<button class="btn peq" type="button" data-add="${st || ""}">+ adicionar</button>` : ""}</div>
      ${L.map(r => { const s = b.situacao?.(r);
        return `<div class="pt ${MU.edit && MU.edit.r.id === r.id && MU.edit.b === b ? "sel" : ""}" data-id="${r.id}"><span><b>${esc(b.titulo(r))}</b></span>
        ${s ? `<span class="sit ${s === "bom" ? "operante" : s === "ruim" ? "parcial" : "inoperante"}">${esc({bom:"Bom", ruim:"Ruim", inoperante:"Inoperante"}[s])}</span>` : "<span></span>"}
        <span class="d">${esc(b.resumo(r) || "")}${temCoord(b, r.tipo) ? (r.lat != null ? "" : `${b.resumo(r) ? " · " : ""}sem coordenada`) : ""}</span></div>`; }).join("")}
      ${!L.length && np.has(key) ? `<div class="pt" style="cursor:default"><span class="d">A UC declarou não possuir.</span></div>` : ""}</div>`;
  }).join("");
  $$("[data-id]", el).forEach(x => x.onclick = () => editarFicha(b, regs.find(r => r.id === +x.dataset.id)));
  $$("[data-add]", el).forEach(x => x.onclick = () => editarFicha(b, {...(b.fixo || {}), ...(b.subtipos ? {tipo: x.dataset.add} : {}), quantidade: b.tab === "uc_radio" ? 1 : undefined, apoios: [], _novo: true}));
  ligarNP(el);
}

function editarFicha(b, r){
  if (sujo && MU.edit && !confirm("Descartar as alterações deste item?")) return;
  sujo = false; MU.edit = {b, r};
  $$(".mu-editor").forEach(e => e.innerHTML = "");
  const st = b.subtipos ? r.tipo : null, ed = MU.ed, dis = ed ? "" : "disabled";
  const campos = b.campos.filter(c => !c.so || c.so.includes(st)), coord = temCoord(b, st);
  const el = $(`[data-bloco="${b.id}"] .mu-editor`);
  el.innerHTML = `<div class="editor-pt" id="muEd">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${r._novo ? "Novo — " : ""}${esc(b.subtipos ? b.subtipos[st] : (b.rotulo || b.t))}</b><button class="btn peq" type="button" id="muFechar">Fechar</button></div>
    <div class="grade" style="margin-top:8px">${campos.map(c => campoHtml(c, r[c.k], dis)).join("")}</div>
    ${b.apoios ? `<div style="margin-top:10px"><label>Apoios disponíveis</label><div class="rep" id="muApoios"></div></div>` : ""}
    ${coord ? `<div style="margin-top:8px">${htmlCoord("fc", r.lat, r.lon, ed)}</div>` : ""}
    ${ed ? `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn primario peq" type="button" id="muSalvar">Salvar</button>${r._novo ? "" : `<button class="btn peq perigo" type="button" id="muExcluir">Excluir</button>`}</div>` : ""}
  </div>`;
  const lerApoios = b.apoios ? repetidor($("#muApoios"), (r.apoios || []).map(x => ({...x})),
    [{k:"tipo", rot:"Tipo de apoio", w:"minmax(0,1.6fr)"}, {k:"quantidade", rot:"Qtd.", w:"90px"}, {k:"obs", rot:"Observação", w:"minmax(0,1.6fr)"}], ed, {tipo:"", quantidade:"", obs:""}) : null;
  $$("#muEd [data-c]").forEach(x => x.addEventListener("input", marcarSujo));
  $("#muFechar").onclick = () => { if (sujo && !confirm("Descartar as alterações?")) return; sujo = false; MU.edit = null; el.innerHTML = ""; listaFichas(b); pintarMU(); };
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
    if (coord){
      const la = lerCoord($('#muEd [data-k="fc_lat"]').value), lo = lerCoord($('#muEd [data-k="fc_lon"]').value);
      if (Number.isNaN(la) || Number.isNaN(lo) || ((la === null) !== (lo === null))) return msg("Coordenada incompleta ou não reconhecida.", "erro");
      if (la !== null && !dentroMG(la, lo)) return msg("Coordenada fora de Minas Gerais.", "erro");
      o.lat = la === null ? null : +la.toFixed(6); o.lon = lo === null ? null : +lo.toFixed(6);
    }
    const {error} = r._novo ? await sb.from(b.tab).insert({nome_uc: MU.nome, ...(b.fixo || {}), ...(st ? {tipo: st} : {}), ...o}) : await sb.from(b.tab).update(o).eq("id", r.id);
    if (error) return msg("Não foi possível salvar: " + error.message, "erro");
    if (r._novo) await tirarNP([npKey(b, st)]);
    sujo = false; MU.edit = null; msg("Salvo."); abrirModuloUC(MU.id, MU.nome);
  });
  $("#muExcluir")?.addEventListener("click", async () => {
    if (!confirm(`Excluir “${b.titulo(r)}”? A exclusão fica registrada no histórico.`)) return;
    const {error} = await sb.from(b.tab).delete().eq("id", r.id);
    if (error) return msg(error.message, "erro");
    sujo = false; MU.edit = null; msg("Excluído."); abrirModuloUC(MU.id, MU.nome);
  });
  listaFichas(b);
  if (r.lat != null && mapaMU && !mapaMU.getBounds().contains([r.lat, r.lon])) mapaMU.setView([r.lat, r.lon], Math.max(mapaMU.getZoom(), 13));
  else if (r.lat != null) pintarMU();
  el.scrollIntoView({behavior:"smooth", block:"nearest"});
}

/* ---------- mapa do módulo ---------- */
function pontosMU(){
  return MU.blocos.filter(b => b.modo === "fichas").flatMap(b => regsBloco(b).filter(r => r.lat != null && temCoord(b, r.tipo)).map(r => ({b, r})));
}
function montarMapaMU(){
  if (mapaMU){ mapaMU.remove(); mapaMU = null; }
  mapaMU = L.map("mapaMU", {zoomSnap:.25});
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom:18, attribution:"Imagem © Esri, Maxar"}).addTo(mapaMU);
  L.control.scale({imperial:false}).addTo(mapaMU);
  const f = GEO?.features.find(x => x.properties.nome_uc === MU.nome);
  MU.lim = f ? L.geoJSON(f, {style:{color:"#8be06b", weight:2, fillColor:"#6fd34a", fillOpacity:.12}, interactive:false}).addTo(mapaMU) : null;
  mapaMU.on("click", e => { if (!alvoMU || !MU.edit) return;
    $('#muEd [data-k="fc_lat"]').value = e.latlng.lat.toFixed(6); $('#muEd [data-k="fc_lon"]').value = e.latlng.lng.toFixed(6);
    $('#muEd [data-k="fc_lat"]').dispatchEvent(new Event("change")); marcarSujo(); alvoMU = false; $("#mapaMU").style.cursor = ""; });
  const tipos = [...new Map(MU.blocos.filter(b => b.modo === "fichas" && b.coord).flatMap(b => (b.subtipos ? Object.keys(b.subtipos).filter(s => temCoord(b, s)) : [null])
    .map(s => { const ic = b.icone({tipo: s}); return [ic, ICONES_ROTULO[ic] || ic]; }))).entries()];
  $("#legMU").innerHTML = tipos.map(([t, rot]) => `<span style="white-space:nowrap;margin-right:10px;display:inline-block;margin-bottom:3px">${iconeLegenda(t)}${esc(rot)}</span>`).join("")
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
      .bindTooltip(esc(b.titulo(r))).on("click", () => editarFicha(b, r));
  });
  if (prov && MU.edit) itens.push(L.marker([prov.lat, prov.lon], {icon: iconeMapa(MU.edit.b.icone(MU.edit.r), {sel:true}), zIndexOffset:2000}));
  camadaMU = L.featureGroup(itens).addTo(mapaMU);
  if (enquadrar){
    const bb = MU.lim ? L.latLngBounds(MU.lim.getBounds().getSouthWest(), MU.lim.getBounds().getNorthEast()) : null;
    if (bb){ const perto = bb.pad(2); itens.forEach(m => { if (perto.contains(m.getLatLng())) bb.extend(m.getLatLng()); }); mapaMU.fitBounds(bb, {padding:[20,20]}); }
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
})();
