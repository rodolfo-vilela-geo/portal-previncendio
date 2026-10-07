// GeoPackage (OGC GeoPackage 1.2) gerado no navegador com sql.js (lib/sqljs, hospedado aqui).
// montarGPKG({camada, srid, polis, props, tabelas}) -> Uint8Array
//   polis: [[anel externo, buracos...], ...] em graus (x = lon, y = lat); uma feição por polígono, todas com os mesmos atributos (props)
//   tabelas: [{nome, descricao, linhas:[{...}]}] — tabelas de atributos sem geometria (ex.: empenho por dia)
(function(){
let SQL = null;
async function carregar(){
  if (SQL) return SQL;
  if (!window.initSqlJs) await new Promise((ok, falha) => { const s = document.createElement("script");
    s.src = "lib/sqljs/sql-wasm.js"; s.onload = ok; s.onerror = () => falha(new Error("não foi possível carregar o gerador de GeoPackage")); document.head.appendChild(s); });
  SQL = await initSqlJs({locateFile: f => "lib/sqljs/" + f});
  return SQL;
}
const SRS = {
  4674: ["SIRGAS 2000", 'GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4674"]]'],
  4326: ["WGS 84", 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]']
};
// cabeçalho GeoPackage + WKB MultiPolygon (little endian)
function geomBlob(p, srid){
  const pts = p.flat(); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  const wkb = 1 + 4 + 4 + (1 + 4 + 4) + p.reduce((s, a) => s + 4 + 16 * a.length, 0);
  const d = new DataView(new ArrayBuffer(8 + 32 + wkb)); let o = 0;
  d.setUint8(o++, 0x47); d.setUint8(o++, 0x50); d.setUint8(o++, 0); d.setUint8(o++, 0b00000011);   // "GP", versão 0, envelope xy, little endian
  d.setInt32(o, srid, true); o += 4;
  [x0, x1, y0, y1].forEach(v => { d.setFloat64(o, v, true); o += 8; });
  d.setUint8(o++, 1); d.setUint32(o, 6, true); o += 4; d.setUint32(o, 1, true); o += 4;           // MultiPolygon com 1 polígono
  d.setUint8(o++, 1); d.setUint32(o, 3, true); o += 4; d.setUint32(o, p.length, true); o += 4;
  p.forEach(a => { d.setUint32(o, a.length, true); o += 4; a.forEach(([x, y]) => { d.setFloat64(o, x, true); d.setFloat64(o + 8, y, true); o += 16; }); });
  return {blob: new Uint8Array(d.buffer), caixa: [x0, y0, x1, y1]};
}
const q = n => '"' + String(n).replace(/"/g, '""') + '"';
function tipo(vals){
  const v = vals.filter(x => x !== null && x !== undefined && x !== "");
  if (v.length && v.every(x => typeof x === "number" && Number.isInteger(x))) return "INTEGER";
  if (v.length && v.every(x => typeof x === "number")) return "REAL";
  return "TEXT";
}
const val = x => x === undefined || x === "" ? null : typeof x === "boolean" ? (x ? "Sim" : "Não") : x;

window.montarGPKG = async function({camada, srid = 4674, polis, props = {}, tabelas = [], descricao = ""}){
  const S = await carregar(), db = new S.Database(), agora = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  db.run("PRAGMA application_id = 1196444487; PRAGMA user_version = 10200;");
  db.run(`CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT NOT NULL, srs_id INTEGER PRIMARY KEY, organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL, definition TEXT NOT NULL, description TEXT);
    CREATE TABLE gpkg_contents (table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE, description TEXT DEFAULT '', last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER, CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id));
    CREATE TABLE gpkg_geometry_columns (table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL, srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL, CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name), CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name), CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys (srs_id));`);
  const ins = db.prepare("INSERT INTO gpkg_spatial_ref_sys VALUES (?,?,?,?,?,?)");
  ins.run(["Undefined cartesian SRS", -1, "NONE", -1, "undefined", null]); ins.run(["Undefined geographic SRS", 0, "NONE", 0, "undefined", null]);
  [4326, 4674].forEach(id => ins.run([SRS[id][0], id, "EPSG", id, SRS[id][1], null])); ins.free();
  // camada de polígonos
  const chaves = Object.keys(props);
  db.run(`CREATE TABLE ${q(camada)} (fid INTEGER PRIMARY KEY AUTOINCREMENT, geom MULTIPOLYGON${chaves.map(k => `, ${q(k)} ${tipo([props[k]])}`).join("")})`);
  const g = polis.map(p => geomBlob(p, srid));
  const st = db.prepare(`INSERT INTO ${q(camada)} (geom${chaves.map(k => ", " + q(k)).join("")}) VALUES (?${chaves.map(() => ",?").join("")})`);
  g.forEach(x => st.run([x.blob, ...chaves.map(k => val(props[k]))])); st.free();
  const cx = g.reduce((b, x) => [Math.min(b[0], x.caixa[0]), Math.min(b[1], x.caixa[1]), Math.max(b[2], x.caixa[2]), Math.max(b[3], x.caixa[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  db.run("INSERT INTO gpkg_contents (table_name,data_type,identifier,description,last_change,min_x,min_y,max_x,max_y,srs_id) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [camada, "features", camada, descricao, agora, ...cx, srid]);
  db.run("INSERT INTO gpkg_geometry_columns VALUES (?,?,?,?,0,0)", [camada, "geom", "MULTIPOLYGON", srid]);
  // tabelas sem geometria
  tabelas.forEach(t => {
    const cols = [...new Set(t.linhas.flatMap(l => Object.keys(l)))];
    db.run(`CREATE TABLE ${q(t.nome)} (id INTEGER PRIMARY KEY AUTOINCREMENT${cols.map(c => `, ${q(c)} ${tipo(t.linhas.map(l => l[c]))}`).join("")})`);
    if (cols.length){ const s2 = db.prepare(`INSERT INTO ${q(t.nome)} (${cols.map(q).join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
      t.linhas.forEach(l => s2.run(cols.map(c => val(l[c])))); s2.free(); }
    db.run("INSERT INTO gpkg_contents (table_name,data_type,identifier,description,last_change) VALUES (?,?,?,?,?)", [t.nome, "attributes", t.nome, t.descricao || "", agora]);
  });
  const out = db.export(); db.close(); return out;
};
})();
