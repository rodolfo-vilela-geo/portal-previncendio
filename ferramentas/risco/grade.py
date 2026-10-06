import geopandas as gpd, numpy as np, pandas as pd, math, json
from shapely.geometry import Polygon
from shapely.ops import unary_union
UTM="EPSG:31983"; UC="Parque Estadual da Serra do Cabral"; SLUG="serra_do_cabral"
ucs=gpd.read_file("ucs/ide_2010_mg_unidades_conservacao_estaduais_pol.shp")
uc=ucs[ucs.nome_uc==UC].to_crs(UTM); ucg=unary_union(uc.geometry).buffer(0)
import glob
z=gpd.read_file(glob.glob("za/**/*.shp",recursive=True)[0])
colz=[c for c in z.columns if c!="geometry" and z[c].astype(str).str.contains("Cabral",case=False).any()][0]
za=z[z[colz].astype(str).str.contains(UC.replace("Parque Estadual da ","").replace("Parque Estadual ",""),case=False)].to_crs(UTM)
zag=unary_union(za.geometry).buffer(0) if len(za) else None
# área de análise = faixa de 5 km UNIDA à zona de amortecimento (quando houver)
aoi=ucg.buffer(5000) if zag is None else unary_union([ucg.buffer(5000), zag])
print("ZA:", 0 if zag is None else round(zag.area/1e4), "ha | área de análise:", round(aoi.area/1e4), "ha")
# grade hexagonal ~6 ha (lado 152 m)
s=152.0; w=math.sqrt(3)*s; h=2*s
minx,miny,maxx,maxy=aoi.bounds
cells=[]; ids=[]
r0=int(math.floor(miny/(1.5*s)))-1; r1=int(math.ceil(maxy/(1.5*s)))+1
for row in range(r0,r1+1):
    y=row*1.5*s; off=(w/2 if row%2 else 0)
    c0=int(math.floor((minx-off)/w))-1; c1=int(math.ceil((maxx-off)/w))+1
    for colh in range(c0,c1+1):
        x=colh*w+off
        cells.append(Polygon([(x+s*math.cos(math.radians(a+30)), y+s*math.sin(math.radians(a+30))) for a in range(0,360,60)]))
        ids.append(row*100000+colh)
g=gpd.GeoDataFrame({"id":ids},geometry=cells,crs=UTM)
g=g[g.intersects(aoi)].reset_index(drop=True)
g["na_za"]=0 if zag is None else (g.geometry.centroid.within(zag)).astype(int)
g["area_ha"]=(g.geometry.intersection(aoi).area/1e4).round(2)
inter=g.geometry.intersection(ucg).area
g["pct_uc"]=(inter/g.geometry.area*100).round(1)
g["dist_uc_m"]=g.geometry.centroid.distance(ucg.boundary).round(0)
g.loc[g.pct_uc>=50,"dist_uc_m"]=0
# quadrantes 5 km (letra = coluna, número = linha de norte a sul)
Q=5000; cx=g.geometry.centroid.x; cy=g.geometry.centroid.y
col=((cx-minx)//Q).astype(int); lin=((maxy-cy)//Q).astype(int)
g["quadrante"]=[chr(65+c)+str(l+1) for c,l in zip(col,lin)]
# BDG: anos queimados por célula (cobertura >= 10% da célula)
b=gpd.read_file("bdg/pol_2013_2025_IA_v1/bdg_cicatrizes_2013_2025.shp").to_crs(UTM)
b=b[b.intersects(aoi)][["cod_bdp","ano","nome_uc","geometry"]]
b["geometry"]=b.geometry.buffer(0)
print("polígonos do BDG na área:",len(b), "UCs:", b.nome_uc.value_counts().to_dict())
anos=range(2013,2026)
cel=g[["id","geometry"]]
for a in anos:
    ba=b[b.ano.astype(int)==a]
    if len(ba)==0: g[f"q{a}"]=0; continue
    u=unary_union(ba.geometry)
    frac=cel.geometry.intersection(u).area/cel.geometry.area
    g[f"q{a}"]=(frac>=0.10).astype(int)
g["anos_q"]=g[[f"q{a}" for a in anos]].sum(axis=1)
g["anos_q_cal"]=g[[f"q{a}" for a in range(2013,2023)]].sum(axis=1)
g["anos_q_val"]=g[[f"q{a}" for a in range(2023,2026)]].sum(axis=1)
print("células:",len(g),"| dentro da UC (>=50%):",(g.pct_uc>=50).sum(),"| quadrantes:",g.quadrante.nunique())
print("distribuição de anos queimados:",g.anos_q.value_counts().sort_index().to_dict())
g.to_file(f"{SLUG}_celulas.gpkg",driver="GPKG")
# para o GEE: só id e geometria, em WGS84
ge=g[["id","quadrante","pct_uc","dist_uc_m","na_za","geometry"]].to_crs("EPSG:4326")
ge.to_file(f"gee/{SLUG}_celulas.shp")
gpd.GeoDataFrame(geometry=[aoi],crs=UTM).to_crs("EPSG:4326").to_file(f"gee/{SLUG}_area5km.shp")
gpd.GeoDataFrame(geometry=[ucg],crs=UTM).to_crs("EPSG:4326").to_file(f"gee/{SLUG}_limite.shp")
