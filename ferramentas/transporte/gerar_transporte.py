# Gera dados/rodovias_mg.geojson e dados/ferrovias_mg.geojson a partir das camadas públicas do IDE-Sisema
# (ide_0401_mg_rodovias_lin e ide_0402_mg_ferrovias_lin, descompactadas em raw/). Uso: python3 gerar_transporte.py gerar 0.0001
# Simplifica ~10 m (de 2,5 milhões para ~154 mil vértices), corrige acentos e troca campos vazios (NaN) por nulo.
import json, sys, pyogrio, warnings; warnings.filterwarnings("ignore")
from shapely.geometry import mapping
from shapely import force_2d, simplify
import math
def vaz(v): return v is None or (isinstance(v,float) and math.isnan(v)) or str(v).strip().lower() in ('','nan','none')
def fix(s):
    if vaz(s): return None
    s=str(s).strip()
    try: s=s.encode('latin1').decode('utf8')
    except Exception: pass
    return s or None
SUP={'DUP':'duplicada','PAV':'pavimentada','EOD':'em obras de duplicação','EOP':'em obras de pavimentação','IMP':'implantada (terra)','LEN':'leito natural','PLA':'planejada'}
def rnd(c): return [rnd(x) for x in c] if isinstance(c[0],(list,tuple)) else [round(c[0],5), round(c[1],5)]
def rod(tol):
    df=pyogrio.read_dataframe('raw/ide_0401_mg_rodovias_lin/ide_0401_mg_rodovias_lin.shp')
    fs=[]
    for _,r in df.iterrows():
        g=simplify(force_2d(r.geometry), tol, preserve_topology=False)
        if g.is_empty: continue
        pref='BR' if r['jurisdicao']=='Federal' else 'MG'
        cod=None if vaz(r['codigo_rod']) else str(r['codigo_rod']).strip().zfill(3)
        p={'r':f"{pref}-{cod}" if cod else ("Rodovia federal" if pref=='BR' else "Rodovia estadual"), 's':None if vaz(r['superficie']) else r['superficie'], 'a':1 if r['tipo_trech']=='Acesso' else 0,
           'i':fix(r['local_inic']), 'f':fix(r['local_fim']), 'k':None if vaz(r['extensao']) else round(float(r['extensao']),1)}
        fs.append({'type':'Feature','geometry':{'type':g.geom_type,'coordinates':rnd(mapping(g)['coordinates'])},'properties':p})
    return fs
def fer(tol):
    df=pyogrio.read_dataframe('raw/ide_0402_mg_ferrovias_lin/ide_0402_mg_ferrovias_lin.shp')
    fs=[]
    for _,r in df.iterrows():
        g=simplify(force_2d(r.geometry), tol, preserve_topology=False)
        if g.is_empty: continue
        fs.append({'type':'Feature','geometry':{'type':g.geom_type,'coordinates':rnd(mapping(g)['coordinates'])},
                   'properties':{'e':fix(r['sigla']),'o':fix(r['sigla_coin']) or fix(r['label']),'b':fix(r['bitola'])}})
    return fs
if sys.argv[1]=='teste':
    for tol in (0.00005,0.0001,0.0002):
        fs=rod(tol); s=json.dumps({'type':'FeatureCollection','features':fs},separators=(',',':'),ensure_ascii=False)
        n=sum(len(f['geometry']['coordinates']) if f['geometry']['type']=='LineString' else sum(map(len,f['geometry']['coordinates'])) for f in fs)
        print(tol, 'vértices', n, 'MB', round(len(s.encode())/1e6,2))
else:
    tol=float(sys.argv[2])
    for nome,fs in (('rodovias_mg', rod(tol)), ('ferrovias_mg', fer(tol))):
        json.dump({'type':'FeatureCollection','fonte':'IDE-Sisema (ide_0401_mg_rodovias_lin / ide_0402_mg_ferrovias_lin), simplificado','features':fs}, open(nome+'.geojson','w'), separators=(',',':'), ensure_ascii=False, allow_nan=False)
