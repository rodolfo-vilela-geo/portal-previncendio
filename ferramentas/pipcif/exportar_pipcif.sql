-- Exporta os módulos 1–5 de uma UC (banco local) no formato colibri-pipcif-1, lido por pipcif_importar.html.
-- Uso (mesma conexão): \i ferramentas/pipcif/exportar_pipcif.sql   e depois   select pg_temp.exp('Nome da UC');
create or replace function pg_temp.exp(p text) returns jsonb language sql as $$
select jsonb_build_object(
 'formato','colibri-pipcif-1','nome_uc',p,
 'cadastro',(select to_jsonb(c) - array['nome_uc','ref_geom','sede_geom','atualizado_por','atualizado_em'] from uc_cadastro c where nome_uc=p),
 'regional',(select to_jsonb(r) - array['atualizado_por','atualizado_em','endereco','sigla'] from regional r join uc u on u.ufbio=r.nome where u.nome_uc=p),
 'infra',(select to_jsonb(i) - array['atualizado_por','atualizado_em'] from uc_infra i where nome_uc=p),
 'tabelas', jsonb_build_object(
   'uc_ponto',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','geom','atualizado_por','atualizado_em'] order by id),'[]') from uc_ponto t where nome_uc=p),
   'uc_veiculo',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','atualizado_por','atualizado_em'] order by id),'[]') from uc_veiculo t where nome_uc=p),
   'uc_radio',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','geom','atualizado_por','atualizado_em'] order by id),'[]') from uc_radio t where nome_uc=p),
   'uc_material',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','atualizado_por','atualizado_em'] order by id),'[]') from uc_material t where nome_uc=p),
   'uc_parceiro',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','geom','atualizado_por','atualizado_em'] order by id),'[]') from uc_parceiro t where nome_uc=p),
   'uc_prestador',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','geom','atualizado_por','atualizado_em'] order by id),'[]') from uc_prestador t where nome_uc=p),
   'uc_colaborador',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','geom','atualizado_por','atualizado_em'] order by id),'[]') from uc_colaborador t where nome_uc=p),
   'uc_via',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','geom','compr_mapa_m','tracado_em','atualizado_por','atualizado_em'] order by id),'[]') from uc_via t where nome_uc=p),
   'uc_elemento',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','atualizado_por','atualizado_em'] order by id),'[]') from uc_elemento t where nome_uc=p),
   'uc_acao_preventiva',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','atualizado_por','atualizado_em'] order by id),'[]') from uc_acao_preventiva t where nome_uc=p),
   'uc_projeto',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','geom','atualizado_por','atualizado_em'] order by id),'[]') from uc_projeto t where nome_uc=p),
   'uc_brigada',(select coalesce(jsonb_agg(to_jsonb(t) - array['id','atualizado_por','atualizado_em'] order by id),'[]') from uc_brigada t where nome_uc=p)))
$$;
