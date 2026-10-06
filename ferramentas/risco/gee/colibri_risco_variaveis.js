/**********************************************************************
 * COLIBRI · Mapa de risco — extração das variáveis por célula
 * Piloto: PE Serra do Cabral (UC + faixa de 5 km)
 *
 * O que faz: para cada célula da grade (hexágonos de ~6 ha), calcula
 * uso e cobertura do solo (MapBiomas), relevo, verdor na seca (NDVI) e
 * distâncias a áreas urbanas e de uso antrópico. Exporta UMA tabela CSV
 * para o seu Google Drive. Nenhum raster é baixado.
 *
 * Histórico de fogo NÃO entra aqui: vem só do BDG 2013–2025 (já
 * calculado fora do GEE, por célula).
 **********************************************************************/

// ===== 1. AJUSTE AQUI =================================================
// Caminho do asset que você subiu (aba Assets > clique no asset > copie o "Table ID")
var CELULAS = ee.FeatureCollection('projects/SEU-PROJETO/assets/colibri/serra_do_cabral_celulas');
var NOME    = 'serra_do_cabral';            // usado no nome do arquivo exportado
var PASTA   = 'colibri';                    // pasta no Google Drive (é criada se não existir)

// MapBiomas (uso e cobertura). Se houver coleção mais nova, troque o caminho;
// o script usa sempre o ÚLTIMO ano disponível na coleção.
var MAPBIOMAS = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection9/mapbiomas_collection90_integration_v1');

// Anos para o NDVI da estação seca (jul–set)
var ANO_INI = 2022, ANO_FIM = 2025;
// ======================================================================

var area = CELULAS.geometry().bounds().buffer(2000);
var UTM  = ee.Projection('EPSG:31983').atScale(30);

// ---- 2. Uso e cobertura (último ano da coleção) ----------------------
var bandas = MAPBIOMAS.bandNames();
var ultima = ee.String(bandas.get(bandas.length().subtract(1)));
print('MapBiomas — banda usada:', ultima);
var uso = MAPBIOMAS.select(ultima).rename('classe');

// Grupos de classes (legenda MapBiomas, coleção 9)
function grupo(lista, nome){ return uso.remap(lista, ee.List.repeat(1, lista.length), 0).rename(nome); }
var g_floresta  = grupo([3, 5, 6, 49], 'p_floresta');          // formação florestal, mangue, alagável, restinga arbórea
var g_savana    = grupo([4], 'p_savana');                       // formação savânica (cerrado)
var g_campo     = grupo([12, 50, 11, 32], 'p_campo');           // campestre, restinga herbácea, área úmida, apicum
var g_rupestre  = grupo([29], 'p_afloramento');                 // afloramento rochoso (campo rupestre)
var g_pasto     = grupo([15], 'p_pastagem');
var g_agric     = grupo([18, 19, 39, 20, 40, 62, 41, 36, 46, 47, 35, 48], 'p_agricultura');
var g_silvi     = grupo([9], 'p_silvicultura');
var g_mosaico   = grupo([21], 'p_mosaico');
var g_urbano    = grupo([24], 'p_urbano');
var g_mineracao = grupo([30], 'p_mineracao');
var g_agua      = grupo([33, 31], 'p_agua');
var g_outros    = grupo([23, 25], 'p_nao_vegetado');

var usoPct = ee.Image.cat([g_floresta, g_savana, g_campo, g_rupestre, g_pasto, g_agric, g_silvi,
                           g_mosaico, g_urbano, g_mineracao, g_agua, g_outros]).multiply(100);

// ---- 3. Distâncias (m) -----------------------------------------------
function distancia(mascara, nome){
  return mascara.selfMask().unmask(0).reproject(UTM)
    .fastDistanceTransform(256).sqrt().multiply(30).rename(nome);
}
var antropico = uso.remap([15, 18, 19, 39, 20, 40, 62, 41, 36, 46, 47, 35, 48, 9, 21, 24, 30],
                          ee.List.repeat(1, 17), 0);
var dist = ee.Image.cat([
  distancia(uso.eq(24), 'd_urbano_m'),
  distancia(antropico, 'd_antropico_m'),
  distancia(uso.remap([33, 31], [1, 1], 0), 'd_agua_m')
]);

// ---- 4. Relevo (NASADEM, 30 m) ---------------------------------------
var dem = ee.Image('NASA/NASADEM_HGT/001').select('elevation');
var terr = ee.Terrain.products(dem);
var relevo = ee.Image.cat([
  dem.rename('altitude_m'),
  terr.select('slope').rename('declividade_graus'),
  terr.select('aspect').multiply(Math.PI / 180).cos().rename('face_norte'),   // 1 = face norte (mais seca), -1 = sul
]);

// ---- 5. NDVI da estação seca (Sentinel-2, jul–set) -------------------
function mascaraNuvem(img){
  var scl = img.select('SCL');
  var ok = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return img.updateMask(ok);
}
var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(area)
  .filter(ee.Filter.calendarRange(ANO_INI, ANO_FIM, 'year'))
  .filter(ee.Filter.calendarRange(7, 9, 'month'))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 40))
  .map(mascaraNuvem)
  .map(function(i){ return i.normalizedDifference(['B8', 'B4']).rename('ndvi_seca'); });
print('Cenas Sentinel-2 usadas no NDVI:', s2.size());
var ndvi = s2.median();

// ---- 6. Médias por célula --------------------------------------------
var pilha = ee.Image.cat([usoPct, dist, relevo, ndvi]).clip(area);

var tabela = pilha.reduceRegions({
  collection: CELULAS,
  reducer: ee.Reducer.mean(),
  scale: 30,
  crs: 'EPSG:31983',
  tileScale: 4
}).map(function(f){ return f.setGeometry(null); });

// Classe predominante por célula (moda)
var moda = uso.reduceRegions({collection: CELULAS, reducer: ee.Reducer.mode(), scale: 30, crs: 'EPSG:31983', tileScale: 4})
  .map(function(f){ return ee.Feature(null, {id: f.get('id'), classe_predominante: f.get('mode')}); });
var junta = ee.Join.inner().apply(tabela, moda, ee.Filter.equals({leftField: 'id', rightField: 'id'}))
  .map(function(p){ return ee.Feature(p.get('primary')).copyProperties(ee.Feature(p.get('secondary')), ['classe_predominante']); });

print('Exemplo (5 células):', junta.limit(5));

// ---- 7. Conferência visual -------------------------------------------
Map.centerObject(CELULAS, 11);
Map.addLayer(uso.clip(area), {min: 0, max: 62, palette: ['000000']}, 'MapBiomas (classe bruta)', false);
Map.addLayer(ndvi.clip(area), {min: 0, max: 0.8, palette: ['#8c510a', '#f6e8c3', '#5ab4ac', '#01665e']}, 'NDVI seca');
Map.addLayer(terr.select('slope').clip(area), {min: 0, max: 40}, 'Declividade', false);
Map.addLayer(ee.Image().byte().paint(CELULAS, 0, 1), {palette: '444444'}, 'Células', false);

// ---- 8. Exportação (aba Tasks > RUN) ---------------------------------
Export.table.toDrive({
  collection: junta,
  description: 'colibri_risco_' + NOME,
  folder: PASTA,
  fileNamePrefix: 'colibri_risco_' + NOME,
  fileFormat: 'CSV',
  selectors: ['id', 'quadrante', 'pct_uc', 'dist_uc_m', 'na_za', 'classe_predominante',
              'p_floresta', 'p_savana', 'p_campo', 'p_afloramento', 'p_pastagem', 'p_agricultura',
              'p_silvicultura', 'p_mosaico', 'p_urbano', 'p_mineracao', 'p_agua', 'p_nao_vegetado',
              'd_urbano_m', 'd_antropico_m', 'd_agua_m',
              'altitude_m', 'declividade_graus', 'face_norte', 'ndvi_seca']
});
