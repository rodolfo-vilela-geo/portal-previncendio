// Módulo 6 · Mapa de risco (protótipo) — aba do Cadastro da UC (ucs.html).
// Mostra o mapa de risco da UC (uc_risco), a conferência do gerente (uc_risco_revisao:
// parecer, nota e marcações no mapa) e a seção 14 do PIPCIF (figura + tabela por quadrante).
// Usa globais de ucs.html: sb, $, $$, esc, msg, podeEditar, GEO, marcarSujo, sujo.
(function(){
const RM = window.RiscoMapa;
const PARECER = [["concordo", "Concordo", "O mapa representa bem a UC."],
                 ["ressalvas", "Concordo com ressalvas", "No geral está certo, mas há trechos a ajustar (marque no mapa)."],
                 ["discordo", "Discordo", "O mapa não representa a realidade da UC (explique na nota)."]];
// o que só a UC sabe — marcações no mapa
const MARCAS = [
  ["inicio", "adverso", "Início frequente de incêndios"],
  ["combustivel", "adverso", "Muito combustível acumulado"],
  ["acesso_pessoas", "adverso", "Acesso de pessoas (estrada, trilha, roça, lixo)"],
  ["dificil", "adverso", "Difícil acesso para o combate"],
  ["sensivel", "adverso", "Área sensível a proteger"],
  ["aceiro", "favoravel", "Aceiro ou barreira natural"],
  ["agua", "favoravel", "Ponto de água"],
  ["vigia", "favoravel", "Vigilância / ponto de observação"],
  ["apoio", "favoravel", "Apoio de parceiro ou brigada"],
  ["outro", "outro", "Outro"]];
const MARCA = Object.fromEntries(MARCAS.map(([k, g, t]) => [k, {g, t}]));
const COR_G = {adverso:"#c92a2a", favoravel:"#2b8a3e", outro:"#495057"};
const CLASSES = [["muito alta", 4], ["alta", 3], ["moderada", 2], ["baixa", 1], ["sem combustível", 0]];
const fmtD = d => d ? new Date(d).toLocaleDateString("pt-BR") : "";
const pct = v => (v * 100).toLocaleString("pt-BR", {maximumFractionDigits: 0}) + "%";

let mapaR = null, RK = null;

function estilo(){
  if (document.getElementById("estiloRisco")) return;
  document.head.insertAdjacentHTML("beforeend", `<style id="estiloRisco">
  .rk-mod{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,1fr);gap:16px;margin-top:14px;align-items:start}
  @media (max-width:900px){ .rk-mod{grid-template-columns:1fr} }
  #mapaRisco{height:600px;border-radius:10px;border:1px solid var(--linha)}
  #mapaRisco.marcando{cursor:crosshair}
  .rk-cab{border:1px solid var(--linha);border-radius:10px;padding:12px 14px;margin-top:14px;background:#fff;display:flex;gap:18px;flex-wrap:wrap;align-items:center}
  .rk-cab h3{margin:0;font-size:16px} .rk-cab .sub{font-size:12.5px;color:var(--suave)}
  .rk-tag{display:inline-block;font-size:11px;font-weight:700;background:#fff4d6;color:#8a5a00;border-radius:99px;padding:2px 8px;margin-left:6px;vertical-align:2px}
  .rk-leg{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;margin-top:6px} .rk-leg i{width:14px;height:10px;display:inline-block;border-radius:2px;margin-right:4px;vertical-align:-1px;border:1px solid #0002}
  .rk-acur{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px} .rk-acur td,.rk-acur th{padding:3px 6px;border-bottom:1px solid #eee;text-align:right} .rk-acur td:first-child,.rk-acur th:first-child{text-align:left}
  .rk-barra{height:7px;border-radius:4px;display:inline-block;vertical-align:middle}
  .rk-passo{display:flex;gap:8px;align-items:baseline;margin:0 0 6px} .rk-passo b.n{background:var(--verde);color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;flex:none}
  .rk-par label{display:flex;gap:8px;align-items:flex-start;font-weight:400;color:var(--tinta);font-size:13px;border:1px solid var(--linha);border-radius:8px;padding:7px 9px;margin:0 0 6px;cursor:pointer}
  .rk-par label:has(input:checked){border-color:var(--verde);background:var(--realce)}
  .rk-par input{width:auto;flex:none;margin:3px 0 0} .rk-par label span{flex:1;text-align:left}
  .rk-par small{display:block;color:var(--suave);font-size:11.5px}
  .rk-marcas{list-style:none;margin:6px 0 0;padding:0} .rk-marcas li{display:grid;grid-template-columns:14px 1fr auto;gap:6px;align-items:center;font-size:12.5px;padding:4px 0;border-bottom:1px solid #f0eee8}
  .rk-marcas li .pt{width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #0005}
  .rk-marcas input{font:inherit;font-size:12px;width:100%;padding:3px 5px;border:1px solid var(--linha);border-radius:5px;margin-top:2px}
  .rk-marcas button{border:0;background:none;color:var(--erro);cursor:pointer;font-size:15px}
  .rk-q{width:100%;border-collapse:collapse;font-size:12.5px} .rk-q th{position:sticky;top:0;background:#f6f5f1;text-align:left;padding:5px 6px;font-size:11.5px;color:var(--suave)}
  .rk-q td{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top} .rk-q tr{cursor:pointer} .rk-q tbody tr:hover{background:var(--realce)}
  .rk-q .cls{display:flex;height:10px;width:110px;border-radius:3px;overflow:hidden;border:1px solid #0002}
  .rk-pop h4{margin:0 0 4px;font-size:14px} .rk-pop ul{margin:4px 0;padding-left:18px} .rk-pop .rk-conf{color:#666;font-size:12px}
  .rk-quad{background:transparent;border:0;box-shadow:none;color:#fff;font-weight:700;font-size:11px;text-shadow:0 0 3px #000,0 0 2px #000}
  .rk-quad::before{display:none}
  .rk-pin{width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #000a,0 1px 4px #0008}
  </style>`);
}

window.abrirModuloRisco = async function(nome){
  estilo();
  const box = $("#mod-conteudo"), ed = podeEditar(nome);
  box.innerHTML = `<div class="dica" style="padding:20px">Carregando o mapa de risco…</div>`;
  const [r1, r2] = await Promise.all([
    sb.from("uc_risco").select("versao,metodo,dados,atualizado_em,atualizado_por").eq("nome_uc", nome).maybeSingle(),
    sb.from("uc_risco_revisao").select("*").eq("nome_uc", nome).order("atualizado_em", {ascending:false})]);
  if (r1.error) return box.innerHTML = `<div class="dica" style="color:var(--erro);padding:20px">${esc(r1.error.message)}</div>`;
  const R = r1.data;
  if (!R) return box.innerHTML = `<div class="breve-mod"><b>Módulo 6 · Mapa de risco</b> — o mapa desta UC ainda não foi gerado.
    <p style="margin:8px 0 0">O Previncêndio gera o mapa a partir do histórico de áreas queimadas do BDG (2013–2025), do uso e cobertura do solo e do relevo, e o publica aqui.
    Quando estiver disponível, a UC poderá conferi-lo, marcar o que só ela sabe e gerar a seção 14 do PIPCIF.</p></div>`;
  const revs = r2.data || [], minha = revs.find(r => r.versao === R.versao);
  RK = {nome, ed, R, revs, rev: minha ? {...minha, marcacoes: [...(minha.marcacoes || [])]} : {nome_uc: nome, versao: R.versao, parecer: null, nota: "", marcacoes: []},
        quads: RM.porQuadrante(R), marcando: null};
  const M = R.metodo || {};
  box.innerHTML = `
  <div class="rk-cab">
    <div style="flex:1;min-width:260px"><h3>Mapa de risco <span class="rk-tag">protótipo</span></h3>
      <div class="sub">Versão ${esc(R.versao)} · publicado em ${fmtD(R.atualizado_em)} pelo Previncêndio · área: ${esc(M.area || "UC e entorno")} · células de ${esc(M.celula_ha || 6)} ha</div>
      <div class="rk-leg">${[4,3,2,1,0].map(k => `<span><i style="background:${RM.COR[k]}"></i>${RM.NOME[k]}</span>`).join("")}
        <span><i style="background:repeating-linear-gradient(45deg,#fff 0 2px,#555 2px 5px)"></i>Confiança menor</span></div></div>
    <div style="min-width:260px;max-width:420px;flex:1">
      <div style="font-size:13px"><b>${esc(M.resumo || "")}</b></div>
      ${M.classes ? `<table class="rk-acur"><thead><tr><th>Classe</th><th>% da área</th><th>% do que queimou ${esc(M.conferencia || "")}</th></tr></thead><tbody>
        ${CLASSES.filter(([k]) => M.classes[k]).map(([k, i]) => `<tr><td><i class="rk-barra" style="width:10px;background:${RM.COR[i]};border:1px solid #0002"></i> ${esc(k)}</td>
          <td>${M.classes[k].pct_area.toLocaleString("pt-BR")}%</td><td><span class="rk-barra" style="width:${Math.round(M.classes[k].pct_queimado_2023_2025 * .8)}px;background:${RM.COR[i]}"></span> ${M.classes[k].pct_queimado_2023_2025.toLocaleString("pt-BR")}%</td></tr>`).join("")}</tbody></table>` : ""}
    </div>
  </div>
  <div class="rk-mod">
    <div><div id="mapaRisco"></div>
      <p class="dica" style="margin:6px 0 0">Clique numa célula para ver <b>por que</b> ela está nessa classe. Quadrantes de 5 × 5 km (letra = coluna, número = linha), os mesmos da seção 14.</p></div>
    <div>
      <fieldset style="margin-top:0"><legend>Conferência da UC</legend>
        <div class="rk-passo"><b class="n">1</b><span><b>O mapa representa a sua UC?</b></span></div>
        <div class="rk-par">${PARECER.map(([v, t, d]) => `<label><input type="radio" name="rkPar" value="${v}" ${RK.rev.parecer === v ? "checked" : ""} ${ed ? "" : "disabled"}><span>${t}<small>${d}</small></span></label>`).join("")}</div>
        <textarea id="rkNota" rows="3" style="width:100%;font:inherit;font-size:13px" placeholder="Nota (opcional): o que está certo, o que falta, onde o fogo costuma começar…" ${ed ? "" : "disabled"}>${esc(RK.rev.nota || "")}</textarea>
        <div class="rk-passo" style="margin-top:12px"><b class="n">2</b><span><b>Marque no mapa o que só a UC sabe</b></span></div>
        ${ed ? `<div style="display:flex;gap:6px"><select id="rkTipo" style="flex:1;font:inherit;font-size:13px">${["adverso","favoravel","outro"].map(g => `<optgroup label="${g === "adverso" ? "Aumenta o risco" : g === "favoravel" ? "Ajuda na proteção" : "Outro"}">${MARCAS.filter(m => m[1] === g).map(([k, , t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</optgroup>`).join("")}</select>
          <button type="button" class="btn" id="rkMarcar">Marcar no mapa</button></div>` : ""}
        <ul class="rk-marcas" id="rkMarcas"></ul>
        ${ed ? `<div style="display:flex;gap:8px;align-items:center;margin-top:12px"><button type="button" class="btn primario" id="rkSalvar">Salvar conferência</button><span class="dica" id="rkEstado"></span></div>` : `<p class="dica">Somente a equipe da UC e o Previncêndio registram a conferência.</p>`}
      </fieldset>
      <fieldset><legend>3 · Seção 14 do PIPCIF</legend>
        <p class="dica" style="margin:0 0 8px">Figura e tabela por quadrante, prontas para o PIPCIF. Inclui as marcações da UC.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primario" id="rkImprimir">Gerar seção 14</button><button type="button" class="btn" id="rkCSV">Baixar tabela (CSV)</button></div>
      </fieldset>
    </div>
  </div>
  <fieldset><legend>Quadrantes · da maior para a menor atenção</legend>
    <div style="max-height:420px;overflow:auto"><table class="rk-q"><thead><tr><th>Quadrante</th><th>Classes</th><th>Atenção alta + muito alta</th><th>Na UC</th><th>Células que já queimaram</th><th>Por quê (principais)</th><th>Marcações</th></tr></thead><tbody id="rkQuads"></tbody></table></div>
  </fieldset>
  <details class="historico"><summary>Como o mapa foi feito</summary><div style="font-size:13px;line-height:1.6;padding:6px 2px">
    <p>Histórico: ${esc(M.historico || "BDG 2013–2025")}. Modelo calibrado em ${esc(M.calibracao || "")} e conferido em ${esc(M.conferencia || "")}
    (acerto, AUC: ${M.auc_area ?? "?"} na área toda e ${M.auc_uc ?? "?"} dentro da UC — 0,5 seria sorteio, 1 seria perfeito).</p>
    <p>Variáveis: ${esc(M.variaveis || "")}.</p>
    <p>As classes indicam onde <b>concentrar atenção</b>, não onde o fogo vai ocorrer. Fora da UC, da ZA e da faixa de 3 km o BDG registra pouco — por isso a confiança é menor (hachura).</p></div></details>
  <details class="historico"><summary>Histórico de conferências (${revs.length})</summary><div style="font-size:13px;padding:6px 2px">${revs.length ? `<ul class="hist">${revs.map(r => `<li><b>Versão ${esc(r.versao)}</b> · ${esc((PARECER.find(p => p[0] === r.parecer) || [, "sem parecer"])[1])} · ${(r.marcacoes || []).length} marcação(ões)${r.nota ? ` — “${esc(r.nota)}”` : ""}<div class="q">${esc(r.autor || "")} · ${fmtD(r.atualizado_em)}</div></li>`).join("")}</ul>` : `<p class="dica">Nenhuma conferência registrada ainda.</p>`}</div></details>`;

  if (ed){
    $$('[name="rkPar"]').forEach(i => i.onchange = () => { RK.rev.parecer = i.value; sujoR(); });
    $("#rkNota").oninput = () => { RK.rev.nota = $("#rkNota").value; sujoR(); };
    $("#rkMarcar").onclick = () => alternarMarcacao();
    $("#rkSalvar").onclick = salvar;
  }
  $("#rkImprimir").onclick = imprimir;
  $("#rkCSV").onclick = baixarCSV;
  montarMapa();
  listaMarcas();
  tabelaQuads();
};

function sujoR(){ marcarSujo(); const e = $("#rkEstado"); if (e) e.textContent = "Alterações não salvas"; }

function montarMapa(){
  if (mapaR){ mapaR.remove(); mapaR = null; }
  mapaR = L.map("mapaRisco", {zoomSnap:.25, preferCanvas:false});
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom:18, attribution:"Imagem © Esri, Maxar"}).addTo(mapaR);
  const ruas = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {maxZoom:18, subdomains:"abcd", attribution:"© OpenStreetMap · © CARTO"});
  L.control.scale({imperial:false}).addTo(mapaR);
  const C = RM.camada(RK.R);
  RK.C = C;
  C.camada.addTo(mapaR);
  const f = GEO?.features.find(x => x.properties.nome_uc === RK.nome);
  const lim = f ? L.geoJSON(f, {style:{color:"#7CFC00", weight:2.5, fill:false}, interactive:false}).addTo(mapaR) : null;
  RK.pinos = L.layerGroup().addTo(mapaR);
  L.control.layers({"Satélite": sat, "Mapa": ruas}, Object.assign({"Mapa de risco": C.camada}, lim ? {"Limite da UC": lim} : {}, {"Marcações da UC": RK.pinos}), {collapsed:true}).addTo(mapaR);
  if (C.bounds) mapaR.fitBounds(C.bounds, {padding:[8,8]});
  mapaR.on("click", ev => {
    if (RK.marcando){ adicionarMarca(ev.latlng); return; }
    if (!mapaR.hasLayer(C.camada)) return;
    const i = C.celula(ev.latlng); if (i < 0) return;
    const c = RK.R.dados.cel, cl = c.c[i], anos = c.a[i], q = C.quadrante(ev.latlng);
    const mot = cl >= 2 ? (c.m[i] || "").split(",").filter(Boolean).map(k => RK.R.dados.motivos[+k]) : [];
    L.popup({maxWidth:300}).setLatLng(ev.latlng).setContent(`<div class="rk-pop"><h4 style="color:${cl >= 3 ? RM.COR[cl] : "#1d1d1f"}">${RM.NOME[cl]}${q ? ` · quadrante ${esc(q)}` : ""}</h4>
      <b>${cl >= 2 ? "Por que esta área?" : "O que se sabe desta área"}</b><ul><li>${anos ? `Queimou em <b>${anos}</b> dos 13 anos (2013–2025)` : "Não queimou entre 2013 e 2025"}</li>${mot.map(m => `<li>${esc(m[0].toUpperCase() + m.slice(1))}</li>`).join("")}</ul>
      <div class="rk-conf">Confiança ${RM.CONF[c.k[i]]}.</div></div>`).openOn(mapaR);
  });
  pintarMarcas();
}

const pino = (k, sel) => L.divIcon({className:"", html:`<div class="rk-pin" style="background:${COR_G[MARCA[k]?.g || "outro"]};${sel ? "outline:3px solid #ffd43b" : ""}"></div>`, iconSize:[16,16], iconAnchor:[8,8]});
function pintarMarcas(){
  if (!RK.pinos) return;
  RK.pinos.clearLayers();
  RK.rev.marcacoes.forEach((m, i) => L.marker([m.lat, m.lon], {icon: pino(m.tipo)}).bindTooltip(`<b>${esc(MARCA[m.tipo]?.t || m.tipo)}</b>${m.nota ? "<br>" + esc(m.nota) : ""}`).addTo(RK.pinos));
}
function alternarMarcacao(forcar){
  RK.marcando = forcar === false ? null : (RK.marcando ? null : $("#rkTipo").value);
  $("#mapaRisco").classList.toggle("marcando", !!RK.marcando);
  $("#rkMarcar").textContent = RK.marcando ? "Clique no mapa… (cancelar)" : "Marcar no mapa";
}
function adicionarMarca(ll){
  const q = RK.C.quadrante(ll);
  RK.rev.marcacoes.push({lat: +ll.lat.toFixed(6), lon: +ll.lng.toFixed(6), tipo: RK.marcando, nota: "", quadrante: q});
  alternarMarcacao(false); pintarMarcas(); listaMarcas(true); tabelaQuads(); sujoR();
}
function listaMarcas(focar){
  const ul = $("#rkMarcas"), ms = RK.rev.marcacoes;
  ul.innerHTML = ms.length ? ms.map((m, i) => `<li><span class="pt" style="background:${COR_G[MARCA[m.tipo]?.g || "outro"]}"></span>
    <div><b>${esc(MARCA[m.tipo]?.t || m.tipo)}</b>${m.quadrante ? ` · ${esc(m.quadrante)}` : ""}
      ${RK.ed ? `<input data-nota="${i}" value="${esc(m.nota || "")}" placeholder="Nota (ex.: queima de pasto todo agosto)">` : m.nota ? `<div class="dica">${esc(m.nota)}</div>` : ""}</div>
    ${RK.ed ? `<button type="button" data-del="${i}" title="Remover">×</button>` : "<span></span>"}</li>`).join("")
    : `<li style="display:block;color:var(--suave)">Nenhuma marcação.${RK.ed ? " Escolha o tipo e clique em “Marcar no mapa”." : ""}</li>`;
  $$("[data-nota]", ul).forEach(inp => inp.oninput = () => { ms[+inp.dataset.nota].nota = inp.value; pintarMarcas(); sujoR(); });
  $$("[data-del]", ul).forEach(b => b.onclick = () => { ms.splice(+b.dataset.del, 1); pintarMarcas(); listaMarcas(); tabelaQuads(); sujoR(); });
  $$("li", ul).forEach((li, i) => li.onmouseenter = () => ms[i] && mapaR && RK.pinos.getLayers()[i]?.openTooltip());
  if (focar){ const u = $$("[data-nota]", ul).pop(); u?.focus(); }
}
function marcasPorQuad(){
  const m = new Map(); RK.rev.marcacoes.forEach(x => { if (x.quadrante) m.set(x.quadrante, (m.get(x.quadrante) || []).concat(x)); }); return m;
}
function ordenados(){ return [...RK.quads].sort((a, b) => b.atencao - a.atencao || a.n.localeCompare(b.n)); }
function tabelaQuads(){
  const mq = marcasPorQuad();
  $("#rkQuads").innerHTML = ordenados().map(t => `<tr data-q="${esc(t.n)}"><td><b>${esc(t.n)}</b></td>
    <td><div class="cls">${[4,3,2,1,0].map(k => t.cl[k] ? `<span style="flex:${t.cl[k]};background:${RM.COR[k]}"></span>` : "").join("")}</div></td>
    <td><b style="color:${t.atencao >= .3 ? RM.COR[4] : t.atencao >= .15 ? RM.COR[3] : "inherit"}">${pct(t.atencao)}</b></td>
    <td>${pct(t.uc / t.total)}</td><td>${pct(t.queimou / t.total)}</td>
    <td>${t.motivos.length ? esc(t.motivos.join("; ")) : `<span class="dica">—</span>`}</td>
    <td>${(mq.get(t.n) || []).map(m => `<span title="${esc(MARCA[m.tipo]?.t || "")}${m.nota ? ": " + esc(m.nota) : ""}" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:2px;background:${COR_G[MARCA[m.tipo]?.g || "outro"]}"></span>`).join("")}</td></tr>`).join("");
  $$("#rkQuads tr").forEach(tr => tr.onclick = () => {
    const q = RK.R.dados.quadrantes.find(x => x.n === tr.dataset.q), g = RK.R.dados.grade;
    const p = [[q.x0, q.y0], [q.x1, q.y1]].map(([x, y]) => RM.utmParaLL(x, y, g.zona, g.sul));
    mapaR.fitBounds(L.latLngBounds(p)); $("#mapaRisco").scrollIntoView({behavior:"smooth", block:"center"});
  });
}

async function salvar(){
  const b = $("#rkSalvar"); b.disabled = true;
  const o = {nome_uc: RK.nome, versao: RK.R.versao, parecer: RK.rev.parecer, nota: (RK.rev.nota || "").trim() || null,
             marcacoes: RK.rev.marcacoes, atualizado_em: new Date().toISOString()};
  const {data, error} = await sb.from("uc_risco_revisao").upsert(o, {onConflict: "nome_uc,versao"}).select().single();
  b.disabled = false;
  if (error) return msg(error.message, "erro");
  sujo = false; msg("Conferência salva.");
  RK.revs = [data].concat(RK.revs.filter(r => r.versao !== data.versao));
  $("#rkEstado").textContent = "Salvo em " + new Date(data.atualizado_em).toLocaleString("pt-BR");
}

/* ---------- seção 14: figura (desenhada em UTM, sem fundo de satélite) + tabela ---------- */
function figura(larg = 1400){
  const R = RK.R, g = R.dados.grade, s = g.lado_m, c = R.dados.cel, Q = R.dados.quadrantes;
  const x0 = Math.min(...Q.map(q => q.x0)), x1 = Math.max(...Q.map(q => q.x1)), y0 = Math.min(...Q.map(q => q.y0)), y1 = Math.max(...Q.map(q => q.y1));
  const k = larg / (x1 - x0), alt = Math.round((y1 - y0) * k), cv = document.createElement("canvas");
  cv.width = larg; cv.height = alt;
  const ctx = cv.getContext("2d"), P = (x, y) => [(x - x0) * k, (y1 - y) * k];
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, larg, alt);
  for (let i = 0; i < c.id.length; i++){
    const v = RM.vertices(c.id[i], s); ctx.beginPath(); v.forEach(([x, y], j) => { const [a, b] = P(x, y); j ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.closePath();
    ctx.fillStyle = RM.COR[c.c[i]]; ctx.globalAlpha = c.k[i] === 0 ? .55 : 1; ctx.fill(); ctx.strokeStyle = RM.COR[c.c[i]]; ctx.lineWidth = .6; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // limite da UC
  const f = GEO?.features.find(x => x.properties.nome_uc === RK.nome);
  if (f){
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    ctx.strokeStyle = "#1b5e20"; ctx.lineWidth = 3;
    polys.forEach(pl => pl.forEach(anel => { ctx.beginPath(); anel.forEach(([lo, la], j) => { const [x, y] = RM.llParaUTM(la, lo, g.zona); const [a, b] = P(x, y); j ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); }));
  }
  // quadrantes
  ctx.setLineDash([6, 6]); ctx.strokeStyle = "#333"; ctx.lineWidth = 1; ctx.font = `bold ${Math.round(larg / 60)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  Q.forEach(q => { const [a, b] = P(q.x0, q.y1), [cc, d] = P(q.x1, q.y0); ctx.strokeRect(a, b, cc - a, d - b);
    ctx.fillStyle = "#fff"; ctx.lineWidth = 4; ctx.setLineDash([]); ctx.strokeStyle = "#fff"; ctx.strokeText(q.n, (a + cc) / 2, (b + d) / 2);
    ctx.fillStyle = "#222"; ctx.fillText(q.n, (a + cc) / 2, (b + d) / 2); ctx.setLineDash([6, 6]); ctx.strokeStyle = "#333"; ctx.lineWidth = 1; });
  ctx.setLineDash([]);
  // marcações
  RK.rev.marcacoes.forEach(m => { const [x, y] = RM.llParaUTM(m.lat, m.lon, g.zona), [a, b] = P(x, y);
    ctx.beginPath(); ctx.arc(a, b, larg / 160, 0, 2 * Math.PI); ctx.fillStyle = COR_G[MARCA[m.tipo]?.g || "outro"]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke(); });
  // escala (5 km = lado do quadrante)
  const e = 5000 * k; ctx.fillStyle = "#000"; ctx.fillRect(20, alt - 30, e, 6); ctx.font = `${Math.round(larg / 90)}px sans-serif`; ctx.textAlign = "left"; ctx.fillText("5 km", 24 + e, alt - 27);
  return cv.toDataURL("image/png");
}
function linhasTabela(){
  const mq = marcasPorQuad();
  return ordenados().map(t => ({q: t.n, atencao: pct(t.atencao), muito_alta: pct(t.cl[4] / t.total), alta: pct(t.cl[3] / t.total), moderada: pct(t.cl[2] / t.total),
    na_uc: pct(t.uc / t.total), queimou: pct(t.queimou / t.total), motivos: t.motivos.join("; "),
    marcacoes: (mq.get(t.n) || []).map(m => (MARCA[m.tipo]?.t || m.tipo) + (m.nota ? " (" + m.nota + ")" : "")).join("; ")}));
}
function imprimir(){
  const M = RK.R.metodo || {}, lin = linhasTabela(), par = PARECER.find(p => p[0] === RK.rev.parecer);
  const w = window.open("", "_blank"); if (!w) return msg("Permita janelas pop-up para gerar a seção 14.", "erro");
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Seção 14 · ${esc(RK.nome)}</title><style>
    body{font:13px/1.45 Arial,sans-serif;margin:24px;color:#111} h1{font-size:18px;margin:0 0 2px} h2{font-size:14px;margin:18px 0 6px}
    img{width:100%;border:1px solid #ccc} table{border-collapse:collapse;width:100%;font-size:11.5px} th,td{border:1px solid #999;padding:3px 5px;text-align:left;vertical-align:top} th{background:#eee}
    .leg span{margin-right:12px;white-space:nowrap} .leg i{display:inline-block;width:14px;height:10px;margin-right:4px;border:1px solid #0003;vertical-align:-1px}
    .sub{color:#555} @media print{ button{display:none} body{margin:10mm} }</style></head><body>
    <button onclick="print()" style="float:right;padding:6px 12px">Imprimir / salvar PDF</button>
    <h1>14. Setores de risco — ${esc(RK.nome)}</h1>
    <div class="sub">Mapa de risco versão ${esc(RK.R.versao)} (protótipo) · Previncêndio/IEF · ${esc(M.historico || "")}</div>
    <h2>Figura 14.1 — Mapa de atenção por quadrante (5 × 5 km)</h2>
    <img src="${figura()}" alt="Mapa de risco por quadrante">
    <div class="leg">${[4,3,2,1,0].map(k => `<span><i style="background:${RM.COR[k]}"></i>${RM.NOME[k]}</span>`).join("")}<span>células esmaecidas: confiança menor</span>
      <span>— verde-escuro: limite da UC</span><span><i style="background:${COR_G.adverso};border-radius:50%"></i>marcação: aumenta o risco</span><span><i style="background:${COR_G.favoravel};border-radius:50%"></i>ajuda na proteção</span></div>
    <p class="sub">${esc(M.resumo || "")} Calibrado com o BDG ${esc(M.calibracao || "")} e conferido em ${esc(M.conferencia || "")}. As classes indicam onde concentrar a atenção, não onde o fogo vai ocorrer.</p>
    <h2>Tabela 14.1 — Quadrantes, da maior para a menor atenção</h2>
    <table><thead><tr><th>Quadrante</th><th>Atenção alta + muito alta</th><th>Muito alta</th><th>Alta</th><th>Moderada</th><th>Na UC</th><th>Já queimou (2013–2025)</th><th>Principais motivos</th><th>Marcações da UC</th></tr></thead>
    <tbody>${lin.map(l => `<tr><td><b>${esc(l.q)}</b></td><td>${l.atencao}</td><td>${l.muito_alta}</td><td>${l.alta}</td><td>${l.moderada}</td><td>${l.na_uc}</td><td>${l.queimou}</td><td>${esc(l.motivos)}</td><td>${esc(l.marcacoes)}</td></tr>`).join("")}</tbody></table>
    <h2>Conferência da UC</h2><p>${par ? `<b>${esc(par[1])}.</b>` : "Ainda não conferido."} ${esc(RK.rev.nota || "")}</p>
    </body></html>`);
  w.document.close();
}
function baixarCSV(){
  const lin = linhasTabela(), cab = ["Quadrante","Atenção alta + muito alta","Muito alta","Alta","Moderada","Na UC","Já queimou 2013-2025","Principais motivos","Marcações da UC"];
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const txt = "﻿" + [cab.map(q).join(";")].concat(lin.map(l => [l.q, l.atencao, l.muito_alta, l.alta, l.moderada, l.na_uc, l.queimou, l.motivos, l.marcacoes].map(q).join(";"))).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], {type:"text/csv"})); a.download = `secao14_${RK.nome.replace(/\W+/g, "_")}.csv`; a.click();
}
})();
