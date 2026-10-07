// ROI · seção 4: vegetação atingida calculada pelo Inventário Florestal de MG (IDE-Sisema) a partir do polígono.
// O gerente confere e corrige: campo editado à mão não é mais sobrescrito. O detalhe por classe (17 classes)
// vai para roi_vegetacao; os campos do BDG recebem a soma por campo (veg_classe.campo_roi).
// O que o inventário não mapeia dentro do polígono entra em "Área antrópica"; água vai em "Outros".
// Usa globais do roi.html: $, F, esc, num, sb, poligonos, poligonosGeoJSON, fmtHa, VEGETACAO, mudou, MODO_IMPORTAR.
(function(){
const VEG = window.VEG = {ativo: !new URLSearchParams(location.search).has("importar"), ultimo: null, chave: ""};
const r2 = x => Math.round(x * 100) / 100;

VEG.iniciar = function(){
  if (!VEG.ativo) return;
  $("#gradeVeg").insertAdjacentHTML("beforebegin", `<div id="vegInv" class="dica" style="margin:0 0 10px"></div>`);
  // digitou num campo de vegetação: passa a valer o que o gerente escreveu
  [...VEGETACAO.map(([n]) => n), "veg_outro"].forEach(n => F(n)?.addEventListener("input", () => { delete F(n).dataset.auto; F(n).classList.remove("auto-inv"); }));
  document.head.insertAdjacentHTML("beforeend", `<style>
    input.auto-inv{background:#f2f7ea} #vegInv .caixa{background:#f2f7ea;border:1px solid #cfe0b8;border-radius:8px;padding:8px 10px}
    #vegInv table{border-collapse:collapse;font-size:12.5px;margin-top:6px} #vegInv td{padding:1px 8px 1px 0} #vegInv td.n{text-align:right}</style>`);
};

VEG.limpar = function(){ VEG.ultimo = null; VEG.chave = ""; if ($("#vegInv")) $("#vegInv").innerHTML = ""; };

// chamado sempre que o polígono é mostrado; só recalcula se o polígono mudou
VEG.aoMudarPoligono = function(){
  if (!VEG.ativo || !sb) return;
  if (!poligonos.length){ VEG.limpar(); return; }
  const ch = JSON.stringify(poligonos).length + "|" + poligonos[0][0][0].join(",");
  if (ch === VEG.chave) return;
  VEG.chave = ch; VEG.calcular();
};

VEG.calcular = async function(){
  const box = $("#vegInv"); if (!box) return;
  box.innerHTML = `<div class="caixa">Calculando a vegetação atingida pelo Inventário Florestal…</div>`;
  const chave = VEG.chave;
  let res;
  try{ res = await sb.rpc("vegetacao_poligono", {p_geojson: poligonosGeoJSON()}); }catch(e){ res = {error: e}; }
  if (chave !== VEG.chave) return;                              // o polígono mudou enquanto calculava
  if (res.error || !res.data){ box.innerHTML = `<div class="caixa" style="color:var(--alerta)">Não foi possível calcular a vegetação (${esc(res.error?.message || "sem resposta")}). Preencha à mão.</div>`; return; }
  const d = res.data;
  if (!d.carregado){ box.innerHTML = `<div class="caixa">O Inventário Florestal ainda não foi carregado no Colibri: preencha a vegetação à mão.</div>`; return; }
  VEG.ultimo = d;
  // soma por campo do ROI
  const soma = {}; let agua = 0;
  d.classes.forEach(c => { if (c.campo_roi === "agua") agua += +c.ha; else soma[c.campo_roi] = (soma[c.campo_roi] || 0) + (+c.ha); });
  const naoMap = Math.max(0, d.total - d.mapeado);
  soma.veg_ant = (soma.veg_ant || 0) + naoMap;
  const livre = n => !String(F(n).value || "").trim() || F(n).dataset.auto === "1";
  let preenchidos = 0, mantidos = 0;
  VEGETACAO.forEach(([n]) => {
    const v = r2(soma[n] || 0);
    if (livre(n)){ F(n).value = v ? v.toFixed(2) : ""; F(n).dataset.auto = "1"; F(n).classList.toggle("auto-inv", !!v); if (v) preenchidos++; }
    else if (Math.abs((num(F(n).value) || 0) - v) > 0.01) mantidos++;
  });
  if (agua >= 0.01 && livre("veg_outro")){ F("veg_outro").value = `Água (inventário): ${fmtHa(agua)}`; F("veg_outro").dataset.auto = "1"; F("veg_outro").classList.add("auto-inv"); }
  const linhas = d.classes.map(c => `<tr><td>${esc(c.classe)}</td><td class="n">${fmtHa(+c.ha)} ha</td></tr>`).join("")
    + (naoMap >= 0.01 ? `<tr><td>Não mapeado pelo inventário (pastagem, lavoura, solo exposto…) → Área antrópica</td><td class="n">${fmtHa(naoMap)} ha</td></tr>` : "");
  box.innerHTML = `<div class="caixa">🌿 <b>Calculado pelo Inventário Florestal de MG</b> (IDE-Sisema) para o polígono de <b>${fmtHa(d.total)} ha</b>.
    É uma estimativa: <b>confira e corrija</b> conforme o que viu em campo — os campos que você alterar ficam como você escreveu.
    ${mantidos ? `<br>${mantidos} campo(s) já preenchido(s) por você foram mantidos.` : ""}
    <details style="margin-top:4px"><summary style="cursor:pointer">ver por classe do inventário</summary><table>${linhas}</table></details>
    <button type="button" class="btn peq" id="vegRefazer" style="margin-top:6px" title="Apaga o que foi digitado na seção 4 e usa de novo o cálculo do inventário">Usar o cálculo de novo</button></div>`;
  $("#vegRefazer").onclick = () => { [...VEGETACAO.map(([n]) => n), "veg_outro"].forEach(n => { F(n).dataset.auto = "1"; }); VEG.chave = ""; VEG.aoMudarPoligono(); };
  mudou();
};

// detalhe por classe para roi_vegetacao (só quando o cálculo foi feito)
VEG.linhas = cod => VEG.ativo && VEG.ultimo ? VEG.ultimo.classes.filter(c => +c.ha > 0).map(c => ({cod_bdp: cod, class_id: c.class_id, ha: +c.ha})) : [];
VEG.estado = () => VEG.ultimo ? {ultimo: VEG.ultimo, auto: [...VEGETACAO.map(([n]) => n), "veg_outro"].filter(n => F(n).dataset.auto === "1")} : null;
VEG.aplicar = s => { if (!VEG.ativo || !s) return; VEG.ultimo = s.ultimo; (s.auto || []).forEach(n => { if (F(n)){ F(n).dataset.auto = "1"; if (F(n).value) F(n).classList.add("auto-inv"); } }); };
})();
