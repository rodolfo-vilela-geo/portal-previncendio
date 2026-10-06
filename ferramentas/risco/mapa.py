import geopandas as gpd, matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from shapely.ops import unary_union
d=gpd.read_file("serra_do_cabral_risco.gpkg")
uc=gpd.read_file("gee/serra_do_cabral_limite.shp").to_crs(d.crs)
import glob
z=gpd.read_file(glob.glob("za/**/*.shp",recursive=True)[0]); cz=[c for c in z.columns if c!="geometry" and z[c].astype(str).str.contains("Cabral",case=False).any()][0]
za=z[z[cz].astype(str).str.contains("Cabral",case=False)].to_crs(d.crs)
cores={"baixa":"#f2efe3","moderada":"#f6c453","alta":"#e8743b","muito alta":"#b2182b","sem combustível":"#9aa3ad"}
fig,axs=plt.subplots(1,2,figsize=(15,9.5),dpi=110)
for ax,tit in zip(axs,["Mapa de risco (calibrado 2013–2022; hachura = confiança menor)","Conferência: onde queimou em 2023–2025 (BDG)"]):
    for c,col in cores.items():
        s=d[d.classe==c]
        if len(s): s.plot(ax=ax,color=col,linewidth=0)
    za.boundary.plot(ax=ax,color="#2b6cb0",linewidth=1.0,linestyle="--")
    uc.boundary.plot(ax=ax,color="#1b4d1b",linewidth=1.6)
    ax.set_title(tit,fontsize=12); ax.set_axis_off()
# quadrantes no primeiro
bx=d[d.confianca=="baixa"].dissolve()
bx.plot(ax=axs[0],facecolor="none",edgecolor="#666",hatch="////",linewidth=0)
q=d.dissolve("quadrante")
q.boundary.plot(ax=axs[0],color="#555",linewidth=0.4,linestyle=":")
for nm,r in q.iterrows():
    p=r.geometry.representative_point(); axs[0].text(p.x,p.y,nm,fontsize=6,color="#333",ha="center",va="center")
# queimado 2023-2025 no segundo
d[d.anos_q_val>0].plot(ax=axs[1],facecolor="none",edgecolor="#000",linewidth=0.25)
axs[0].legend(handles=[Patch(color=cores[k],label=k.capitalize()) for k in ["muito alta","alta","moderada","baixa","sem combustível"]]+[Patch(facecolor="none",edgecolor="#666",hatch="////",label="Confiança menor"),Patch(facecolor="none",edgecolor="#1b4d1b",label="Limite do PE Serra do Cabral"),Patch(facecolor="none",edgecolor="#2b6cb0",linestyle="--",label="Zona de amortecimento")],loc="lower left",fontsize=8,title="Risco",frameon=True)
axs[1].legend(handles=[Patch(facecolor="none",edgecolor="#000",label="Célula queimada em 2023–2025")],loc="lower left",fontsize=8)
fig.suptitle("PE Serra do Cabral + 5 km + zona de amortecimento — protótipo v2 do mapa de risco (células de ~6 ha)",fontsize=13)
plt.tight_layout(); plt.savefig("mapa_risco_serra_do_cabral.png",bbox_inches="tight")
