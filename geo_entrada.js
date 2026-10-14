/* Leitura de polígonos de arquivos no navegador (sem bibliotecas):
   KML, KMZ, GeoJSON e Shapefile (.zip com .shp/.dbf/.prj; .cpg opcional).
   GeoEntrada.poligonos(file) → [{nome, props, geom}] com geom = MultiPolygon GeoJSON [lon, lat] (SIRGAS 2000/WGS 84).
   Recusa coordenadas projetadas (UTM) e corrige latitude/longitude trocadas (caso visto em arquivos do IDE). */
(function(){
  const dentroMG = (lo, la) => la >= -23.5 && la <= -14 && lo >= -51.5 && lo <= -39.5;

  /* ---------- zip (stored ou deflate) ---------- */
  async function arquivosZip(buf){
    const dv = new DataView(buf), u8 = new Uint8Array(buf), td = new TextDecoder(), out = {};
    let e = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50){ e = i; break; }
    if (e < 0) throw new Error("Arquivo .zip inválido.");
    let p = dv.getUint32(e + 16, true);
    for (let k = 0, n = dv.getUint16(e + 10, true); k < n; k++){
      const met = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true), ln = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
      const nome = td.decode(u8.subarray(p + 46, p + 46 + ln));
      p += 46 + ln + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
      if (nome.endsWith("/") || /(^|\/)__MACOSX\//.test(nome)) continue;
      const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true), dados = u8.slice(ini, ini + tam);
      if (met === 0) out[nome] = dados;
      else if (met === 8){
        if (!window.DecompressionStream) throw new Error("Este navegador não abre arquivos .zip compactados. Atualize o navegador ou descompacte e envie o KML/GeoJSON.");
        out[nome] = new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      }
    }
    return out;
  }

  /* ---------- anéis → polígonos ---------- */
  const areaAssinada = r => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; };  // > 0 = horário
  function dentro(pt, r){ let d = false; const [x, y] = pt; for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; }
  // Shapefile: externo no sentido horário, buraco no anti-horário
  function montarPoligonos(aneis){
    const ext = [], buracos = [];
    aneis.filter(r => r.length >= 4).forEach(r => (areaAssinada(r) >= 0 ? ext : buracos).push(r));
    if (!ext.length) return buracos.map(r => [r.slice().reverse()]);   // arquivo com sentido invertido
    const polys = ext.map(r => [r]);
    buracos.forEach(h => { const alvo = polys.find(p => dentro(h[0], p[0])); if (alvo) alvo.push(h); else polys.push([h.slice().reverse()]); });
    return polys;
  }

  /* ---------- Shapefile ---------- */
  function lerSHP(u8){
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), tipo = dv.getInt32(32, true), out = [];
    if (![5, 15, 25].includes(tipo)) throw new Error("O Shapefile não é de polígonos (tipo " + tipo + ").");
    let p = 100;
    while (p + 8 <= u8.byteLength){
      const lenBytes = dv.getInt32(p + 4, false) * 2, r = p + 8, t = dv.getInt32(r, true);
      if (t === 0){ out.push(null); p = r + lenBytes; continue; }
      const nPartes = dv.getInt32(r + 36, true), nPts = dv.getInt32(r + 40, true), partes = [];
      for (let k = 0; k < nPartes; k++) partes.push(dv.getInt32(r + 44 + 4 * k, true));
      const base = r + 44 + 4 * nPartes, pts = [];
      for (let k = 0; k < nPts; k++) pts.push([dv.getFloat64(base + 16 * k, true), dv.getFloat64(base + 16 * k + 8, true)]);
      const aneis = partes.map((ini, k) => pts.slice(ini, k + 1 < nPartes ? partes[k + 1] : nPts));
      out.push(montarPoligonos(aneis));
      p = r + lenBytes;
    }
    return out;
  }
  function decodificador(cpg, amostra){
    const c = (cpg || "").trim().toLowerCase();
    if (/utf-?8/.test(c)) return new TextDecoder("utf-8");
    try{ new TextDecoder("utf-8", {fatal: true}).decode(amostra); return new TextDecoder("utf-8"); }   // muitos arquivos do IDE são UTF-8 sem dizer
    catch(_){ return new TextDecoder("latin1"); }
  }
  function lerDBF(u8, cpg){
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), n = dv.getUint32(4, true), hl = dv.getUint16(8, true), rl = dv.getUint16(10, true);
    const td = decodificador(cpg, u8.subarray(hl, Math.min(u8.byteLength, hl + rl * Math.min(n, 200)))), campos = [];
    for (let p = 32; p < hl - 1 && u8[p] !== 0x0d; p += 32){
      campos.push({nome: new TextDecoder("latin1").decode(u8.subarray(p, p + 11)).replace(/\0.*$/, "").trim(), tipo: String.fromCharCode(u8[p + 11]), tam: u8[p + 16]});
    }
    const regs = [];
    for (let k = 0; k < n; k++){
      let p = hl + k * rl + 1; const o = {};
      for (const c of campos){ let v = td.decode(u8.subarray(p, p + c.tam)).trim(); p += c.tam;
        if ((c.tipo === "N" || c.tipo === "F") && v !== "") v = Number(v); o[c.nome] = v === "" ? null : v; }
      regs.push(o);
    }
    return regs;
  }
  async function lerShapefileZip(buf){
    const arqs = await arquivosZip(buf), nomes = Object.keys(arqs);
    const shp = nomes.filter(n => /\.shp$/i.test(n));
    if (!shp.length) throw new Error("O .zip não tem arquivo .shp. Para KML ou GeoJSON, envie o arquivo direto.");
    const out = [], td = new TextDecoder();
    for (const s of shp){
      const raiz = s.replace(/\.shp$/i, ""), achar = ext => nomes.find(n => n.toLowerCase() === (raiz + ext).toLowerCase());
      const prj = achar(".prj") ? td.decode(arqs[achar(".prj")]) : "";
      if (/^\s*PROJCS/i.test(prj)) throw new Error("O Shapefile está em coordenadas projetadas (UTM). Exporte em coordenadas geográficas (SIRGAS 2000, EPSG:4674) e envie de novo.");
      const geoms = lerSHP(arqs[s]), dbf = achar(".dbf") ? lerDBF(arqs[achar(".dbf")], achar(".cpg") ? td.decode(arqs[achar(".cpg")]) : "") : [];
      geoms.forEach((g, i) => { if (g && g.length) out.push({props: dbf[i] || {}, coords: g}); });
    }
    return out;
  }

  /* ---------- KML / GeoJSON ---------- */
  function lerKML(txt){
    const xml = new DOMParser().parseFromString(txt, "application/xml");
    if (xml.getElementsByTagName("parsererror").length) throw new Error("Arquivo não reconhecido. Use KML, KMZ, GeoJSON ou Shapefile (.zip).");
    const tags = (el, n) => [...el.getElementsByTagNameNS("*", n)], out = [];
    const coords = s => (s || "").trim().split(/\s+/).map(t => t.split(",").map(Number)).filter(a => a.length >= 2 && isFinite(a[0]) && isFinite(a[1])).map(([lo, la]) => [lo, la]);
    tags(xml, "Placemark").forEach(pm => {
      const polys = tags(pm, "Polygon").map(pg => {
        const ext = tags(pg, "outerBoundaryIs").map(b => coords(tags(b, "coordinates")[0]?.textContent))[0] || [];
        const bur = tags(pg, "innerBoundaryIs").map(b => coords(tags(b, "coordinates")[0]?.textContent));
        return [ext, ...bur].filter(r => r.length >= 4);
      }).filter(p => p.length);
      if (!polys.length) return;
      const props = {};
      tags(pm, "SimpleData").forEach(d => props[d.getAttribute("name")] = d.textContent);
      tags(pm, "Data").forEach(d => props[d.getAttribute("name")] = tags(d, "value")[0]?.textContent ?? "");
      const nm = [...pm.children].find(c => c.localName === "name")?.textContent;
      if (nm) props.name = nm;
      out.push({props, coords: polys});
    });
    return out;
  }
  function lerGeoJSON(g){
    const out = [];
    const um = (gm, props) => { if (!gm) return;
      if (gm.type === "Polygon") out.push({props, coords: [gm.coordinates]});
      else if (gm.type === "MultiPolygon") out.push({props, coords: gm.coordinates});
      else if (gm.type === "GeometryCollection") gm.geometries.forEach(x => um(x, props)); };
    (g.type === "FeatureCollection" ? g.features : g.type === "Feature" ? [g] : [{geometry: g, properties: {}}]).forEach(f => um(f.geometry, f.properties || {}));
    return out;
  }

  /* ---------- entrada ---------- */
  const NOMES = ["nome", "name", "zona", "zoneamento", "setor", "descricao", "Name", "NOME", "ZONA", "SETOR"];
  async function poligonos(f){
    const n = f.name.toLowerCase();
    if (f.size > 30e6) throw new Error("Arquivo grande demais (máximo de 30 MB).");
    let feats;
    if (n.endsWith(".zip")) feats = await lerShapefileZip(await f.arrayBuffer());
    else if (n.endsWith(".kmz")){
      const arqs = await arquivosZip(await f.arrayBuffer()), k = Object.keys(arqs).find(x => /\.kml$/i.test(x));
      if (!k) throw new Error("O KMZ não contém um arquivo KML.");
      feats = lerKML(new TextDecoder().decode(arqs[k]));
    } else {
      const txt = await f.text();
      if (/\.(geo)?json$/.test(n) || /^\s*\{/.test(txt)){ try{ feats = lerGeoJSON(JSON.parse(txt)); }catch(_){ throw new Error("GeoJSON inválido."); } }
      else feats = lerKML(txt);
    }
    // limpa coordenadas (2D), corrige eixos trocados, confere se está em MG
    const pts = g => g.flat(2);
    feats.forEach(x => { x.coords = x.coords.map(p => p.map(r => r.map(c => [c[0], c[1]]))); });
    const todos = feats.flatMap(x => pts(x.coords));
    if (!todos.length) throw new Error("Nenhum polígono encontrado no arquivo.");
    const okNormal = todos.filter(([x, y]) => dentroMG(x, y)).length, okTrocado = todos.filter(([x, y]) => dentroMG(y, x)).length;
    let trocado = false;
    if (okNormal < todos.length * .9){
      if (okTrocado >= todos.length * .9){ trocado = true; feats.forEach(x => { x.coords = x.coords.map(p => p.map(r => r.map(([a, b]) => [b, a]))); }); }
      else throw new Error("O arquivo tem áreas fora de Minas Gerais ou em outro sistema de coordenadas. Exporte em coordenadas geográficas (SIRGAS 2000 ou WGS 84).");
    }
    const campo = feats.length ? NOMES.find(k => feats.some(x => x.props[k] != null && String(x.props[k]).trim() !== "")) : null;
    return {trocado, campoNome: campo, itens: feats.map((x, i) => ({nome: campo ? String(x.props[campo] ?? "").trim() : "", props: x.props, geom: {type: "MultiPolygon", coordinates: x.coords}}))};
  }
  window.GeoEntrada = {poligonos, _montarPoligonos: montarPoligonos};
})();
