import geopandas as gpd, pandas as pd, numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
from scipy.spatial import cKDTree
g=gpd.read_file("serra_do_cabral_celulas.gpkg")
v=pd.read_csv("vars.csv").drop(columns=["quadrante","pct_uc","dist_uc_m","na_za"],errors="ignore")
d=g.merge(v,on="id")
for c in ["d_urbano_m","d_agua_m","d_antropico_m"]: d[c]=d[c].clip(upper=7680)
d["p_combustivel"]=d[["p_floresta","p_savana","p_campo","p_afloramento","p_pastagem","p_mosaico","p_silvicultura"]].sum(axis=1)
d["sem_comb"]=(d.p_urbano+d.p_agua+d.p_nao_vegetado+d.p_mineracao)>=50
# vizinhança (~600 m): recorrência média 2013-2022 ao redor
xy=np.c_[d.geometry.centroid.x,d.geometry.centroid.y]; t=cKDTree(xy)
viz=t.query_ball_point(xy,r=600)
cal=d.anos_q_cal.values
d["rec_viz_cal"]=[cal[i].mean() for i in viz]
d["y_cal"]=(d.anos_q_cal>0).astype(int)      # queimou ao menos 1x 2013-2022
d["y_val"]=(d.anos_q_val>0).astype(int)      # queimou ao menos 1x 2023-2025
amb=["p_floresta","p_savana","p_campo","p_afloramento","p_pastagem","p_mosaico","p_silvicultura",
     "d_urbano_m","d_antropico_m","d_agua_m","altitude_m","declividade_graus","face_norte","ndvi_seca"]
hist=["anos_q_cal","rec_viz_cal"]
d["confianca"]=np.where(d.pct_uc>=50,"alta",np.where((d.na_za==1)|(d.dist_uc_m<=3000),"média","baixa"))
m=~d.sem_comb
treino=m & (d.confianca!="baixa")   # calibra onde o BDG registra bem
X=d.loc[treino]; res={}
def ajusta(cols,y,nome):
    sc=StandardScaler().fit(X[cols]); lr=LogisticRegression(max_iter=2000,C=1.0).fit(sc.transform(X[cols]),X[y])
    p=lr.predict_proba(sc.transform(X[cols]))[:,1]
    return sc,lr,p
# 1) só ambiente, treinado em 2013-2022, testado em 2023-2025
sc_a,lr_a,p_a=ajusta(amb,"y_cal","amb")
# 2) só histórico
sc_h,lr_h,p_h=ajusta(hist,"y_cal","hist")
# 3) combinado: ambiente + recorrência (para validar, a variável-resposta é 2023-2025)
sc_c,lr_c,p_c=ajusta(amb+hist,"y_val","comb")
dentro=X.pct_uc>=50
for nome,p in [("ambiente",p_a),("historico",p_h),("combinado",p_c)]:
    res[nome]=(roc_auc_score(X.y_val,p), roc_auc_score(X.y_val[dentro],p[dentro.values]))
# RF combinado com validação por quadrante (blocos espaciais)
quads=X.quadrante.unique(); rng=np.random.default_rng(1); rng.shuffle(quads)
folds=np.array_split(quads,5); prf=np.zeros(len(X))
for f in folds:
    te=X.quadrante.isin(f).values
    rf=RandomForestClassifier(n_estimators=300,min_samples_leaf=20,n_jobs=-1,random_state=1).fit(X.loc[~te,amb+hist],X.y_val[~te])
    prf[te]=rf.predict_proba(X.loc[te,amb+hist])[:,1]
# logístico combinado em blocos também
plb=np.zeros(len(X))
for f in folds:
    te=X.quadrante.isin(f).values
    sc=StandardScaler().fit(X.loc[~te,amb+hist]); lr=LogisticRegression(max_iter=2000).fit(sc.transform(X.loc[~te,amb+hist]),X.y_val[~te])
    plb[te]=lr.predict_proba(sc.transform(X.loc[te,amb+hist]))[:,1]
res["combinado_blocos_logistica"]=(roc_auc_score(X.y_val,plb),roc_auc_score(X.y_val[dentro],plb[dentro.values]))
res["combinado_blocos_rf"]=(roc_auc_score(X.y_val,prf),roc_auc_score(X.y_val[dentro],prf[dentro.values]))
print("AUC (toda a área, só dentro da UC):"); [print(f"  {k:28s} {a:.3f}  {b:.3f}") for k,(a,b) in res.items()]
coef=pd.Series(lr_c.coef_[0],index=amb+hist).sort_values()
print("coeficientes padronizados (combinado):"); print(coef.round(2).to_string())
# classes de risco: probabilidade do modelo combinado (logístico, ajustado em tudo)
d["prob"]=np.nan; d.loc[m,"prob"]=lr_c.predict_proba(sc_c.transform(d.loc[m,amb+hist]))[:,1]
q=d.loc[treino,"prob"].quantile([.5,.75,.9]).values
d["classe"]=np.select([d.sem_comb, d.prob>=q[2], d.prob>=q[1], d.prob>=q[0]],["sem combustível","muito alta","alta","moderada"],"baixa")
# quanto do que queimou em 2023-2025 caiu em cada classe
print("por confiança:",d.confianca.value_counts().to_dict())
tab=d.groupby("classe").agg(celulas=("id","size"),queimou_23_25=("y_val","sum"))
tab["pct_area"]=(tab.celulas/tab.celulas.sum()*100).round(1); tab["pct_do_queimado"]=(tab.queimou_23_25/tab.queimou_23_25.sum()*100).round(1)
print(tab.to_string())
# motivos por célula (contribuições do logístico)
Z=pd.DataFrame(sc_c.transform(d.loc[m,amb+hist]),columns=amb+hist,index=d.index[m])
contrib=Z*lr_c.coef_[0]
nomes={"anos_q_cal":"queimou em vários anos (2013–2022)","rec_viz_cal":"vizinhança com queimas frequentes","p_savana":"cerrado (savana)","p_campo":"campo","p_afloramento":"campo rupestre / afloramento","p_pastagem":"pastagem","p_mosaico":"mosaico de usos","p_floresta":"floresta","p_silvicultura":"silvicultura","d_urbano_m":"distância de área urbana","d_antropico_m":"distância de uso antrópico","d_agua_m":"distância de água","altitude_m":"altitude","declividade_graus":"declividade","face_norte":"encosta voltada ao norte","ndvi_seca":"vegetação seca na estiagem",}
def motivos(r):
    s=r.sort_values(ascending=False); s=s[s>0.15][:3]
    return "; ".join(nomes[k] for k in s.index)
d["motivos"]=""; d.loc[m,"motivos"]=contrib.apply(motivos,axis=1)
d.to_file("serra_do_cabral_risco.gpkg",driver="GPKG")
d.drop(columns="geometry").to_csv("serra_do_cabral_risco.csv",index=False)
