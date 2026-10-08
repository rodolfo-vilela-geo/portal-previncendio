// Saídas georreferenciadas geradas no navegador, sem servidor:
//   GeoSaida.shapefileZip(camadas)  -> Uint8Array (.zip com .shp/.shx/.dbf/.prj/.cpg por camada e tipo de geometria + campos.txt)
//   GeoSaida.geopackage(camadas)    -> Promise<Uint8Array> (.gpkg, uma tabela por camada e tipo de geometria; usa lib/sqljs)
// camadas: [{nome, feicoes:[{geometry (GeoJSON, lon/lat SIRGAS 2000), props:{...}}]}]
// Shapefile: especificação pública da Esri (1998). Limites do formato: um tipo de geometria por arquivo, nomes de campo
// com até 10 caracteres (o campos.txt traz o nome completo) e textos com até 254 bytes.
(function(){
const PRJ = 'GEOGCS["GCS_SIRGAS_2000",DATUM["D_SIRGAS_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
const WKT_GPKG = 'GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4674"]]';
const te = new TextEncoder();
const semAcento = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = s => semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "camada";
const FAM = {Point:"pontos", MultiPoint:"pontos", LineString:"linhas", MultiLineString:"linhas", Polygon:"poligonos", MultiPolygon:"poligonos"};

// separa cada camada por família de geometria e normaliza para multi-partes
function grupos(camadas){
  const out = [];
  for (const c of camadas){
    const por = {};
    for (const f of c.feicoes){
      const g = f.geometry, fam = g && FAM[g.type]; if (!fam) continue;
      const partes = g.type === "Point" ? [g.coordinates] : g.type === "MultiPoint" ? g.coordinates
        : g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates
        : g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      (por[fam] ||= []).push({partes, props: f.props || {}});
    }
    const fams = Object.keys(por);
    fams.forEach(fam => out.push({nome: fams.length > 1 ? `${slug(c.nome)}_${fam}` : slug(c.nome), titulo: c.nome, fam, itens: por[fam]}));
  }
  // nomes únicos
  const vistos = {}; out.forEach(g => { let n = g.nome, i = 2; while (vistos[n]) n = `${g.nome}_${i++}`; vistos[n] = 1; g.nome = n; });
  return out;
}
function tipoCampo(vals){
  const v = vals.filter(x => x !== null && x !== undefined && x !== "");
  if (v.length && v.every(x => typeof x === "number" && Number.isInteger(x))) return "int";
  if (v.length && v.every(x => typeof x === "number")) return "real";
  return "txt";
}
const valor = x => x === undefined || x === "" ? null : typeof x === "boolean" ? (x ? "Sim" : "Não") : Array.isArray(x) ? x.join(", ") : typeof x === "object" && x !== null ? JSON.stringify(x) : x;
const caixa = pts => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
const area2 = r => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s; }; // >0 = anti-horário

/* ============================ SHAPEFILE ============================ */
function shp(g){
  const tipo = g.fam === "pontos" ? 1 : g.fam === "linhas" ? 3 : 5;
  // conteúdo de cada registro
  const recs = g.itens.map(it => {
    if (tipo === 1){ const [x, y] = it.partes[0]; const b = new DataView(new ArrayBuffer(20)); b.setInt32(0, 1, true); b.setFloat64(4, x, true); b.setFloat64(12, y, true); return {buf: b, cx: [x, y, x, y]}; }
    // linhas: partes = [linha...]; polígonos: anéis com externo horário e buracos anti-horário (regra do shapefile)
    const aneis = tipo === 3 ? it.partes : it.partes.flatMap(p => p.map((r, i) => { const fech = r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r;
      const anti = area2(fech) > 0; return (i === 0) === anti ? fech.slice().reverse() : fech; }));
    const pts = aneis.flat(), cx = caixa(pts);
    const b = new DataView(new ArrayBuffer(44 + 4 * aneis.length + 16 * pts.length));
    b.setInt32(0, tipo, true); cx.forEach((v, i) => b.setFloat64(4 + 8 * i, v, true));
    b.setInt32(36, aneis.length, true); b.setInt32(40, pts.length, true);
    let o = 44, k = 0; aneis.forEach(a => { b.setInt32(o, k, true); o += 4; k += a.length; });
    pts.forEach(([x, y]) => { b.setFloat64(o, x, true); b.setFloat64(o + 8, y, true); o += 16; });
    return {buf: b, cx};
  });
  const cxT = recs.reduce((b, r) => [Math.min(b[0], r.cx[0]), Math.min(b[1], r.cx[1]), Math.max(b[2], r.cx[2]), Math.max(b[3], r.cx[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  const cab = (tamBytes) => { const h = new DataView(new ArrayBuffer(100)); h.setInt32(0, 9994); h.setInt32(24, tamBytes / 2); h.setInt32(28, 1000, true); h.setInt32(32, tipo, true);
    cxT.forEach((v, i) => h.setFloat64(36 + 8 * i, isFinite(v) ? v : 0, true)); return new Uint8Array(h.buffer); };
  const tamShp = 100 + recs.reduce((s, r) => s + 8 + r.buf.byteLength, 0), tamShx = 100 + 8 * recs.length;
  const S = new Uint8Array(tamShp), X = new Uint8Array(tamShx);
  S.set(cab(tamShp)); X.set(cab(tamShx));
  let o = 100; const dx = new DataView(X.buffer);
  recs.forEach((r, i) => { const h = new DataView(S.buffer, o, 8); h.setInt32(0, i + 1); h.setInt32(4, r.buf.byteLength / 2);
    dx.setInt32(100 + 8 * i, o / 2); dx.setInt32(104 + 8 * i, r.buf.byteLength / 2);
    S.set(new Uint8Array(r.buf.buffer), o + 8); o += 8 + r.buf.byteLength; });
  return {shp: S, shx: X};
}
// corta texto UTF-8 em n bytes sem quebrar caractere
function bytes(s, n){ let b = te.encode(s); if (b.length <= n) return b; let k = n; while (k > 0 && (b[k] & 0xC0) === 0x80) k--; return b.slice(0, k); }
function dbf(g){
  const chaves = [...new Set(g.itens.flatMap(it => Object.keys(it.props)))];
  const usados = new Set(), campos = chaves.map(k => {
    let n = semAcento(k).toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 10) || "CAMPO", i = 1;
    while (usados.has(n)){ const suf = String(i++); n = n.slice(0, 10 - suf.length) + suf; } usados.add(n);
    const vals = g.itens.map(it => valor(it.props[k])), t = tipoCampo(vals);
    const tam = t === "txt" ? Math.min(254, Math.max(1, ...vals.map(v => v == null ? 0 : te.encode(String(v)).length))) : t === "int" ? 18 : 24;
    return {k, n, t, tam, dec: t === "real" ? 8 : 0};
  });
  const tamReg = 1 + campos.reduce((s, c) => s + c.tam, 0), tamCab = 32 + 32 * campos.length + 1;
  const out = new Uint8Array(tamCab + tamReg * g.itens.length + 1), d = new DataView(out.buffer), hoje = new Date();
  out[0] = 3; out[1] = hoje.getFullYear() - 1900; out[2] = hoje.getMonth() + 1; out[3] = hoje.getDate();
  d.setUint32(4, g.itens.length, true); d.setUint16(8, tamCab, true); d.setUint16(10, tamReg, true); out[29] = 0x57; // LDID (o .cpg diz UTF-8)
  campos.forEach((c, i) => { const o = 32 + 32 * i; out.set(te.encode(c.n), o); out[o + 11] = (c.t === "txt" ? "C" : "N").charCodeAt(0); out[o + 16] = c.tam; out[o + 17] = c.dec; });
  out[tamCab - 1] = 0x0D;
  let o = tamCab;
  g.itens.forEach(it => {
    out[o] = 0x20; let p = o + 1;
    campos.forEach(c => {
      const v = valor(it.props[c.k]); out.fill(0x20, p, p + c.tam);
      if (v != null){
        if (c.t === "txt") out.set(bytes(String(v), c.tam), p);
        else { const s = (c.t === "int" ? String(Math.round(v)) : Number(v).toFixed(c.dec)).slice(0, c.tam); out.set(te.encode(s.padStart(c.tam)), p); }
      }
      p += c.tam;
    });
    o += tamReg;
  });
  out[out.length - 1] = 0x1A;
  return {dbf: out, campos};
}

/* ============================ ZIP (sem compressão) ============================ */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(arqs){   // [{nome, dados: Uint8Array}]
  const partes = [], central = []; let o = 0;
  const agora = new Date(), dt = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate(), hr = (agora.getHours() << 11) | (agora.getMinutes() << 5);
  for (const a of arqs){
    const nm = te.encode(a.nome), crc = crc32(a.dados), L = new DataView(new ArrayBuffer(30));
    L.setUint32(0, 0x04034b50, true); L.setUint16(4, 20, true); L.setUint16(6, 0x0800, true); L.setUint16(8, 0, true);
    L.setUint16(10, hr, true); L.setUint16(12, dt, true); L.setUint32(14, crc, true); L.setUint32(18, a.dados.length, true); L.setUint32(22, a.dados.length, true);
    L.setUint16(26, nm.length, true);
    partes.push(new Uint8Array(L.buffer), nm, a.dados);
    const C = new DataView(new ArrayBuffer(46));
    C.setUint32(0, 0x02014b50, true); C.setUint16(4, 20, true); C.setUint16(6, 20, true); C.setUint16(8, 0x0800, true);
    C.setUint16(12, hr, true); C.setUint16(14, dt, true); C.setUint32(16, crc, true); C.setUint32(20, a.dados.length, true); C.setUint32(24, a.dados.length, true);
    C.setUint16(28, nm.length, true); C.setUint32(42, o, true);
    central.push(new Uint8Array(C.buffer), nm);
    o += 30 + nm.length + a.dados.length;
  }
  const tamC = central.reduce((s, b) => s + b.length, 0), E = new DataView(new ArrayBuffer(22));
  E.setUint32(0, 0x06054b50, true); E.setUint16(8, arqs.length, true); E.setUint16(10, arqs.length, true); E.setUint32(12, tamC, true); E.setUint32(16, o, true);
  const tudo = [...partes, ...central, new Uint8Array(E.buffer)], out = new Uint8Array(tudo.reduce((s, b) => s + b.length, 0));
  let p = 0; tudo.forEach(b => { out.set(b, p); p += b.length; }); return out;
}

function shapefileZip(camadas){
  const arqs = [], dic = ["Colibri · exportação em Shapefile (SIRGAS 2000, EPSG:4674, coordenadas em graus).",
    "Cada camada tem um arquivo por tipo de geometria. Nomes de campo do Shapefile têm no máximo 10 caracteres:", ""];
  for (const g of grupos(camadas)){
    const {shp: S, shx: X} = shp(g), {dbf: D, campos} = dbf(g);
    arqs.push({nome: g.nome + ".shp", dados: S}, {nome: g.nome + ".shx", dados: X}, {nome: g.nome + ".dbf", dados: D},
      {nome: g.nome + ".prj", dados: te.encode(PRJ)}, {nome: g.nome + ".cpg", dados: te.encode("UTF-8")});
    dic.push(`${g.nome}  (${g.titulo} · ${g.fam} · ${g.itens.length} feições)`, ...campos.map(c => `   ${c.n.padEnd(10)}  ${c.k}`), "");
  }
  arqs.push({nome: "campos.txt", dados: te.encode(dic.join("\r\n"))});
  return zip(arqs);
}

/* ============================ GEOPACKAGE ============================ */
let SQL = null;
async function sqljs(){
  if (SQL) return SQL;
  if (!window.initSqlJs) await new Promise((ok, falha) => { const s = document.createElement("script"); s.src = "lib/sqljs/sql-wasm.js";
    s.onload = ok; s.onerror = () => falha(new Error("Não foi possível carregar o gerador de GeoPackage.")); document.head.appendChild(s); });
  return SQL = await initSqlJs({locateFile: f => "lib/sqljs/" + f});
}
// GeoPackage binary header + WKB (MultiPoint 4 / MultiLineString 5 / MultiPolygon 6), little endian
function gpkgGeom(fam, partes){
  const pts = fam === "pontos" ? partes : fam === "linhas" ? partes.flat() : partes.flat(2), cx = caixa(pts);
  const tam = fam === "pontos" ? 9 + partes.length * 21 : fam === "linhas" ? 9 + partes.reduce((s, l) => s + 9 + 16 * l.length, 0)
    : 9 + partes.reduce((s, p) => s + 9 + p.reduce((t, r) => t + 4 + 16 * r.length, 0), 0);
  const d = new DataView(new ArrayBuffer(40 + tam)); let o = 0;
  d.setUint8(o++, 0x47); d.setUint8(o++, 0x50); d.setUint8(o++, 0); d.setUint8(o++, 0b11); d.setInt32(o, 4674, true); o += 4;
  [cx[0], cx[2], cx[1], cx[3]].forEach(v => { d.setFloat64(o, v, true); o += 8; });
  const u8 = v => d.setUint8(o++, v), u32 = v => { d.setUint32(o, v, true); o += 4; }, xy = ([x, y]) => { d.setFloat64(o, x, true); d.setFloat64(o + 8, y, true); o += 16; };
  if (fam === "pontos"){ u8(1); u32(4); u32(partes.length); partes.forEach(p => { u8(1); u32(1); xy(p); }); }
  else if (fam === "linhas"){ u8(1); u32(5); u32(partes.length); partes.forEach(l => { u8(1); u32(2); u32(l.length); l.forEach(xy); }); }
  else { u8(1); u32(6); u32(partes.length); partes.forEach(p => { u8(1); u32(3); u32(p.length); p.forEach(r => { u32(r.length); r.forEach(xy); }); }); }
  return {blob: new Uint8Array(d.buffer), cx};
}
async function geopackage(camadas){
  const S = await sqljs(), db = new S.Database(), agora = new Date().toISOString().replace(/\.\d+Z$/, "Z"), q = s => `"${String(s).replace(/"/g, '""')}"`;
  db.run("PRAGMA application_id = 1196444487; PRAGMA user_version = 10200;");
  db.run(`CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL, srs_id INTEGER PRIMARY KEY, organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL, definition TEXT NOT NULL, description TEXT);
    CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE, description TEXT DEFAULT '', last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER);
    CREATE TABLE gpkg_geometry_columns (table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL, srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL, CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name));`);
  const ins = db.prepare("INSERT INTO gpkg_spatial_ref_sys VALUES (?,?,?,?,?,?)");
  ins.run(["Undefined cartesian SRS", -1, "NONE", -1, "undefined", null]); ins.run(["Undefined geographic SRS", 0, "NONE", 0, "undefined", null]);
  ins.run(["SIRGAS 2000", 4674, "EPSG", 4674, WKT_GPKG, null]); ins.free();
  const TIPO = {pontos:"MULTIPOINT", linhas:"MULTILINESTRING", poligonos:"MULTIPOLYGON"}, SQLT = {int:"INTEGER", real:"REAL", txt:"TEXT"};
  for (const g of grupos(camadas)){
    const chaves = [...new Set(g.itens.flatMap(it => Object.keys(it.props)))].filter(k => !/^(fid|geom)$/i.test(k));
    const tipos = Object.fromEntries(chaves.map(k => [k, SQLT[tipoCampo(g.itens.map(it => valor(it.props[k])))]]));
    db.run(`CREATE TABLE ${q(g.nome)} (fid INTEGER PRIMARY KEY AUTOINCREMENT, geom ${TIPO[g.fam]}${chaves.map(k => `, ${q(k)} ${tipos[k]}`).join("")})`);
    const st = db.prepare(`INSERT INTO ${q(g.nome)} (geom${chaves.map(k => ", " + q(k)).join("")}) VALUES (?${chaves.map(() => ",?").join("")})`);
    let cx = [Infinity, Infinity, -Infinity, -Infinity];
    g.itens.forEach(it => { const r = gpkgGeom(g.fam, it.partes); cx = [Math.min(cx[0], r.cx[0]), Math.min(cx[1], r.cx[1]), Math.max(cx[2], r.cx[2]), Math.max(cx[3], r.cx[3])];
      st.run([r.blob, ...chaves.map(k => valor(it.props[k]))]); });
    st.free();
    db.run("INSERT INTO gpkg_contents (table_name,data_type,identifier,description,last_change,min_x,min_y,max_x,max_y,srs_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [g.nome, "features", g.nome, g.titulo, agora, ...cx, 4674]);
    db.run("INSERT INTO gpkg_geometry_columns VALUES (?,?,?,?,0,0)", [g.nome, "geom", TIPO[g.fam], 4674]);
  }
  const out = db.export(); db.close(); return out;
}

window.GeoSaida = {shapefileZip, geopackage};
})();
