// Colibri · mapa de risco — funções comuns (grade hexagonal, conversão UTM, cores e camada Leaflet).
// Usado pelo módulo 6 (ucs.html → modulo_risco.js). Os dados vêm de uc_risco (células compactadas).
(function(){
const RAD = Math.PI / 180;
// UTM (SIRGAS 2000 / GRS80) -> [lat, lon]
function utmParaLL(x, y, zona, sul){
  const a = 6378137, f = 1/298.257222101, k0 = .9996, e2 = f*(2-f), ep2 = e2/(1-e2), e1 = (1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  x -= 500000; if (sul) y -= 10000000;
  const M = y/k0, mu = M/(a*(1-e2/4-3*e2*e2/64-5*e2**3/256));
  const p1 = mu + (3*e1/2-27*e1**3/32)*Math.sin(2*mu) + (21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu) + (151*e1**3/96)*Math.sin(6*mu) + (1097*e1**4/512)*Math.sin(8*mu);
  const s1 = Math.sin(p1), c1 = Math.cos(p1), t1 = Math.tan(p1), N1 = a/Math.sqrt(1-e2*s1*s1), R1 = a*(1-e2)/Math.pow(1-e2*s1*s1, 1.5);
  const C1 = ep2*c1*c1, T1 = t1*t1, D = x/(N1*k0);
  const lat = p1 - (N1*t1/R1)*(D*D/2 - (5+3*T1+10*C1-4*C1*C1-9*ep2)*D**4/24 + (61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*D**6/720);
  const lon = (D - (1+2*T1+C1)*D**3/6 + (5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*D**5/120)/c1;
  return [lat/RAD, (zona*6-183) + lon/RAD];
}
// [lat, lon] -> UTM (mesmo elipsoide)
function llParaUTM(lat, lon, zona){
  const a = 6378137, f = 1/298.257222101, k0 = .9996, e2 = f*(2-f), ep2 = e2/(1-e2);
  const fi = lat*RAD, la = lon*RAD, la0 = (zona*6-183)*RAD;
  const N = a/Math.sqrt(1-e2*Math.sin(fi)**2), T = Math.tan(fi)**2, C = ep2*Math.cos(fi)**2, A = Math.cos(fi)*(la-la0);
  const M = a*((1-e2/4-3*e2*e2/64-5*e2**3/256)*fi - (3*e2/8+3*e2*e2/32+45*e2**3/1024)*Math.sin(2*fi) + (15*e2*e2/256+45*e2**3/1024)*Math.sin(4*fi) - (35*e2**3/3072)*Math.sin(6*fi));
  const x = k0*N*(A + (1-T+C)*A**3/6 + (5-18*T+T*T+72*C-58*ep2)*A**5/120) + 500000;
  let y = k0*(M + N*Math.tan(fi)*(A*A/2 + (5-T+9*C+4*C*C)*A**4/24 + (61-58*T+T*T+600*C-330*ep2)*A**6/720));
  if (lat < 0) y += 10000000;
  return [x, y];
}
const COR  = ["#9aa3ad", "#f2efe3", "#f6c453", "#e8743b", "#b2182b"];
const NOME = ["Sem combustível", "Atenção baixa", "Atenção moderada", "Atenção alta", "Atenção muito alta"];
const CONF = ["menor — fora da UC, da ZA e da faixa de 3 km, onde o BDG registra pouco", "média — zona de amortecimento ou até 3 km", "alta — dentro da UC"];
const ANG = [0,1,2,3,4,5].map(i => (i*60 + 30) * RAD);

// centro UTM da célula a partir do id (linha*100000 + coluna)
function centro(id, s){ const w = Math.sqrt(3)*s, lin = Math.floor(id / 100000), col = id - lin*100000; return [col*w + (lin % 2 ? w/2 : 0), lin*1.5*s]; }
function vertices(id, s){ const [cx, cy] = centro(id, s); return ANG.map(t => [cx + s*Math.cos(t), cy + s*Math.sin(t)]); }
// id da célula que contém o ponto UTM
function idEm(x, y, s){
  const w = Math.sqrt(3)*s, r0 = Math.round(y/(1.5*s)); let best = null, bd = Infinity;
  for (let lin = r0-1; lin <= r0+1; lin++){ const off = lin % 2 ? w/2 : 0, c0 = Math.round((x-off)/w);
    for (let col = c0-1; col <= c0+1; col++){ const dx = col*w+off-x, dy = lin*1.5*s-y, dd = dx*dx+dy*dy; if (dd < bd){ bd = dd; best = lin*100000+col; } } }
  return best;
}
// quadrante (5 × 5 km; letra = coluna, número = linha N→S). Fora da lista (quadrante sem células), deduz o nome pela grade.
function quadranteDe(Q, x, y){
  const q = Q.find(q => x >= q.x0 && x < q.x1 && y >= q.y0 && y < q.y1); if (q || !Q.length) return q ? q.n : null;
  const r = Q[0], m = /^([A-Z])(\d+)$/.exec(r.n); if (!m) return null;
  const lado = r.x1 - r.x0, X0 = r.x0 - (m[1].charCodeAt(0) - 65) * lado, Y1 = r.y1 + (+m[2] - 1) * lado;
  const col = Math.floor((x - X0) / lado), lin = Math.floor((Y1 - y) / lado) + 1;
  return col >= 0 && col < 26 && lin >= 1 ? String.fromCharCode(65 + col) + lin : null;
}

// Camada Leaflet: células (canvas), quadrantes com nome e hachura de confiança menor.
// Devolve {camada, bounds, celula(latlng) -> índice | -1, quadrante(latlng)}
function camada(R){
  const g = R.dados.grade, c = R.dados.cel, s = g.lado_m, z = g.zona, sul = g.sul, Q = R.dados.quadrantes || [];
  const tela = L.canvas({padding:.5}), cel = L.layerGroup();
  for (let i = 0; i < c.id.length; i++){
    const cl = c.c[i], op = cl === 1 ? .35 : .72;
    L.polygon(vertices(c.id[i], s).map(([x, y]) => utmParaLL(x, y, z, sul)),
      {renderer: tela, color: COR[cl], weight: .8, opacity: op, fillColor: COR[cl], fillOpacity: op, interactive:false}).addTo(cel);
  }
  const quads = L.layerGroup(); let bounds = null;
  Q.forEach(q => { const p = [[q.x0,q.y0],[q.x1,q.y0],[q.x1,q.y1],[q.x0,q.y1]].map(([x, y]) => utmParaLL(x, y, z, sul));
    const b = L.latLngBounds(p); bounds = bounds ? bounds.extend(b) : b;
    L.polygon(p, {color:"#fff", weight:.8, opacity:.7, dashArray:"3 4", fill:false, interactive:false}).addTo(quads);
    L.tooltip({permanent:true, direction:"center", className:"rk-quad", interactive:false}).setLatLng(b.getCenter()).setContent(q.n).addTo(quads); });
  const partes = [cel, quads];
  if (R.dados.baixa_confianca){
    const svg = L.svg({padding:.5});
    const hach = L.geoJSON(R.dados.baixa_confianca, {renderer: svg, style:{color:"#ddd", weight:.6, fillOpacity:1, fillColor:"#000"}, interactive:false});
    hach.on("add", () => { const el = svg._container; if (el && !el.querySelector("#rkHach")){
        el.insertAdjacentHTML("afterbegin", `<defs><pattern id="rkHach" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="rgba(0,0,0,.15)"/><line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,255,255,.75)" stroke-width="2"/></pattern></defs>`); }
      hach.eachLayer(l => l._path && l._path.setAttribute("fill", "url(#rkHach)")); });
    partes.push(hach);
  }
  const porId = new Map(c.id.map((v, i) => [v, i]));
  return {
    camada: L.layerGroup(partes), bounds,
    celula(ll){ const [x, y] = llParaUTM(ll.lat, ll.lng, z); const id = idEm(x, y, s); return porId.has(id) ? porId.get(id) : -1; },
    quadrante(ll){ const [x, y] = llParaUTM(ll.lat, ll.lng, z); return quadranteDe(Q, x, y); }
  };
}

// Resumo por quadrante: células por classe, % em atenção alta/muito alta, anos queimados, motivo mais citado
function porQuadrante(R){
  const c = R.dados.cel, s = R.dados.grade.lado_m, Q = R.dados.quadrantes || [], mot = R.dados.motivos || [];
  const T = new Map(Q.map(q => [q.n, {n: q.n, total: 0, cl: [0,0,0,0,0], uc: 0, anos: 0, queimou: 0, mot: new Map()}]));
  for (let i = 0; i < c.id.length; i++){
    const [x, y] = centro(c.id[i], s), t = T.get(quadranteDe(Q, x, y)); if (!t) continue;
    t.total++; t.cl[c.c[i]]++; if (c.k[i] === 2) t.uc++; t.anos += c.a[i]; if (c.a[i]) t.queimou++;
    if (c.c[i] >= 3) (c.m[i] || "").split(",").filter(Boolean).forEach(k => t.mot.set(+k, (t.mot.get(+k) || 0) + 1));
  }
  return [...T.values()].filter(t => t.total).map(t => ({...t, atencao: (t.cl[3] + t.cl[4]) / t.total,
    motivos: [...t.mot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => mot[k])}));
}

window.RiscoMapa = {utmParaLL, llParaUTM, COR, NOME, CONF, centro, vertices, idEm, quadranteDe, camada, porQuadrante};
})();
