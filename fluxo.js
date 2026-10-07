// Barra dos três passos da ocorrência (RI → SMC → ROI), inserida logo abaixo do cabeçalho
// da Sala de Situação, do SMC e do ROI. Leva junto o RI em uso (?ano=&ri=) para o próximo passo.
// Uso: <script src="fluxo.js" data-passo="ri|smc|roi"></script>
(function(){
  const eu = document.currentScript, passo = eu?.dataset.passo || "";
  const CHAVE = "colibri_ri_atual";
  const ler = () => {
    const q = new URLSearchParams(location.search);
    if (q.get("ri")) return {ano: q.get("ano") || String(new Date().getFullYear()), ri: q.get("ri").padStart(4, "0")};
    try{ return JSON.parse(sessionStorage.getItem(CHAVE) || "null"); }catch(e){ return null; }
  };
  let ctx = null;   // decisão de 07/10/2026: nenhum RI é levado de um passo para o outro (o ROI começa escolhendo o RI)
  try{ sessionStorage.removeItem(CHAVE); }catch(e){}
  const PASSOS = [
    {id:"ri",  c:"RI", n:1, t:"Registro de Incêndio", s:"RI · Sala de Situação", url:"sala.html", cor:"#c2410c"},
    {id:"smc", c:"SMC", n:2, t:"Mapear a área queimada", s:"SMC", url:"smc.html", cor:"#1f5fa8"},
    {id:"roi", c:"ROI", n:3, t:"Relatório de Ocorrência", s:"ROI", url:"roi.html", cor:"#3f6b12"}];
  const css = `
  .fluxo-passos{width:100%;align-self:stretch;background:#fff;border-bottom:1px solid #e3e0da;font:13px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;flex:none}
  .fluxo-passos ol{list-style:none;margin:0 auto;padding:6px 12px;display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none}
  .fluxo-passos li{display:flex;align-items:center;gap:4px;flex:none}
  .fluxo-passos a{display:flex;align-items:center;gap:8px;text-decoration:none;color:#3c4043;border-radius:999px;padding:4px 12px 4px 4px;border:1px solid transparent}
  .fluxo-passos a:hover{background:#f3f4ef}
  .fluxo-passos .n{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:12px;color:#fff;background:var(--c);opacity:.55}
  .fluxo-passos .t b{display:block;font-weight:650} .fluxo-passos .t .cu{display:none} .fluxo-passos .t small{color:#6b6f66;font-size:11.5px}
  .fluxo-passos a[aria-current=step]{background:color-mix(in srgb,var(--c) 10%,#fff);border-color:color-mix(in srgb,var(--c) 35%,#fff);color:#1d1d1f}
  .fluxo-passos a[aria-current=step] .n{opacity:1}
  .fluxo-passos .sep{color:#b5b4ab;font-size:14px;padding:0 2px}
  .fluxo-passos .ctx{margin-left:auto;font-size:12px;color:#5f6368;white-space:nowrap;padding-left:10px}
  .fluxo-passos .ctx button{font:inherit;border:0;background:none;color:#5f6368;cursor:pointer;text-decoration:underline;padding:0 0 0 4px}
  .fluxo-passos .li-prox{margin-left:auto} .fluxo-passos .ctx+.li-prox{margin-left:0} .fluxo-passos .prox{margin-left:8px;font-weight:700;color:#fff!important;background:var(--c);padding:5px 12px}
  .fluxo-passos .prox:hover{filter:brightness(1.08);background:var(--c)}
  @media (max-width:760px){ .fluxo-passos .t .lg{display:none} .fluxo-passos .t .cu{display:block} .fluxo-passos .t small{display:none} .fluxo-passos .t b{font-size:12px} .fluxo-passos .ctx{display:none} .fluxo-passos a:not([aria-current]):not(.prox) .t{display:none} .fluxo-passos a:not([aria-current]):not(.prox){padding:4px} .fluxo-passos .ctx{font-size:11px;padding-left:4px} }
  @media (prefers-color-scheme: dark){
    .fluxo-passos{background:#1a1a19;border-color:#2e2e2b} .fluxo-passos a{color:#d9d8d2} .fluxo-passos a:hover{background:#242422}
    .fluxo-passos a[aria-current=step]{background:color-mix(in srgb,var(--c) 22%,#1a1a19);border-color:color-mix(in srgb,var(--c) 50%,#1a1a19);color:#fff}
    .fluxo-passos .t small,.fluxo-passos .ctx,.fluxo-passos .ctx button{color:#a9a89f} }
  @media print{ .fluxo-passos{display:none} }`;
  const link = p => ctx && p.id !== "smc" ? `${p.url}?ano=${encodeURIComponent(ctx.ano)}&ri=${encodeURIComponent(ctx.ri)}` : p.url;
  function desenhar(){
    let nav = document.querySelector(".fluxo-passos");
    if (!nav){
      const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
      nav = document.createElement("div"); nav.className = "fluxo-passos"; nav.setAttribute("role", "navigation"); nav.setAttribute("aria-label", "Passos da ocorrência de incêndio");
      const h = document.querySelector("body > header"); h ? h.after(nav) : document.body.prepend(nav);
    }
    const i = PASSOS.findIndex(p => p.id === passo), prox = PASSOS[i + 1];
    nav.innerHTML = `<ol>${PASSOS.map((p, k) => `${k ? `<li class="sep" aria-hidden="true">›</li>` : ""}<li><a href="${link(p)}" style="--c:${p.cor}" ${p.id === passo ? 'aria-current="step"' : ""}>
        <span class="n">${p.n}</span><span class="t"><b class="lg">${p.t}</b><b class="cu">${p.c}</b><small>${p.s}</small></span></a></li>`).join("")}
      ${ctx ? `<li class="ctx"><span>Ocorrência em uso: </span><b>RI ${ctx.ri}/${ctx.ano}</b><button type="button" title="Parar de levar este RI para os outros passos">limpar</button></li>` : ""}
      ${prox ? `<li class="li-prox"><a class="prox" href="${link(prox)}" style="--c:${prox.cor}">Próximo: ${prox.c} →</a></li>` : ""}</ol>`;
    nav.querySelector(".ctx button")?.addEventListener("click", () => window.fluxoRI(null));
  }
  // as páginas avisam quando um RI é aberto ou digitado
  window.fluxoRI = () => {};
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", desenhar) : desenhar();
})();
