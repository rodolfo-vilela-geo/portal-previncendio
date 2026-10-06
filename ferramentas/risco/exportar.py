import geopandas as gpd, pandas as pd, numpy as np, json, math
from shapely.ops import unary_union
d=gpd.read_file("serra_do_cabral_risco.gpkg")
CL={"sem combustível":0,"baixa":1,"moderada":2,"alta":3,"muito alta":4}; CF={"baixa":0,"média":1,"alta":2}
ROT=["vizinhança com queimas frequentes","cerrado (savana)","campo","campo rupestre / afloramento","pastagem","mosaico de usos","floresta","silvicultura",
     "distância de área urbana","distância de uso antrópico","distância de água","altitude","declividade","encosta voltada ao norte","vegetação seca na estiagem"]
def cod(txt):
    out=[]
    for t in (txt or "").split("; "):
        if t in ROT: out.append(str(ROT.index(t)))
    return ",".join(out)
d=d.sort_values("id")
s=152.0; Q=5000
minx,miny,maxx,maxy=d.total_bounds
quads=[]
# caixa de cada quadrante a partir do NOME (coluna/linha de grade.py); origem = meio do intervalo compatível com todas as células
cxs=d.geometry.centroid.x.values; cys=d.geometry.centroid.y.values
cc=np.array([ord(n[0])-65 for n in d.quadrante]); ll=np.array([int(n[1:])-1 for n in d.quadrante])
X0=((cxs-(cc+1)*Q).max()+(cxs-cc*Q).min())/2; Y1=((cys+ll*Q).max()+(cys+(ll+1)*Q).min())/2
for n in sorted(d.quadrante.unique()):
    c=ord(n[0])-65; l=int(n[1:])-1
    quads.append({"n":n,"x0":round(X0+c*Q,1),"x1":round(X0+(c+1)*Q,1),"y1":round(Y1-l*Q,1),"y0":round(Y1-(l+1)*Q,1)})
bx=d[d.confianca=="baixa"]
bc=unary_union(bx.geometry.buffer(1)).simplify(40) if len(bx) else None
bcg=json.loads(gpd.GeoSeries([bc],crs=d.crs).to_crs("EPSG:4326").to_json())["features"][0]["geometry"] if bc else None
def arred(o):
    if isinstance(o,list): return [arred(x) for x in o]
    return round(o,5) if isinstance(o,float) else o
if bcg: bcg["coordinates"]=arred(bcg["coordinates"])
tot=d.groupby("classe").agg(n=("id","size"),q=("y_val","sum"))
estat={c:{"pct_area":round(100*r.n/len(d),1),"pct_queimado_2023_2025":round(100*r.q/d.y_val.sum(),1)} for c,r in tot.iterrows()}
dados={"grade":{"epsg":31983,"zona":23,"sul":True,"lado_m":s,"id":"linha*100000+coluna; y=linha*1.5*lado; x=coluna*sqrt(3)*lado (+meia largura nas linhas ímpares)"},
 "classes":["sem combustível","baixa","moderada","alta","muito alta"],"confianca":["menor","média","alta"],"motivos":ROT,
 "quadrantes":quads,"baixa_confianca":bcg,
 "cel":{"id":d.id.astype(int).tolist(),"c":[CL[x] for x in d.classe],"k":[CF[x] for x in d.confianca],"a":d.anos_q.astype(int).tolist(),"m":[cod(x) for x in d.motivos.fillna("")]}}
metodo={"titulo":"Mapa de risco · protótipo","area":"UC + faixa de 5 km + zona de amortecimento","celula_ha":6,
 "historico":"BDG 2013–2025 (célula queimada quando a cicatriz cobre ≥10%)","calibracao":"2013–2022","conferencia":"2023–2025",
 "variaveis":"recorrência na vizinhança, uso e cobertura (MapBiomas col. 9, 2023), altitude, declividade, face da encosta, NDVI da seca (Sentinel-2), distâncias a área urbana, uso antrópico e água",
 "auc_area":0.91,"auc_uc":0.79,"classes":estat,
 "resumo":"Alta + muito alta: %.0f%% da área e %.0f%% do que queimou em 2023–2025."%(estat["alta"]["pct_area"]+estat["muito alta"]["pct_area"],estat["alta"]["pct_queimado_2023_2025"]+estat["muito alta"]["pct_queimado_2023_2025"])}
out={"formato":"colibri-risco-1","nome_uc":"Serra do Cabral","versao":"2026-10-06 · protótipo v2","metodo":metodo,"dados":dados}
open("importar/MAPA_RISCO_serra_do_cabral.json","w").write(json.dumps(out,ensure_ascii=False,separators=(",",":")))
print(metodo["resumo"], len(d), "células")
