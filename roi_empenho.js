// ROI · 2.2 Recursos empenhados (a partir de 2027; 2026 em teste)
// Uma linha por dia e instituição: horário, pessoas, veículos e aeronaves (com contrato).
// A evolução antiga por coluna (UC, FTP, Parc., CFM, Vol., PM, BM) e a seção 3 (veículos UC/outros)
// passam a ser CALCULADAS daqui, para o BDG e a série 2013–2025 continuarem iguais.
// No modo de transcrição de PDFs (?importar=1) nada muda: vale a tabela antiga.
// Usa as funções globais do roi.html: $, $$, F, esc, num, txt, sb, linhaEvol, COMB, VEICULOS, MODO_IMPORTAR.
(function(){
const VEIC = [["vc_4x4","4x4"],["vc_4x2","4x2"],["vc_pipa","Pipa/ABT"],["vc_moto","Moto"],["vc_trator","Trator"],["vc_out","Outros"]];
const AERO = [["a_helicop","Helicóptero"],["a_air_tr","Air Tractor"],["a_drone","Drone"]];
const CONTRATOS = {CFM:"CFM (IEF via Vale)", FTP:"FTP (CBMMG)", "CBMMG/COMAVE":"CBMMG / COMAVE", Outro:"Outro"};
const DA_UC = ["ger","uc"];                       // "da UC" na seção 3; o resto é "Outros"
const COL_ROI = {uc:"comb_uc", ftp:"comb_ftp", sm:"comb_sm", par:"comb_par", vol:"comb_vol", pm:"comb_pm", bm:"comb_bm", out:"comb_par"};  // o ROI não tem coluna "outros": soma em Parceiros, como na Sala
let INST = [], GRUPOS = [];
const sa = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const inst = id => INST.find(i => i.id === +id);
const grupo = i => i?.grupo || "out";
const OUTRA = () => INST.find(i => /^Outra instituição/.test(i.nome));

const EMP = window.EMP = {ativo: !new URLSearchParams(location.search).has("importar")};   // carregado antes do script principal

EMP.iniciar = async function(){
  if (!EMP.ativo) return;
  document.head.insertAdjacentHTML("beforeend", `<style>
    #empNovo .emp-l{border:1px solid var(--linha);border-radius:10px;padding:8px 10px;margin:0 0 8px;background:#fbfbf7}
    #empNovo .emp-a{display:grid;grid-template-columns:140px 112px 112px minmax(200px,1fr) 80px 34px;gap:6px;align-items:end}
    #empNovo .emp-b{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:6px;margin-top:6px;align-items:end}
    #empNovo label{font-size:11.5px;margin:0 0 2px;color:var(--suave)}
    #empNovo .emp-b input{padding:5px 6px} #empNovo .emp-inst{display:flex;gap:4px} #empNovo .emp-inst input{flex:0 1 110px;min-width:0} #empNovo .emp-inst select{flex:1;min-width:0}
    #empNovo .emp-c{grid-column:span 2} #empNovo .emp-o{grid-column:1/-1}
    #empNovo .emp-x{height:34px;padding:0}
    #empResumo table{border-collapse:collapse;font-size:12.5px;margin-top:6px} #empResumo td,#empResumo th{border:1px solid #e3e3da;padding:2px 7px;text-align:center}
    #empResumo th{background:#eef1e6;font-weight:600}
    @media (max-width:720px){ #empNovo .emp-a{grid-template-columns:1fr 1fr 1fr} #empNovo .emp-a .emp-i{grid-column:1/-1} }
  </style>`);
  const [a, b] = await Promise.all([
    sb.from("instituicao").select("id,nome,sigla,grupo,categoria,variantes,ativo").eq("ativo", true).order("nome"),
    sb.from("empenho_categoria").select("id,nome,coluna,ordem").eq("ativo", true).order("ordem")]);
  INST = (a.data || []).filter(i => !/\(juntada\)$/.test(i.nome)); GRUPOS = b.data || [];
  if (!INST.length){ EMP.ativo = false; return; }    // sem catálogo (sem rede): fica o formulário antigo
  $("#evolAntiga").hidden = true;
  const box = $("#empNovo"); box.hidden = false;
  box.innerHTML = `<label>2.2 Recursos empenhados — uma linha por dia e instituição</label>
    <div class="dica" style="margin:-2px 0 8px">Quem atuou em cada dia: horário, quantas pessoas, veículos e aeronaves. Só quantidades, sem nomes.
      Brigada de empresa operada por outra (ex.: AMDA para a Vale) entra com o nome da <b>empresa</b>. Se a Sala de Situação já registrou, as linhas vêm preenchidas — confira e corrija: <b>vale o que a UC informar</b>.</div>
    <div id="empLinhas"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn peq" id="empAdd">+ Adicionar linha</button>
      <button type="button" class="btn peq" id="empRep" title="Copia as linhas do último dia para o dia seguinte">Repetir o último dia</button></div>
    <div id="empResumo" class="dica" style="margin-top:8px"></div>`;
  $("#empAdd").onclick = () => { const u = EMP.ler().filter(l => l.data).pop(); EMP.linha(u ? {data: u.data} : {}); EMP.derivar(); mudou(); };
  $("#empRep").onclick = () => {
    const L = EMP.ler().filter(l => l.data); if (!L.length) return;
    const ult = L[L.length - 1].data, d = new Date(ult + "T12:00"); d.setDate(d.getDate() + 1);
    const nova = d.toISOString().slice(0, 10);
    L.filter(l => l.data === ult).forEach(l => EMP.linha({...l, data: nova})); EMP.derivar(); mudou(); };
  box.addEventListener("input", EMP.derivar); box.addEventListener("change", EMP.derivar);
  // seção 3 passa a ser calculada
  $$("#gradeVeic input, [name=vc_outro], [name=vc_instituicoes]").forEach(el => { el.readOnly = true; el.tabIndex = -1; el.style.background = "#f1f1ea"; });
  $("#secVeic .corpo").insertAdjacentHTML("afterbegin", `<p class="dica" style="margin:0 0 8px">Calculado automaticamente a partir da tabela 2.2 (maior número de veículos em um mesmo dia). Para corrigir, altere a 2.2.</p>`);
};

function opcoes(sel){
  return `<option value="">— instituição —</option>` + GRUPOS.map(g => {
    const l = INST.filter(i => grupo(i) === g.id);
    return l.length ? `<optgroup label="${esc(g.nome)}">${l.map(i => `<option value="${i.id}" ${i.id === +sel ? "selected" : ""}>${esc(i.nome)}</option>`).join("")}</optgroup>` : "";
  }).join("");
}

EMP.linha = function(d = {}){
  const el = document.createElement("div"); el.className = "emp-l";
  const n = (k, v) => `<input type="number" min="0" inputmode="numeric" data-k="${k}" value="${v ?? ""}">`;
  el.innerHTML = `<div class="emp-a">
      <div><label>Data</label><input type="date" data-k="data" value="${d.data || ""}"></div>
      <div><label>Início</label><input type="time" data-k="hr_inicio" value="${d.hr_inicio || ""}"></div>
      <div><label>Fim</label><input type="time" data-k="hr_fim" value="${d.hr_fim || ""}"></div>
      <div class="emp-i"><label>Instituição</label><div class="emp-inst"><input data-k="_busca" placeholder="buscar…" autocomplete="off"><select data-k="instituicao_id">${opcoes(d.instituicao_id)}</select></div></div>
      <div><label>Pessoas</label>${n("pessoas", d.pessoas)}</div>
      <button type="button" class="btn peq emp-x" title="Remover a linha">×</button></div>
    <div class="emp-b">${VEIC.map(([k, t]) => `<div><label>${t}</label>${n(k, d[k])}</div>`).join("")}
      ${AERO.map(([k, t]) => `<div><label>${t}</label>${n(k, d[k])}</div>`).join("")}
      <div class="emp-c" hidden><label>Contrato da aeronave</label><select data-k="a_contrato"><option value="">—</option>${Object.entries(CONTRATOS).map(([k, t]) => `<option value="${k}" ${d.a_contrato === k ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
      <div class="emp-o"><label>Observação</label><input data-k="obs" placeholder="empresa atendida, UC de origem… (em “Outra instituição”, o nome dela)" value="${esc(d.obs || "")}"></div></div>`;
  const verC = () => { const tem = AERO.some(([k]) => num(el.querySelector(`[data-k=${k}]`).value)); el.querySelector(".emp-c").hidden = !tem; };
  AERO.forEach(([k]) => el.querySelector(`[data-k=${k}]`).addEventListener("input", verC)); verC();
  el.querySelector(".emp-x").onclick = () => { el.remove(); EMP.derivar(); mudou(); };
  const s = el.querySelector("select[data-k=instituicao_id]");
  el.querySelector("[data-k=_busca]").addEventListener("input", e => {
    const q = sa(e.target.value.trim()); if (!q){ s.innerHTML = opcoes(s.value); return; }
    const l = INST.filter(i => sa([i.nome, i.sigla, ...(i.variantes || [])].join(" ")).includes(q));
    s.innerHTML = l.length ? l.map(i => `<option value="${i.id}">${esc(i.nome)}</option>`).join("") : `<option value="${OUTRA()?.id || ""}">Outra instituição (escreva o nome na observação)</option>`;
  });
  $("#empLinhas").appendChild(el);
  return el;
};

EMP.ler = () => $$("#empLinhas .emp-l").map(el => Object.fromEntries($$("[data-k]", el).filter(i => !i.dataset.k.startsWith("_")).map(i => [i.dataset.k, i.value])));
EMP.vazio = () => !EMP.ler().some(l => l.data || l.instituicao_id || l.pessoas);
EMP.aplicar = L => { if (!EMP.ativo) return; $("#empLinhas").innerHTML = ""; (L || []).forEach(EMP.linha); if (!(L || []).length) EMP.linha(); EMP.derivar(); };
EMP.doRI = L => { $("#empLinhas").innerHTML = ""; L.forEach(l => EMP.linha(Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v === 0 ? "" : v])))); EMP.derivar(); };

// linhas válidas, em números
function validas(){
  return EMP.ler().filter(l => l.data && l.instituicao_id).map(l => {
    const o = {data: l.data, hr_inicio: txt(l.hr_inicio), hr_fim: txt(l.hr_fim), instituicao_id: +l.instituicao_id, pessoas: num(l.pessoas) || 0,
               a_contrato: txt(l.a_contrato), obs: txt(l.obs)};
    [...VEIC, ...AERO].forEach(([k]) => o[k] = num(l[k]) || null);
    return o; });
}

// calcula a evolução antiga (por coluna) e a seção 3
EMP.derivar = function(){
  if (!EMP.ativo) return;
  const L = validas(), dias = {};
  L.forEach(l => {
    const i = inst(l.instituicao_id) || {}, d = dias[l.data] ||= {inst: {}, ini: null, fim: null, vUC: {}, vOut: {}, aer: {}, outros: 0, drone: 0};
    const p = d.inst[l.instituicao_id] ||= {col: COL_ROI[i.categoria] || "comb_par", p: 0};
    p.p = Math.max(p.p, l.pessoas);                     // mesma instituição duas vezes no dia: maior efetivo
    if (l.hr_inicio && (!d.ini || l.hr_inicio < d.ini)) d.ini = l.hr_inicio;
    if (l.hr_fim && (!d.fim || l.hr_fim > d.fim)) d.fim = l.hr_fim;
    const lado = DA_UC.includes(grupo(i)) ? d.vUC : d.vOut;
    ["vc_4x4","vc_4x2","vc_pipa","vc_moto","vc_trator"].forEach(k => lado[k] = (lado[k] || 0) + (l[k] || 0));
    d.aer.a_helicop = (d.aer.a_helicop || 0) + (l.a_helicop || 0); d.aer.a_air_tr = (d.aer.a_air_tr || 0) + (l.a_air_tr || 0);
    d.outros += l.vc_out || 0; d.drone += l.a_drone || 0;
  });
  const ord = Object.keys(dias).sort();
  // evolução (tabela antiga, escondida): é ela que vai para roi_evolucao e para o BDG
  $("#tabEvol tbody").innerHTML = "";
  ord.forEach(dt => { const d = dias[dt], o = {data: dt, hr_inicio: d.ini || "", hr_fim: d.fim || ""};
    COMB.forEach(k => o[k] = ""); Object.values(d.inst).forEach(x => o[x.col] = (+o[x.col] || 0) + x.p);
    linhaEvol(o); });
  // seção 3: maior quantidade num mesmo dia
  const mx = f => Math.max(0, ...ord.map(f));
  VEICULOS.forEach(([, uc, out]) => {
    if (uc) F(uc).value = mx(dt => dias[dt].vUC[uc] || 0) || "";
    const base = out.replace(/_d$/, "");
    F(out).value = (out.startsWith("a_") ? mx(dt => dias[dt].aer[out] || 0) : mx(dt => dias[dt].vOut[base] || 0)) || "";
  });
  const vo = mx(dt => dias[dt].outros), dr = mx(dt => dias[dt].drone);
  F("vc_outro").value = [vo ? `Outros veículos, ${vo}` : "", dr ? `Drone, ${dr}` : ""].filter(Boolean).join("; ");
  F("vc_instituicoes").value = [...new Set(L.map(l => inst(l.instituicao_id)).filter(i => i && !DA_UC.includes(grupo(i))).map(i => i.nome))].join("; ");
  // resumo nas colunas antigas
  const ROT = {comb_uc:"UC", comb_ftp:"FTP", comb_par:"Parc.", comb_sm:"CFM", comb_vol:"Vol.", comb_pm:"PM", comb_bm:"BM"};
  const ev = $$("#tabEvol tbody tr").map(tr => Object.fromEntries($$("input", tr).map(i => [i.dataset.k, i.value])));
  $("#empResumo").innerHTML = ev.length ? `Como fica nas colunas do BDG (pessoas por dia):
    <table><tr><th>Dia</th>${COMB.map(k => `<th>${ROT[k]}</th>`).join("")}<th>Total</th></tr>${ev.map(e => `<tr><td>${e.data.split("-").reverse().join("/")}</td>${COMB.map(k => `<td>${e[k] || "–"}</td>`).join("")}<td><b>${COMB.reduce((s, k) => s + (+e[k] || 0), 0)}</b></td></tr>`).join("")}</table>` : "";
};

EMP.validar = function(){
  if (!EMP.ativo || F("sem_combate").checked) return [];
  const erros = [], det = F("dat_detec").value, fim = F("dat_final").value;
  $$("#empLinhas .emp-l").forEach((el, n) => {
    const g = k => el.querySelector(`[data-k=${k}]`), v = k => g(k).value;
    const algo = ["pessoas", ...VEIC.map(x => x[0]), ...AERO.map(x => x[0])].some(k => num(v(k)));
    if (!v("data") && !v("instituicao_id") && !algo) return;      // linha em branco: ignorada
    const m = (k, t) => { g(k).classList.add("invalido"); erros.push(`2.2, linha ${n + 1}: ${t}`); };
    if (!v("data")) m("data", "informe a data.");
    else if ((det && v("data") < det) || (fim && v("data") > fim)) m("data", "a data está fora do período do incêndio.");
    if (!v("instituicao_id")) m("instituicao_id", "escolha a instituição.");
    if (!algo) m("pessoas", "informe pessoas, veículos ou aeronaves.");
    if (AERO.some(([k]) => num(v(k))) && !v("a_contrato")) m("a_contrato", "informe o contrato da aeronave.");
    if (+v("instituicao_id") === OUTRA()?.id && !txt(v("obs"))) m("obs", "escreva o nome da instituição na observação.");
  });
  if (!validas().length) erros.push("2.2: registre ao menos uma linha de recursos empenhados (ou marque “Não houve combate”).");
  return erros;
};

EMP.linhas = cod => EMP.ativo && !F("sem_combate").checked ? validas().map(l => ({cod_bdp: cod, ...l})) : [];

// texto do PDF (seção 2.2)
EMP.html = function(v, fmtData){
  const L = EMP.linhas("x"); if (!L.length) return "";
  const rv = l => [...VEIC, ...AERO].filter(([k]) => l[k]).map(([k, t]) => `${l[k]} ${t}`).join(", ") + (l.a_contrato && AERO.some(([k]) => l[k]) ? ` (contrato ${l.a_contrato})` : "");
  return `<table><tr><th>Data</th><th>Horário</th><th>Instituição</th><th>Categoria</th><th>Pessoas</th><th>Veículos / aeronaves</th><th>Obs.</th></tr>` +
    L.map(l => { const i = inst(l.instituicao_id) || {};
      return `<tr><td>${fmtData(l.data)}</td><td>${v(l.hr_inicio)}${l.hr_fim ? "–" + v(l.hr_fim) : ""}</td><td>${v(i.nome)}</td><td>${v(GRUPOS.find(g => g.id === grupo(i))?.nome)}</td>
        <td style="text-align:center">${l.pessoas || "-"}</td><td>${v(rv(l))}</td><td>${v(l.obs)}</td></tr>`; }).join("") + `</table>`;
};
})();
