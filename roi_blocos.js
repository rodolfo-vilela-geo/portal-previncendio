// ROI em blocos temáticos: agrupa as seções do modelo oficial (numeração mantida) em 5 etapas,
// mostra um resumo vivo da ocorrência e um índice lateral com a situação de cada seção.
// Não muda campos nem nomes: só a apresentação (o PDF e a importação continuam iguais).
(function(){
const GRUPOS = [
  {t:"A ocorrência", d:"Polígono, unidade e responsáveis", s:[/^Comece por aqui/i, /^Identifica/i]},
  {t:"Detecção e combate", d:"Quando foi visto, quem combateu e com quê", s:[/^1\./, /^2\./, /^3\./]},
  {t:"Área e causa", d:"O que queimou e por quê", s:[/^4\./, /^5\./]},
  {t:"Impactos e relato", d:"Fauna, descrição, proprietário e dificuldades", s:[/^6\./, /^7\./, /^8\./, /^9\./]},
  {t:"Apoio e anexos", d:"Alimentação, fotos e observações", s:[/^10\./, /^11\./, /^Observa/i]}
];
const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
const val = n => { const e = $(`[name="${n}"]`); if (!e) return ""; if (e.type === "radio"){ const c = $(`[name="${n}"]:checked`); return c ? c.value : ""; } return (e.value || "").trim(); };
const fD = d => d ? d.split("-").reverse().join("/") : "";
const num = v => parseFloat(String(v || "").replace(",", ".")) || 0;

function montar(){
  const main = $("#form"); if (!main || main.dataset.blocos) return; main.dataset.blocos = "1";
  const secs = $$("section.bloco", main);
  secs.forEach(s => s.dataset.tit = ($("h2", s)?.textContent || "").trim());
  const tit = s => s.dataset.tit;
  document.head.insertAdjacentHTML("beforeend", `<style>
  #form{max-width:1240px}
  .roi-grade{display:grid;grid-template-columns:230px minmax(0,1fr);gap:22px;align-items:start}
  .roi-nav{position:sticky;top:12px;font-size:13px;background:var(--papel);border:1px solid var(--linha);border-radius:var(--raio);padding:10px 8px}
  .roi-nav .g{font-weight:700;margin:8px 6px 2px;font-size:12.5px;color:var(--tinta)} .roi-nav .g:first-child{margin-top:2px}
  .roi-nav a{display:flex;align-items:center;gap:7px;padding:3px 6px;border-radius:6px;color:var(--suave);text-decoration:none;line-height:1.25}
  .roi-nav a:hover{background:#eef3e2;color:var(--tinta)}
  .roi-nav a i{flex:none;width:9px;height:9px;border-radius:50%;border:1.5px solid #b9b5ab}
  .roi-nav a.ok i{background:#3f7d1f;border-color:#3f7d1f} .roi-nav a.falta i{background:#fff;border-color:var(--erro)} .roi-nav a.falta{color:var(--tinta)}
  .roi-nav .leg{margin:10px 6px 2px;font-size:11.5px;color:var(--suave);line-height:1.6}
  .roi-nav .leg i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:0}
  .grupo-tit{display:flex;align-items:baseline;gap:10px;margin:26px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--linha)}
  .grupo-tit:first-of-type{margin-top:4px}
  .grupo-tit b{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--vinho-esc);color:#fff;font-size:13px;flex:none;align-self:center}
  .grupo-tit h2{margin:0;font-size:18px} .grupo-tit span{color:var(--suave);font-size:13px}
  section.bloco>h2{background:transparent!important;color:var(--tinta)!important;text-transform:none!important;letter-spacing:0!important;font-size:15px!important;padding:12px 14px 4px!important;display:flex;align-items:baseline;gap:8px}
  section.bloco>h2 .ns{font-size:11.5px;font-weight:700;color:#fff;background:#6b7d5a;border-radius:99px;padding:1px 8px;flex:none}
  section.bloco{border-left:4px solid #c9d4b8!important;scroll-margin-top:14px}
  section.bloco.ok{border-left-color:#3f7d1f!important} section.bloco.falta{border-left-color:#e0a03a!important}
  .roi-resumo{background:var(--papel);border:1px solid var(--linha);border-radius:var(--raio);padding:12px 14px;margin:0 0 6px;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
  .roi-resumo div{background:#f3f4ee;border-radius:8px;padding:6px 9px;min-width:0}
  .roi-resumo b{display:block;font-size:15px;line-height:1.2;overflow-wrap:anywhere} .roi-resumo span{font-size:11.5px;color:var(--suave)}
  .roi-resumo .vazio b{color:#a5a39a;font-weight:500}
  @media (max-width:1180px){ .roi-grade{grid-template-columns:1fr} .roi-nav{display:none} }
  body.importar .roi-nav{display:none} body.importar .roi-grade{grid-template-columns:1fr}
  @media print{ .roi-nav,.grupo-tit,.roi-resumo{display:none!important} }
  </style>`);
  // número da seção vira selo; título fica em caixa normal
  secs.forEach(s => { const h = $("h2", s); if (!h) return; const m = /^(\d+)\.\s*(.*)$/.exec(h.textContent.trim());
    if (m) h.innerHTML = `<span class="ns">seção ${m[1]}</span>${m[2].charAt(0) + m[2].slice(1)}`; });
  // grupos
  const grade = document.createElement("div"); grade.className = "roi-grade";
  const nav = document.createElement("nav"); nav.className = "roi-nav"; nav.setAttribute("aria-label", "Seções do ROI");
  const corpo = document.createElement("div");
  const primeiro = secs[0]; primeiro.parentNode.insertBefore(grade, primeiro);
  grade.append(nav, corpo);
  const resumo = document.createElement("div"); resumo.className = "roi-resumo"; resumo.id = "roiResumo"; corpo.append(resumo);
  let navHtml = "";
  GRUPOS.forEach((g, gi) => {
    const doGrupo = secs.filter(s => g.s.some(rx => rx.test(tit(s))));
    if (!doGrupo.length) return;
    const h = document.createElement("div"); h.className = "grupo-tit"; h.id = "grupo" + gi;
    h.innerHTML = `<b>${gi + 1}</b><h2>${g.t}</h2><span>${g.d}</span>`;
    corpo.append(h);
    navHtml += `<div class="g">${gi + 1}. ${g.t}</div>`;
    doGrupo.forEach((s, si) => { s.id ||= `sec_${gi}_${si}`; corpo.append(s);
      const nome = ($("h2", s)?.textContent || "").replace(/^seção \d+/, "").replace(/^Comece por aqui\s*·\s*/i, "").trim();
      navHtml += `<a href="#${s.id}" data-sec="${s.id}"><i></i>${nome.length > 34 ? nome.slice(0, 32) + "…" : nome}</a>`; });
  });
  // seções que não casaram (segurança): ficam no fim, na ordem original
  secs.filter(s => !corpo.contains(s)).forEach(s => corpo.append(s));
  nav.innerHTML = navHtml + `<div class="leg"><i style="background:#3f7d1f"></i>preenchida<br><i style="border:1.5px solid var(--erro)"></i>falta campo obrigatório<br><i style="border:1.5px solid #b9b5ab"></i>em branco</div>`;
  $$("a", nav).forEach(a => a.onclick = e => { e.preventDefault(); document.getElementById(a.dataset.sec)?.scrollIntoView({behavior:"smooth", block:"start"}); });
  atualizar();
  document.addEventListener("input", atualizar, true); document.addEventListener("change", atualizar, true);
  setInterval(atualizar, 2000);   // preenchimentos automáticos (polígono, importação, rascunho) não disparam eventos
}

function estadoSec(s){
  const campos = $$("input,select,textarea", s).filter(e => e.type !== "file" && e.type !== "button" && !e.disabled && e.offsetParent !== null);
  const obrig = campos.filter(e => e.required || e.closest("div")?.querySelector("label .req"));
  const vazio = e => e.type === "radio" ? !$(`[name="${e.name}"]:checked`, s) : e.type === "checkbox" ? false : !String(e.value || "").trim();
  const algum = campos.some(e => e.type === "checkbox" ? e.checked : !vazio(e)) || $$("table.din tbody tr", s).length > 0 || ($("input[type=file]", s)?.files?.length > 0);
  if (obrig.some(vazio)) return "falta";
  return algum ? "ok" : "";
}
function atualizar(){
  $$("section.bloco").forEach(s => { const st = estadoSec(s); s.classList.toggle("ok", st === "ok"); s.classList.toggle("falta", st === "falta");
    const a = $(`.roi-nav a[data-sec="${s.id}"]`); if (a){ a.classList.toggle("ok", st === "ok"); a.classList.toggle("falta", st === "falta"); } });
  const r = $("#roiResumo"); if (!r) return;
  const uc = val("nome_uc"), cod = ($("#codPreview")?.textContent || "").trim();
  const dd = val("dat_detec"), hd = val("hr_detec"), df = val("dat_final"), hf = val("hr_final");
  let dur = "";
  if (dd && hd && df && hf){ const m = Math.round((new Date(`${df}T${hf}`) - new Date(`${dd}T${hd}`)) / 6e4);
    if (m >= 0) dur = m < 60 ? `${m} min` : m < 2880 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${(m / 1440).toLocaleString("pt-BR", {maximumFractionDigits:1})} dias`; }
  const area = num(val("area_int")) + num(val("area_ent"));
  const causaSel = $('[name="causa_p"]'), causa = causaSel?.selectedOptions?.[0]?.value ? causaSel.selectedOptions[0].textContent : "";
  const c = (rot, v) => `<div class="${v ? "" : "vazio"}"><span>${rot}</span><b>${v || "—"}</b></div>`;
  const html = c("Código BDP", /\d/.test(cod) ? cod : "") + c("Unidade", uc) + c("Detecção", dd ? `${fD(dd)} ${hd}` : "") +
    c("Debelado", df ? `${fD(df)} ${hf}` : "") + c("Duração", dur) + c("Área queimada", area ? area.toLocaleString("pt-BR", {maximumFractionDigits:2}) + " ha" : "") + c("Causa provável", causa);
  if (r.innerHTML !== html) r.innerHTML = html;
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar); else montar();
})();
