/* Camadas de referência (dados públicos do IDE-Sisema) para qualquer mapa do Colibri:
   rodovias e ferrovias de MG (dados/rodovias_mg.geojson, dados/ferrovias_mg.geojson; simplificados ~10 m).
   Desligadas por padrão; o arquivo só é baixado quando a camada é ligada.
   CamadasRef.adicionar(mapa, controle?) — põe "Rodovias" e "Ferrovias" no seletor de camadas do mapa
     (usa o controle L.control.layers informado ou cria um pequeno, recolhido).
   CamadasRef.dados(id) — promessa com o GeoJSON; CamadasRef.estilo(id, props); CamadasRef.rotulo(id, props); CamadasRef.legenda(id). */
(function(){
  const ARQ = {rodovias: "dados/rodovias_mg.geojson?v=20261014a", ferrovias: "dados/ferrovias_mg.geojson?v=20261014a"};
  const SUP = {DUP:"duplicada", PAV:"pavimentada", EOD:"em obras de duplicação", EOP:"em obras de pavimentação", IMP:"implantada (sem pavimento)", LEN:"leito natural", PLA:"planejada"};
  const cache = {};
  function dados(id){ return cache[id] ||= fetch(ARQ[id]).then(r => { if (!r.ok) throw new Error("Não foi possível carregar " + id + "."); return r.json(); }); }
  function estilo(id, p){
    if (id === "ferrovias") return {color:"#2b2b2b", weight:3, opacity:.9};
    switch (p.s){
      case "DUP": case "EOD": return {color:"#e8590c", weight:3.4, opacity:.95};
      case "PAV": return {color:"#f59f00", weight: p.a ? 1.6 : 2.4, opacity:.95};
      case "EOP": case "IMP": return {color:"#c08552", weight:1.8, opacity:.95, dashArray:"6 4"};
      case "LEN": return {color:"#c08552", weight:1.4, opacity:.9, dashArray:"2 4"};
      case "PLA": return {color:"#adb5bd", weight:1.2, opacity:.8, dashArray:"1 5"};
      default: return {color:"#f59f00", weight:2, opacity:.9};
    }
  }
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function rotulo(id, p){
    if (id === "ferrovias") return `<b>Ferrovia ${esc(p.e || "")}</b>${p.o ? " · " + esc(p.o) : ""}${p.b ? `<br>bitola ${esc(p.b.toLowerCase())}` : ""}`;
    return `<b>${esc(p.r)}</b> · ${esc(SUP[p.s] || p.s || "")}${p.a ? " · acesso" : ""}${p.i || p.f ? `<br>${esc(p.i || "?")} → ${esc(p.f || "?")}` : ""}${p.k ? ` (${String(p.k).replace(".", ",")} km)` : ""}`;
  }
  function legenda(id){
    if (id === "ferrovias") return [["#2b2b2b", "Ferrovia em operação", ""]];
    return [["#e8590c", "Duplicada", ""], ["#f59f00", "Pavimentada", ""], ["#c08552", "Sem pavimento / leito natural", "6 4"], ["#adb5bd", "Planejada", "1 5"]];
  }
  function camada(id, mapa){
    const g = L.layerGroup(); let feito = false;
    g.on("add", async () => {
      if (feito) return; feito = true;
      try{
        const d = await dados(id), rend = L.canvas({padding:.3, tolerance:6});
        // ferrovia: trilho escuro com dormentes brancos por cima
        L.geoJSON(d, {renderer: rend, style: f => estilo(id, f.properties), onEachFeature: (f, l) => l.bindTooltip(rotulo(id, f.properties), {sticky:true})}).addTo(g);
        if (id === "ferrovias") L.geoJSON(d, {renderer: rend, interactive:false, style: {color:"#ffffff", weight:1.4, opacity:.9, dashArray:"5 7"}}).addTo(g);
      }catch(e){ feito = false; if (window.msg) msg(e.message, "erro"); else console.error(e); }
    });
    return g;
  }
  function adicionar(mapa, controle){
    const r = camada("rodovias", mapa), f = camada("ferrovias", mapa);
    if (controle){ controle.addOverlay(r, "Rodovias (IDE-Sisema)"); controle.addOverlay(f, "Ferrovias (IDE-Sisema)"); }
    else L.control.layers(null, {"Rodovias (IDE-Sisema)": r, "Ferrovias (IDE-Sisema)": f}, {collapsed:true}).addTo(mapa);
    return {rodovias: r, ferrovias: f};
  }
  window.CamadasRef = {adicionar, dados, estilo, rotulo, legenda, SUP};
})();
