-- =====================================================================
--  34 · Vegetação atingida calculada pelo Inventário Florestal de MG
--  (IDE-Sisema, recorte UCs + zonas de amortecimento + 5 km, 17 classes).
--  · veg_inventario: polígonos do inventário (dado público; carregado pela página de importação, logado).
--  · veg_classe: as 17 classes e o campo do ROI em que cada uma soma (decisão de 07/10/2026:
--    "Campo" ganha campo próprio; eucalipto, pinus e urbanização vão para Área antrópica;
--    água vai para "Outros"; o que o inventário não mapeia é Área antrópica).
--  · roi.veg_campo (novo) e roi_vegetacao (detalhe por classe, sem mudar o BDG).
--  · vegetacao_poligono(geojson): áreas por classe dentro de um polígono (só usuários).
--  · vw_bdg: veg_campo entra na soma das áreas e no fim da tabela.
-- =====================================================================
create table if not exists veg_classe (
  class_id  smallint primary key,
  classe    text not null,
  campo_roi text not null check (campo_roi in ('veg_f_e_d','veg_f_e_s','veg_f_o','veg_c_r','veg_c_c','veg_c_a','veg_c_s_s','veg_c_d','veg_ver','veg_campo','veg_ant','agua'))
);
insert into veg_classe values
 (1,'Floresta ombrófila submontana','veg_f_o'), (2,'Floresta ombrófila montana','veg_f_o'), (3,'Floresta ombrófila alto-montana','veg_f_o'),
 (4,'Floresta estacional semidecidual submontana','veg_f_e_s'), (5,'Floresta estacional semidecidual montana','veg_f_e_s'),
 (6,'Floresta estacional decidual submontana','veg_f_e_d'), (7,'Floresta estacional decidual montana','veg_f_e_d'),
 (8,'Campo','veg_campo'), (9,'Campo rupestre','veg_c_r'), (10,'Campo cerrado','veg_c_c'), (11,'Cerrado','veg_c_s_s'),
 (12,'Cerradão','veg_c_d'), (13,'Vereda','veg_ver'), (14,'Eucalipto','veg_ant'), (15,'Pinus','veg_ant'),
 (16,'Água','agua'), (17,'Urbanização','veg_ant')
on conflict (class_id) do nothing;

create table if not exists veg_inventario (
  id       bigint generated always as identity primary key,
  class_id smallint not null references veg_classe(class_id),
  geom     geometry(MultiPolygon, 4674) not null
);
create index if not exists veg_inventario_geom_idx on veg_inventario using gist (geom);
alter table veg_classe enable row level security;
alter table veg_inventario enable row level security;
create policy veg_classe_le on veg_classe for select to authenticated using (is_usuario());
create policy veg_inventario_le on veg_inventario for select to authenticated using (is_usuario());
grant select on veg_classe, veg_inventario to authenticated;

-- carga em lotes pela página de importação (só Previncêndio); geometria em GeoJSON (WGS 84/SIRGAS, graus)
create or replace function veg_inventario_carregar(p_lote jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_gpcif() then raise exception 'Só o Previncêndio carrega o inventário.'; end if;
  insert into veg_inventario (class_id, geom)
  select (f ->> 'c')::smallint, st_multi(st_collectionextract(st_makevalid(st_setsrid(st_geomfromgeojson(f -> 'g'), 4674)), 3))
  from jsonb_array_elements(p_lote) f;
  get diagnostics n = row_count; return n;
end $$;
revoke all on function veg_inventario_carregar(jsonb) from public, anon;
grant execute on function veg_inventario_carregar(jsonb) to authenticated;

alter table roi add column if not exists veg_campo numeric(12,2);
comment on column roi.veg_campo is 'Área queimada em Campo (classe Campo do Inventário Florestal), ha.';

create table if not exists roi_vegetacao (
  cod_bdp  text not null references roi(cod_bdp) on update cascade on delete cascade,
  class_id smallint not null references veg_classe(class_id),
  ha       numeric(12,2) not null,
  primary key (cod_bdp, class_id)
);
alter table roi_vegetacao enable row level security;
create policy roi_vegetacao_le on roi_vegetacao for select to authenticated using (is_usuario());
create policy roi_vegetacao_insere on roi_vegetacao for insert to authenticated with check (is_usuario());
create policy roi_vegetacao_equipe on roi_vegetacao for all to authenticated using (is_equipe()) with check (is_equipe());
grant select, insert, update, delete on roi_vegetacao to authenticated;

-- áreas (ha) por classe do inventário dentro do polígono; o resto do polígono é "não mapeado" (Área antrópica)
create or replace function vegetacao_poligono(p_geojson jsonb) returns json
language plpgsql stable security definer set search_path = public as $$
declare g geometry; tot numeric; r json;
begin
  if not is_usuario() then raise exception 'Acesso só para usuários do Colibri.'; end if;
  g := st_makevalid(st_setsrid(st_geomfromgeojson(p_geojson), 4674));
  tot := st_area(g::geography) / 1e4;
  with x as (
    select v.class_id, sum(st_area(st_intersection(v.geom, g)::geography)) / 1e4 ha
    from veg_inventario v where v.geom && g and st_intersects(v.geom, g) group by v.class_id),
  c as (select x.class_id, k.classe, k.campo_roi, round(x.ha::numeric, 2) ha from x join veg_classe k using (class_id) where x.ha >= 0.005)
  select json_build_object('total', round(tot, 2),
           'mapeado', coalesce((select round(sum(ha), 2) from c), 0),
           'classes', coalesce((select json_agg(c order by ha desc) from c), '[]'::json),
           'carregado', exists (select 1 from veg_inventario limit 1))
    into r;
  return r;
end $$;
revoke all on function vegetacao_poligono(jsonb) from public, anon;
grant execute on function vegetacao_poligono(jsonb) to authenticated;

create or replace view vw_bdg with (security_invoker = true) as
 WITH por_dia AS (
         SELECT roi_evolucao.cod_bdp,
            roi_evolucao.data,
            sum(roi_evolucao.comb_uc) AS comb_uc,
            sum(roi_evolucao.comb_ftp) AS comb_ftp,
            sum(roi_evolucao.comb_sm) AS comb_sm,
            sum(roi_evolucao.comb_par) AS comb_par,
            sum(roi_evolucao.comb_vol) AS comb_vol,
            sum(roi_evolucao.comb_bm) AS comb_bm,
            sum(roi_evolucao.comb_pm) AS comb_pm
           FROM roi_evolucao
          GROUP BY roi_evolucao.cod_bdp, roi_evolucao.data
        ), evol AS (
         SELECT por_dia.cod_bdp,
            max(por_dia.comb_uc) AS comb_uc,
            max(por_dia.comb_ftp) AS comb_ftp,
            max(por_dia.comb_sm) AS comb_sm,
            max(por_dia.comb_par) AS comb_par,
            max(por_dia.comb_vol) AS comb_vol,
            max(por_dia.comb_bm) AS comb_bm,
            max(por_dia.comb_pm) AS comb_pm
           FROM por_dia
          GROUP BY por_dia.cod_bdp
        ), b AS (
         SELECT r.id,
            r.cod_bdp,
            r.ano,
            r.ri,
            r.roi,
            r.reds_bos,
            r.base_op,
            r.ufbio,
            r.categoria,
            r.nome_uc,
            r.grupo,
            r.municipio,
            r.bioma_uc,
            r.gerente_uc,
            r.responsavel,
            r.telefone,
            r.nome_local,
            r.local,
            r.distancia,
            r.lat,
            r.lon,
            r.geom,
            r.f_detec,
            r.f_detec_quem,
            r.dat_detec,
            r.hr_detec,
            r.dh_detec,
            r.dat_comb,
            r.hr_comb,
            r.dh_comb,
            r.dat_final,
            r.hr_final,
            r.dh_final,
            r.comb_uc,
            r.comb_ftp,
            r.comb_sm,
            r.comb_par,
            r.comb_vol,
            r.comb_bm,
            r.comb_pm,
            r.vc_4x4,
            r.vc_4x4_d,
            r.vc_4x2,
            r.vc_4x2_d,
            r.vc_van,
            r.vc_van_d,
            r.vc_moto,
            r.vc_moto_d,
            r.vc_trator,
            r.vc_trator_d,
            r.vc_pipa,
            r.vc_pipa_d,
            r.a_air_tr,
            r.a_helicop,
            r.vc_outro,
            r.vc_instituicoes,
            r.veg_f_e_d,
            r.veg_f_e_s,
            r.veg_f_o,
            r.veg_c_r,
            r.veg_c_c,
            r.veg_c_a,
            r.veg_c_s_s,
            r.veg_c_d,
            r.veg_ver,
            r.veg_campo,
            r.veg_ant,
            r.veg_outro,
            r.area_int,
            r.area_ent,
            r.fonte_area,
            r.zonas_pm,
            r.causa_p,
            r.causa_out,
            r.ag_causal,
            r.ag_out,
            r.ind_aut,
            r.fn_nome,
            r.fn_qnt,
            r.fn_coord,
            r.descricao,
            r.proprietario,
            r.dificuldades,
            r.alim_fornecida,
            r.alim_cafe_manha,
            r.alim_almoco,
            r.alim_cafe_tarde,
            r.alim_jantar,
            r.obs,
            r.status,
            r.data_limite,
            r.enviado_em,
            r.atualizado_em,
            COALESCE(e.comb_uc, r.comb_uc::bigint) AS c_uc,
            COALESCE(e.comb_ftp, r.comb_ftp::bigint) AS c_ftp,
            COALESCE(e.comb_sm, r.comb_sm::bigint) AS c_sm,
            COALESCE(e.comb_par, r.comb_par::bigint) AS c_par,
            COALESCE(e.comb_vol, r.comb_vol::bigint) AS c_vol,
            COALESCE(e.comb_bm, r.comb_bm::bigint) AS c_bm,
            COALESCE(e.comb_pm, r.comb_pm::bigint) AS c_pm,
                CASE
                    WHEN r.dat_final IS NOT NULL AND r.hr_final IS NOT NULL AND r.dat_detec IS NOT NULL AND r.hr_detec IS NOT NULL THEN r.dh_final - r.dh_detec
                    ELSE NULL::interval
                END AS dur_ocor,
                CASE
                    WHEN r.dat_comb IS NOT NULL AND r.hr_comb IS NOT NULL AND r.dat_detec IS NOT NULL AND r.hr_detec IS NOT NULL THEN r.dh_comb - r.dh_detec
                    ELSE NULL::interval
                END AS tp_resp,
                CASE
                    WHEN num_nonnulls(r.veg_f_e_d, r.veg_f_e_s, r.veg_f_o, r.veg_c_r, r.veg_c_c, r.veg_c_a, r.veg_c_s_s, r.veg_c_d, r.veg_ver, r.veg_campo, r.veg_ant) > 0 AND (COALESCE(r.veg_f_e_d, 0::numeric) + COALESCE(r.veg_f_e_s, 0::numeric) + COALESCE(r.veg_f_o, 0::numeric) + COALESCE(r.veg_c_r, 0::numeric) + COALESCE(r.veg_c_c, 0::numeric) + COALESCE(r.veg_c_a, 0::numeric) + COALESCE(r.veg_c_s_s, 0::numeric) + COALESCE(r.veg_c_d, 0::numeric) + COALESCE(r.veg_ver, 0::numeric) + COALESCE(r.veg_campo, 0::numeric) + COALESCE(r.veg_ant, 0::numeric)) > 0::numeric THEN COALESCE(r.veg_f_e_d, 0::numeric) + COALESCE(r.veg_f_e_s, 0::numeric) + COALESCE(r.veg_f_o, 0::numeric) + COALESCE(r.veg_c_r, 0::numeric) + COALESCE(r.veg_c_c, 0::numeric) + COALESCE(r.veg_c_a, 0::numeric) + COALESCE(r.veg_c_s_s, 0::numeric) + COALESCE(r.veg_c_d, 0::numeric) + COALESCE(r.veg_ver, 0::numeric) + COALESCE(r.veg_campo, 0::numeric) + COALESCE(r.veg_ant, 0::numeric)
                    ELSE COALESCE(r.area_int, 0::numeric) + COALESCE(r.area_ent, 0::numeric)
                END AS soma_area,
                CASE
                    WHEN r.area_int IS NOT NULL OR r.area_ent IS NOT NULL THEN COALESCE(r.area_int, 0::numeric) + COALESCE(r.area_ent, 0::numeric)
                    ELSE NULLIF(COALESCE(r.veg_f_e_d, 0::numeric) + COALESCE(r.veg_f_e_s, 0::numeric) + COALESCE(r.veg_f_o, 0::numeric) + COALESCE(r.veg_c_r, 0::numeric) + COALESCE(r.veg_c_c, 0::numeric) + COALESCE(r.veg_c_a, 0::numeric) + COALESCE(r.veg_c_s_s, 0::numeric) + COALESCE(r.veg_c_d, 0::numeric) + COALESCE(r.veg_ver, 0::numeric) + COALESCE(r.veg_campo, 0::numeric) + COALESCE(r.veg_ant, 0::numeric), 0::numeric)
                END AS area_total,
            GREATEST(ceil(EXTRACT(epoch FROM r.hr_detec) / 7200::numeric)::integer - 1, 0) AS k_detec,
            EXTRACT(day FROM r.dat_detec)::integer AS dia,
            EXTRACT(month FROM r.dat_detec)::integer AS m
           FROM roi r
             LEFT JOIN evol e USING (cod_bdp)
        )
 SELECT id,
    cod_bdp,
    ano,
    ri,
    roi,
    local,
    base_op,
    ufbio,
    categoria,
    nome_uc,
    grupo,
    municipio,
    bioma_uc,
    f_detec,
    dat_detec,
    hr_detec,
    dh_detec,
    dat_comb,
    hr_comb,
    dh_comb,
    dat_final,
    hr_final,
    dh_final,
    dur_ocor,
        CASE
            WHEN dat_comb IS NULL AND f_detec ~~* '%sat%lite%'::text THEN 'Não Houve Combate - Detecção Por Satélite'::text
            WHEN dat_comb IS NULL THEN 'Não Houve Combate - Sem Informações'::text
            WHEN dur_ocor IS NULL THEN 'Sem Informações'::text
            WHEN dur_ocor < '00:30:00'::interval THEN '<00h30min'::text
            WHEN dur_ocor < '01:00:00'::interval THEN '00h30min-00h59min.'::text
            WHEN dur_ocor < '03:00:00'::interval THEN '01h00min-02h59min.'::text
            WHEN dur_ocor < '05:00:00'::interval THEN '03h00min-04h59min.'::text
            WHEN dur_ocor < '12:00:00'::interval THEN '05h00min-11h59min.'::text
            WHEN dur_ocor < '24:00:00'::interval THEN '12h00min-23h59min'::text
            ELSE 'Maior que 24h00min.'::text
        END AS dur_class,
        CASE
            WHEN hr_detec IS NULL THEN 'Não Informada'::text
            WHEN k_detec >= 11 THEN '22:00:00 - 23:59:59'::text
            ELSE (to_char(('00:00:00'::time without time zone + k_detec::double precision * '02:00:00'::interval)::interval, 'HH24:MI:SS'::text) || ' - '::text) || to_char(('00:00:00'::time without time zone + (k_detec + 1)::double precision * '02:00:00'::interval)::interval, 'HH24:MI:SS'::text)
        END AS int_detec,
    tp_resp,
        CASE
            WHEN dat_comb IS NULL THEN 'Não Houve Combate'::text
            WHEN tp_resp IS NULL THEN 'Não Classificado'::text
            WHEN tp_resp < '00:10:00'::interval THEN 'Menor que 10min.'::text
            WHEN tp_resp < '00:30:00'::interval THEN '10min - 29min'::text
            WHEN tp_resp < '01:00:00'::interval THEN '30min - 59min'::text
            WHEN tp_resp < '05:00:00'::interval THEN '1h - 4h59min'::text
            WHEN tp_resp < '12:00:00'::interval THEN '5h - 11h59min'::text
            ELSE 'Maior que 12 horas'::text
        END AS tr_class,
    ((ARRAY['JAN'::text, 'FEV'::text, 'MAR'::text, 'ABR'::text, 'MAI'::text, 'JUN'::text, 'JUL'::text, 'AGO'::text, 'SET'::text, 'OUT'::text, 'NOV'::text, 'DEZ'::text])[m] || '_S0'::text) ||
        CASE
            WHEN dia <= 7 THEN 1
            WHEN dia <= 15 THEN 2
            WHEN dia <= 23 THEN 3
            ELSE 4
        END AS mes_sem,
    (('M'::text || lpad(m::text, 2, '0'::text)) || '_S0'::text) ||
        CASE
            WHEN dia <= 7 THEN 1
            WHEN dia <= 15 THEN 2
            WHEN dia <= 23 THEN 3
            ELSE 4
        END AS m_sem,
    (ARRAY['domingo'::text, 'segunda-feira'::text, 'terça-feira'::text, 'quarta-feira'::text, 'quinta-feira'::text, 'sexta-feira'::text, 'sábado'::text])[EXTRACT(dow FROM dat_detec)::integer + 1] AS dia_sem,
    (ARRAY['janeiro'::text, 'fevereiro'::text, 'março'::text, 'abril'::text, 'maio'::text, 'junho'::text, 'julho'::text, 'agosto'::text, 'setembro'::text, 'outubro'::text, 'novembro'::text, 'dezembro'::text])[m] AS mes,
        CASE
            WHEN area_total IS NULL THEN 'Não Classificado'::text
            WHEN area_total < 1::numeric THEN '0 até 0,99 ha'::text
            WHEN area_total < 5::numeric THEN '1 ha até 4,99 ha'::text
            WHEN area_total < 10::numeric THEN '5 ha até 9,99 ha'::text
            WHEN area_total < 50::numeric THEN '10 ha até 49,99 ha'::text
            WHEN area_total < 100::numeric THEN '50 ha até 99,99 ha'::text
            WHEN area_total < 500::numeric THEN '100 ha até 499,99 ha'::text
            WHEN area_total < 1000::numeric THEN '500 ha até 999,99 ha'::text
            ELSE 'Maior que 1000 ha'::text
        END AS ar_class,
    c_uc AS comb_uc,
    c_ftp AS comb_ftp,
    c_sm AS comb_sm,
    c_par AS comb_par,
    c_vol AS comb_vol,
    c_bm AS comb_bm,
    c_pm AS comb_pm,
    COALESCE(c_uc, 0::bigint) + COALESCE(c_ftp, 0::bigint) + COALESCE(c_sm, 0::bigint) + COALESCE(c_par, 0::bigint) + COALESCE(c_vol, 0::bigint) + COALESCE(c_bm, 0::bigint) + COALESCE(c_pm, 0::bigint) AS total_comb,
    vc_4x4,
    vc_4x4_d,
    vc_4x2,
    vc_4x2_d,
    vc_van,
    vc_van_d,
    vc_moto,
    vc_moto_d,
    vc_trator,
    vc_trator_d,
    vc_pipa,
    vc_pipa_d,
    a_air_tr,
    a_helicop,
    vc_outro,
    veg_f_e_d,
    veg_f_e_s,
    veg_f_o,
    veg_c_r,
    veg_c_c,
    veg_c_a,
    veg_c_s_s,
    veg_c_d,
    veg_ver,
    veg_ant,
    veg_outro,
    area_int,
    area_ent,
    soma_area,
    causa_p,
    causa_out,
    ag_causal,
    ag_out,
    ind_aut,
    fn_nome,
    fn_qnt,
    fn_coord,
    obs,
    atualizado_em::date AS data_atua,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM area_queimada a
              WHERE a.cod_bdp = b.cod_bdp)) THEN 'Não'::text
            ELSE 'Sim'::text
        END AS ausentes,
    veg_campo
   FROM b;
