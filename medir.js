// Geo Colibri · ferramentas de medição (distância, área, coordenada), sem bibliotecas além do Leaflet.
// Uso: Medir.iniciar(mapa)  ·  Medir.ativo() diz se há uma medição em andamento (o clique no mapa não abre fichas).
// Distâncias: geodésicas (haversine). Áreas: no plano UTM (SIRGAS 2000) do fuso do primeiro vértice — o mesmo que o QGIS
// dá com o polígono reprojetado; diferença desprezível para áreas de incêndio.
(function(){
const R = 6371008.8, rad = Math.PI / 180;
const fmt = (n, d = 0) => Number(n).toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d});
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

function dist(a, b){ const dφ = (b.lat - a.lat) * rad, dλ = (b.lng - a.lng) * rad;
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dλ / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
const compr = (pts, fechar) => pts.reduce((s, p, i) => i ? s + dist(pts[i - 1], p) : 0, 0) + (fechar && pts.length > 2 ? dist(pts[pts.length - 1], pts[0]) : 0);
const fuso = lon => Math.floor((lon + 180) / 6) + 1;
// lat/lon (graus) → UTM (m) no fuso dado, hemisfério sul (GRS80)
function utm(lat, lon, z){
  const a = 6378137, f = 1 / 298.257222101, k0 = .9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const φ = lat * rad, λ0 = ((z - 1) * 6 - 180 + 3) * rad, N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2);
  const T = Math.tan(φ) ** 2, C = ep2 * Math.cos(φ) ** 2, A = Math.cos(φ) * (lon * rad - λ0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * φ - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * φ)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * φ) - (35 * e2 ** 3 / 3072) * Math.sin(6 * φ));
  const x = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  let y = k0 * (M + N * Math.tan(φ) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [x, y + 10000000];
}
function area(pts){ if (pts.length < 3) return 0; const z = fuso(pts[0].lng), p = pts.map(q => utm(q.lat, q.lng, z));
  let s = 0; for (let i = 0; i < p.length; i++){ const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s) / 2; }
const txtD = m => m >= 1000 ? `${fmt(m / 1000, m >= 100000 ? 0 : 2)} km` : `${fmt(m, 0)} m`;
const txtA = m2 => { const ha = m2 / 1e4; return ha >= 100 ? `${fmt(ha, 0)} ha · ${fmt(ha / 100, 2)} km²` : ha >= 1 ? `${fmt(ha, 2)} ha` : `${fmt(m2, 0)} m² · ${fmt(ha, 3)} ha`; };
function gms(v, pos, neg){ const s = v < 0 ? neg : pos; v = Math.abs(v); const g = Math.floor(v), mf = (v - g) * 60, m = Math.floor(mf), se = (mf - m) * 60;
  return `${g}°${String(m).padStart(2, "0")}'${fmt(se, 1).padStart(4, "0")}" ${s}`; }

let mapa, grupo, tracos = [], modo = null, pts = [], linhaTemp = null, rotTemp = null, n = 0, barra;

function css(){
  document.head.insertAdjacentHTML("beforeend", `<style>
  .medir{background:var(--mata,#0e2219);border:1px solid var(--trilha,#2a5240);border-radius:12px;padding:4px;display:flex;flex-direction:column;gap:3px;box-shadow:0 4px 14px rgba(0,0,0,.35)}
  .medir button{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:var(--nevoa,#eef4ee);cursor:pointer}
  .medir button:hover{background:var(--dossel,#163326)} .medir button[aria-pressed=true]{background:var(--bf,#86b7ff);color:#0b1d33}
  .medir svg{width:19px;height:19px} .medir hr{border:0;border-top:1px solid var(--trilha,#2a5240);margin:2px 4px}
  .medir-dica{position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:900;background:var(--mata,#0e2219);color:var(--nevoa,#eef4ee);border:1px solid var(--bf,#86b7ff);
    border-radius:10px;padding:7px 12px;font-size:13.5px;display:flex;gap:10px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.4);max-width:calc(100% - 24px)}
  .medir-dica [hidden]{display:none}
  .medir-dica b{color:var(--bf,#86b7ff);font-variant-numeric:tabular-nums} .medir-dica button{border:1px solid var(--bf-esc,#5b93e6);background:transparent;color:var(--bf,#86b7ff);border-radius:8px;padding:4px 10px;cursor:pointer;font:inherit;font-size:12.5px;white-space:nowrap}
  .medir-dica button.pri{background:var(--bf,#86b7ff);color:#0b1d33;font-weight:700}
  .medir-rot{background:#0e2219e6!important;color:#fff!important;border:1px solid #86b7ff!important;border-radius:7px!important;font:600 12.5px system-ui,sans-serif!important;padding:2px 7px!important;box-shadow:none!important;white-space:nowrap}
  .medir-rot::before{display:none}
  .medindo .leaflet-container{cursor:crosshair} .medindo.leaflet-container{cursor:crosshair!important}
  .medindo .leaflet-pane:not(.leaflet-medida-pane) .leaflet-interactive,.medindo .leaflet-marker-pane > *,.medindo .leaflet-pane:not(.leaflet-medida-pane) canvas{pointer-events:none!important}
  .medir-pop{font:13.5px/1.45 system-ui,sans-serif;min-width:210px} .medir-pop b{display:block;font-size:14px;margin-bottom:3px}
  .medir-pop table{border-collapse:collapse;margin:2px 0 6px} .medir-pop td{padding:1px 8px 1px 0;vertical-align:top} .medir-pop td:first-child{color:#666}
  .medir-pop .ac{display:flex;gap:6px;flex-wrap:wrap} .medir-pop .ac button{font:inherit;font-size:12.5px;border:1px solid #9bb;border-radius:7px;background:#fff;padding:3px 8px;cursor:pointer}
  .medir-pop .ac button.del{color:#b3261e;border-color:#e3b0ab}
  </style>`);
}
const IC = {
  dist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>',
  area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l7-4 9 5-2 11-11 2z" fill="currentColor" fill-opacity=".18"/><circle cx="4" cy="7" r="1.6" fill="currentColor"/><circle cx="11" cy="3" r="1.6" fill="currentColor"/><circle cx="20" cy="8" r="1.6" fill="currentColor"/><circle cx="18" cy="19" r="1.6" fill="currentColor"/><circle cx="7" cy="21" r="1.6" fill="currentColor"/></svg>',
  ponto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></svg>',
  limpar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
};

function iniciar(m){
  mapa = m; css();
  mapa.createPane("medida").style.zIndex = 650;
  grupo = L.layerGroup().addTo(mapa);
  const Ctl = L.Control.extend({options:{position:"topright"}, onAdd(){
    const d = L.DomUtil.create("div", "medir leaflet-bar");
    d.innerHTML = `<button type="button" data-m="dist" title="Medir distância" aria-pressed="false">${IC.dist}</button>
      <button type="button" data-m="area" title="Medir área" aria-pressed="false">${IC.area}</button>
      <button type="button" data-m="ponto" title="Coordenada de um ponto" aria-pressed="false">${IC.ponto}</button><hr>
      <button type="button" data-limpar title="Apagar todas as medições">${IC.limpar}</button>`;
    L.DomEvent.disableClickPropagation(d); L.DomEvent.disableScrollPropagation(d);
    d.querySelectorAll("[data-m]").forEach(b => b.onclick = () => modo === b.dataset.m ? parar() : comecar(b.dataset.m));
    d.querySelector("[data-limpar]").onclick = () => { parar(); grupo.clearLayers(); tracos = []; };
    return barra = d; }});
  new Ctl().addTo(mapa);
  mapa.on("click", clique);
  mapa.on("mousemove", mover);
  mapa.on("dblclick", e => { if (modo === "dist" || modo === "area"){ L.DomEvent.stop(e); concluir(); } });
  document.addEventListener("keydown", e => {
    if (!modo || /input|textarea|select/i.test(document.activeElement?.tagName || "")) return;
    if (e.key === "Escape"){ e.preventDefault(); parar(); }
    else if (e.key === "Enter"){ e.preventDefault(); concluir(); }
    else if (e.key === "Backspace"){ e.preventDefault(); desfazer(); }
  });
}

// aviso no alto do mapa: criado uma vez por medição; só o texto e a visibilidade dos botões mudam (senão o botão some sob o clique)
function dica(on){
  let el = mapa.getContainer().querySelector(".medir-dica");
  if (!on){ el?.remove(); return null; }
  if (!el){
    el = L.DomUtil.create("div", "medir-dica", mapa.getContainer());
    el.innerHTML = `<span></span><button data-desf title="Backspace">Desfazer</button><button class="pri" data-ok title="Enter ou duplo clique">Concluir</button><button data-sair title="Esc">Cancelar</button>`;
    L.DomEvent.disableClickPropagation(el); L.DomEvent.on(el, "mousemove", L.DomEvent.stopPropagation);
    el.querySelector("[data-ok]").onclick = concluir; el.querySelector("[data-desf]").onclick = desfazer; el.querySelector("[data-sair]").onclick = parar;
  }
  return el;
}
function atualizarDica(extra){
  const el = dica(true), sp = el.querySelector("span");
  const ok = el.querySelector("[data-ok]"), desf = el.querySelector("[data-desf]"), sair = el.querySelector("[data-sair]");
  if (modo === "ponto"){ sp.textContent = "Clique no mapa para ver a coordenada"; ok.hidden = desf.hidden = true; sair.textContent = "Sair"; return; }
  const p = extra ? [...pts, extra] : pts;
  if (!pts.length) sp.textContent = modo === "dist" ? "Clique no mapa para começar a linha" : "Clique no mapa para marcar o primeiro vértice";
  else if (modo === "dist") sp.innerHTML = `Distância <b>${txtD(compr(p))}</b>`;
  else sp.innerHTML = p.length < 3 ? "Marque pelo menos 3 vértices" : `Área <b>${txtA(area(p))}</b> · perímetro <b>${txtD(compr(p, true))}</b>`;
  desf.hidden = !pts.length; ok.hidden = !(modo === "dist" ? pts.length >= 2 : pts.length >= 3); sair.textContent = "Cancelar";
}

function comecar(m){
  parar(); modo = m; pts = [];
  barra.querySelectorAll("[data-m]").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === m));
  mapa.getContainer().classList.add("medindo"); mapa.doubleClickZoom.disable();
  atualizarDica();
}
function parar(){
  if (linhaTemp){ mapa.removeLayer(linhaTemp); linhaTemp = null; }
  if (rotTemp){ mapa.removeLayer(rotTemp); rotTemp = null; }
  if (modo){ mapa.getContainer().classList.remove("medindo"); mapa.doubleClickZoom.enable(); }
  modo = null; pts = []; dica(false);
  barra?.querySelectorAll("[data-m]").forEach(b => b.setAttribute("aria-pressed", "false"));
}
function desfazer(){ if (!pts.length) return; pts.pop(); redesenharTemp(); atualizarDica(); }

function clique(e){
  if (!modo) return;
  if (modo === "ponto"){ marcarPonto(e.latlng); return; }
  const u = pts[pts.length - 1];
  if (u && mapa.latLngToContainerPoint(u).distanceTo(e.containerPoint) < 4) return;   // duplo clique repete o ponto
  if (modo === "area" && pts.length >= 3 && mapa.latLngToContainerPoint(pts[0]).distanceTo(e.containerPoint) < 10) return concluir();
  pts.push(e.latlng); redesenharTemp(); atualizarDica();
}
function mover(e){ if ((modo === "dist" || modo === "area") && pts.length){ redesenharTemp(e.latlng); atualizarDica(e.latlng); } }
function redesenharTemp(cursor){
  const p = cursor ? [...pts, cursor] : pts;
  const est = {pane:"medida", color:"#86b7ff", weight:2.5, dashArray:"6 5", fillColor:"#86b7ff", fillOpacity:.15, interactive:false};
  if (linhaTemp) mapa.removeLayer(linhaTemp);
  linhaTemp = L.featureGroup([
    modo === "area" && p.length >= 3 ? L.polygon(p, est) : L.polyline(p, est),
    ...pts.map(q => L.circleMarker(q, {pane:"medida", radius:4, color:"#fff", weight:2, fillColor:"#2b6fd6", fillOpacity:1, interactive:false}))
  ]).addTo(mapa);
}

function concluir(){
  if (modo === "dist" && pts.length >= 2) guardar("dist", pts.slice());
  else if (modo === "area" && pts.length >= 3) guardar("area", pts.slice());
  else return;
  const m = modo; parar(); comecar(m);   // continua no mesmo modo para a próxima medição
}

function guardar(tipo, p){
  const id = ++n, est = {pane:"medida", color:"#ffd166", weight:3, fillColor:"#ffd166", fillOpacity:.18};
  const forma = tipo === "area" ? L.polygon(p, est) : L.polyline(p, est);
  const vert = p.map(q => L.circleMarker(q, {pane:"medida", radius:3.5, color:"#0e2219", weight:1.5, fillColor:"#ffd166", fillOpacity:1, interactive:false}));
  const valor = tipo === "area" ? txtA(area(p)) : txtD(compr(p));
  const pos = tipo === "area" ? forma.getBounds().getCenter() : p[p.length - 1];
  const rot = L.tooltip({permanent:true, direction: tipo === "area" ? "center" : "right", className:"medir-rot", offset: tipo === "area" ? [0, 0] : [8, 0], pane:"medida"}).setLatLng(pos).setContent(valor);
  const g = L.featureGroup([forma, ...vert, rot]).addTo(grupo);
  const t = {id, tipo, p, g}; tracos.push(t);
  forma.on("click", ev => { L.DomEvent.stop(ev); if (modo) return clique(ev); popup(t, ev.latlng); });
}

function popup(t, ll){
  const linhas = t.tipo === "area"
    ? [["Área", txtA(area(t.p))], ["Perímetro", txtD(compr(t.p, true))], ["Vértices", t.p.length], ["Cálculo", `UTM ${fuso(t.p[0].lng)}S · SIRGAS 2000`]]
    : [["Comprimento", txtD(compr(t.p))], ["Trechos", t.p.slice(1).map((q, i) => txtD(dist(t.p[i], q))).join(" + ")], ["Vértices", t.p.length]];
  const nome = t.tipo === "area" ? `Área medida ${t.id}` : `Distância medida ${t.id}`;
  const pp = L.popup({maxWidth:320}).setLatLng(ll).setContent(`<div class="medir-pop"><b>${nome}</b><table>${linhas.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>
    <div class="ac"><button data-kml>Baixar KML</button><button data-gj>Baixar GeoJSON</button><button class="del" data-del>Apagar</button></div></div>`).openOn(mapa);
  const el = pp.getElement();
  el.querySelector("[data-kml]").onclick = () => baixar(t, "kml");
  el.querySelector("[data-gj]").onclick = () => baixar(t, "geojson");
  el.querySelector("[data-del]").onclick = () => { grupo.removeLayer(t.g); tracos = tracos.filter(x => x !== t); mapa.closePopup(); };
}

function marcarPonto(ll){
  const z = fuso(ll.lng), [x, y] = utm(ll.lat, ll.lng, z), id = ++n;
  const mk = L.circleMarker(ll, {pane:"medida", radius:6, color:"#0e2219", weight:2, fillColor:"#ffd166", fillOpacity:1});
  const g = L.featureGroup([mk]).addTo(grupo); const t = {id, tipo:"ponto", p:[ll], g}; tracos.push(t);
  const html = `<div class="medir-pop"><b>Ponto ${id}</b><table>
    <tr><td>Decimal</td><td>${fmt(ll.lat, 6)}, ${fmt(ll.lng, 6)}</td></tr>
    <tr><td>GMS</td><td>${gms(ll.lat, "N", "S")}<br>${gms(ll.lng, "L", "O")}</td></tr>
    <tr><td>UTM</td><td>${z}S · E ${fmt(x, 0)} · N ${fmt(y, 0)}</td></tr></table>
    <div class="ac"><button data-cp>Copiar decimal</button><button class="del" data-del>Apagar</button></div></div>`;
  mk.bindPopup(html, {maxWidth:300}).on("popupopen", ev => { const el = ev.popup.getElement();
    el.querySelector("[data-cp]").onclick = () => navigator.clipboard?.writeText(`${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`);
    el.querySelector("[data-del]").onclick = () => { grupo.removeLayer(g); tracos = tracos.filter(x => x !== t); }; }).openPopup();
}

function baixar(t, fmtArq){
  const coords = t.p.map(q => [+q.lng.toFixed(7), +q.lat.toFixed(7)]);
  const nome = t.tipo === "area" ? `area_medida_${t.id}` : `distancia_medida_${t.id}`;
  const props = t.tipo === "area" ? {nome, area_ha: +(area(t.p) / 1e4).toFixed(4), perimetro_m: Math.round(compr(t.p, true))} : {nome, comprimento_m: Math.round(compr(t.p))};
  let txt, mime;
  if (fmtArq === "geojson"){
    const geom = t.tipo === "area" ? {type:"Polygon", coordinates:[[...coords, coords[0]]]} : {type:"LineString", coordinates: coords};
    txt = JSON.stringify({type:"FeatureCollection", features:[{type:"Feature", properties: props, geometry: geom}]}); mime = "application/geo+json";
  } else {
    const c = (t.tipo === "area" ? [...coords, coords[0]] : coords).map(([x, y]) => `${x},${y},0`).join(" ");
    const geom = t.tipo === "area" ? `<Polygon><outerBoundaryIs><LinearRing><coordinates>${c}</coordinates></LinearRing></outerBoundaryIs></Polygon>` : `<LineString><coordinates>${c}</coordinates></LineString>`;
    txt = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${nome}</name><Placemark><name>${nome}</name>
<ExtendedData>${Object.entries(props).map(([k, v]) => `<Data name="${k}"><value>${v}</value></Data>`).join("")}</ExtendedData>${geom}</Placemark></Document></kml>`;
    mime = "application/vnd.google-earth.kml+xml";
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], {type: mime})); a.download = `${nome}.${fmtArq}`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// áreas desenhadas, para a exportação recortar por elas (GeoJSON Polygon, lon/lat)
function areas(){ return tracos.filter(t => t.tipo === "area").map(t => { const c = t.p.map(q => [q.lng, q.lat]);
  return {id: t.id, nome: `Área medida ${t.id}`, ha: area(t.p) / 1e4, geometry: {type:"Polygon", coordinates:[[...c, c[0]]]}}; }); }
window.Medir = {iniciar, ativo: () => !!modo, areas, _area: area, _compr: compr};
})();
