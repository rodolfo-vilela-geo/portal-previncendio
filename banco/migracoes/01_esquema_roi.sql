-- =====================================================================
--  PORTAL PREVINCÊNDIO — ESQUEMA DO BANCO DE ROIs (Supabase / PostgreSQL)
--  IEF-MG / DIUC / Previncêndio
--
--  Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
--  Rodar UMA vez, num projeto novo. Depois rodar 02_listas_suspensas.sql.
--
--  Princípio: a tabela guarda só o que é DIGITADO no ROI.
--  Tudo o que é CALCULADO na planilha do BDG (data-hora, duração, tempo
--  resposta, classes, mês/semana, dia da semana, totais) é gerado pelo
--  banco na visão vw_bdg, que reproduz a Tabela Principal coluna a coluna.
--
--  Datas:   date        (dat_detec, dat_comb, dat_final)
--  Horas:   time        (hr_detec, hr_comb, hr_final)
--  Data+hora: timestamp (dh_*), gerada automaticamente — ninguém digita.
--  Fuso: horário local de MG, sem fuso (timestamp without time zone).
-- =====================================================================

create extension if not exists postgis;

-- ---------------------------------------------------------------------
-- 1. LISTAS SUSPENSAS (valores permitidos nos campos de escolha)
--    Uma tabela só, com o nome do campo. O formulário lê daqui.
-- ---------------------------------------------------------------------
create table dominio (
  campo  text    not null,           -- ex.: 'f_detec', 'nome_uc'
  valor  text    not null,
  ordem  int     not null default 0,
  ativo  boolean not null default true,
  primary key (campo, valor)
);
comment on table dominio is 'Valores das listas suspensas (aba LISTAS SUSPENSAS da Tabela Principal).';

-- ---------------------------------------------------------------------
-- 2. REGISTRO DE INCÊNDIO (RI) — aberto pela Sala de Situação
--    É o que permite controlar o prazo ANTES de o ROI existir.
-- ---------------------------------------------------------------------
create table ri (
  ano          int  not null check (ano between 2013 and 2100),
  ri           text not null check (ri ~ '^[0-9A-Z]\d{3}$'), -- ex.: '0125' (2013 tem B/C/J)
  nome_uc      text not null,
  dat_final    date,                                        -- fim do incêndio (debelado)
  data_limite  date generated always as (dat_final + 10) stored,
  responsavel  text,                                        -- quem deve elaborar o ROI
  criado_em    timestamptz not null default now(),
  primary key (ano, ri)
);
comment on column ri.data_limite is 'Prazo do ROI: fim do incêndio + 10 dias (calculado).';

-- ---------------------------------------------------------------------
-- 3. ROI — um registro por relatório. Chave: cod_bdp (AAAA-RRRR-OOO)
-- ---------------------------------------------------------------------
create table roi (
  id         bigint generated always as identity,
  -- AAAA-RRRR-OOO. Histórico: em 2013 as bases numeravam RIs de forma
  -- independente e houve números repetidos; a letra da base (B/C/J) foi
  -- incorporada ao RI para distingui-los (2013-C006-xxx ≠ 2013-J006-xxx).
  -- Desde então a numeração é única. 8 registros sem número de ROI ('2021-0655-').
  cod_bdp    text primary key check (cod_bdp ~ '^\d{4}-[0-9A-Z]\d{3}-(\d{3})?$'),
  ano        int  generated always as (split_part(cod_bdp, '-', 1)::int) stored,
  ri         text generated always as (split_part(cod_bdp, '-', 2)) stored,
  roi        text generated always as (nullif(split_part(cod_bdp, '-', 3), '')) stored,

  -- Cabeçalho do ROI
  reds_bos        text,                 -- Número REDS ou BOS
  base_op         text,                 -- BO CUR / SB JAN / SB BH ...
  ufbio           text,                 -- Regional URFBio
  categoria       text,
  nome_uc         text not null,
  grupo           text,
  municipio       text,
  bioma_uc        text,
  gerente_uc      text,
  responsavel     text,                 -- Responsável pelo preenchimento
  telefone        text,
  nome_local      text,                 -- Nome do local do início do incêndio
  local           text,                 -- Interno / Entorno / Interno/Entorno
  distancia       text,                 -- Distância (quando Entorno/ZA)
  lat             numeric(10,6),        -- graus decimais (negativo = Sul)
  lon             numeric(10,6),        -- graus decimais (negativo = Oeste)
  geom            geometry(Point, 4674) generated always as
                    (case when lat is not null and lon is not null
                          then st_setsrid(st_makepoint(lon::float8, lat::float8), 4674) end) stored,

  -- 1. Forma de detecção
  f_detec         text,                 -- categoria (lista)
  f_detec_quem    text,                 -- "Quem?" por extenso (ex.: AMDA)
  dat_detec       date,
  hr_detec        time,
  dh_detec        timestamp generated always as (dat_detec + coalesce(hr_detec, '00:00')) stored,

  -- 2. Operação de combate (resumo; o detalhe diário fica em roi_evolucao)
  dat_comb        date,
  hr_comb         time,
  dh_comb         timestamp generated always as (dat_comb + coalesce(hr_comb, '00:00')) stored,
  dat_final       date,
  hr_final        time,
  dh_final        timestamp generated always as (dat_final + coalesce(hr_final, '00:00')) stored,

  -- Maior nº de combatentes por categoria.
  -- Nos ROIs novos ficam vazios: o banco calcula a partir de roi_evolucao.
  -- Nos históricos, recebem o valor da planilha.
  comb_uc  int, comb_ftp int, comb_sm int, comb_par int,
  comb_vol int, comb_bm  int, comb_pm int,

  -- 3. Veículos (UC / demais = _d)
  vc_4x4 int, vc_4x4_d int, vc_4x2 int, vc_4x2_d int,
  vc_van int, vc_van_d int, vc_moto int, vc_moto_d int,
  vc_trator int, vc_trator_d int, vc_pipa int, vc_pipa_d int,
  a_air_tr int, a_helicop int,
  vc_outro        text,                 -- "Caminhão abastecimento, 1"
  vc_instituicoes text,                 -- Nome da instituição (em caso de outros)

  -- 4. Vegetação e área atingida (ha)
  veg_f_e_d numeric(12,2), veg_f_e_s numeric(12,2), veg_f_o numeric(12,2),
  veg_c_r   numeric(12,2), veg_c_c   numeric(12,2), veg_c_a numeric(12,2),
  veg_c_s_s numeric(12,2), veg_c_d   numeric(12,2), veg_ver numeric(12,2),
  veg_ant   numeric(12,2),
  veg_outro text,                       -- "Pastagem: 0,19"
  area_int  numeric(12,2),
  area_ent  numeric(12,2),
  fonte_area    text check (fonte_area in ('UC','ZEE')),   -- 4.1
  zonas_pm      text,                                      -- 4.2 Zonas do Plano de Manejo

  -- 5. Causas
  causa_p   text,
  causa_out text,
  ag_causal text,
  ag_out    text,
  ind_aut   text check (ind_aut in ('Sim','Não')),        -- indício de autoria

  -- 6. Fauna atingida (formato BDG: itens separados por vírgula)
  fn_nome   text,
  fn_qnt    text,
  fn_coord  text,

  -- 7 a 10. Textos livres e alimentação
  descricao     text,                   -- 7. Descrição da ocorrência (texto longo)
  proprietario  text,                   -- 8. Proprietário/posseiro da área
  dificuldades  text,                   -- 9. Dificuldades encontradas
  alim_fornecida  boolean,              -- 10.1
  alim_cafe_manha int, alim_almoco int, alim_cafe_tarde int, alim_jantar int,
  obs           text,

  -- Ciclo de vida
  status        text not null default 'enviado'
                check (status in ('enviado','em_analise','devolvido','homologado','historico')),
  data_limite   date generated always as (dat_final + 10) stored,
  enviado_em    timestamptz default now(),         -- vazio nos históricos
  atualizado_em timestamptz not null default now() -- no histórico = data_atua
  -- A ordem das datas (detecção <= combate <= fim) é exigida só nos ROIs
  -- novos (regra roi_insere_publico). O histórico tem ~10 casos a revisar,
  -- listados em vw_inconsistencias.
);
create index roi_ano_ri_idx on roi (ano, ri);
create index roi_uc_idx     on roi (nome_uc);
create index roi_geom_idx   on roi using gist (geom);

comment on table roi is 'Relatório de Ocorrência de Incêndio Florestal. Um registro por ROI, chave cod_bdp.';

-- atualizado_em automático
create or replace function tg_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger roi_atualizado before update on roi
  for each row execute function tg_atualizado_em();

-- ---------------------------------------------------------------------
-- 4. EVOLUÇÃO DA OPERAÇÃO DE COMBATE (tabela 2.2 do ROI, uma linha por turno)
-- ---------------------------------------------------------------------
create table roi_evolucao (
  id        bigint generated always as identity primary key,
  cod_bdp   text not null references roi(cod_bdp) on delete cascade,
  data      date not null,
  hr_inicio time,
  hr_fim    time,
  comb_uc  int default 0, comb_ftp int default 0, comb_par int default 0,
  comb_sm  int default 0,             -- coluna "Brigada CFM" do ROI
  comb_vol int default 0, comb_pm  int default 0, comb_bm  int default 0
);
create index roi_evolucao_cod_idx on roi_evolucao (cod_bdp);

-- ---------------------------------------------------------------------
-- 5. FOTOS (arquivo no Storage, bucket 'roi-fotos'; aqui só o caminho)
-- ---------------------------------------------------------------------
create table roi_foto (
  id       bigint generated always as identity primary key,
  cod_bdp  text not null references roi(cod_bdp) on delete cascade,
  caminho  text not null unique,        -- ex.: '2026-0125-019/foto1.jpg'
  legenda  text,
  ordem    int  not null default 1
);
create index roi_foto_cod_idx on roi_foto (cod_bdp);

-- ---------------------------------------------------------------------
-- 6. POLÍGONOS DE ÁREA QUEIMADA (seção 12 do ROI + shapefile histórico)
--    Sem chave estrangeira de propósito: o histórico pode ter polígono
--    sem ROI correspondente, e isso não deve travar a importação.
-- ---------------------------------------------------------------------
create table area_queimada (
  id       bigint generated always as identity primary key,
  cod_bdp  text not null,
  geom     geometry(MultiPolygon, 4674) not null,   -- SIRGAS 2000
  area_ha  numeric(12,2),
  fonte    text,                                    -- 'SMC', 'campo', 'histórico'...
  criado_em timestamptz not null default now()
);
create index area_queimada_cod_idx  on area_queimada (cod_bdp);
create index area_queimada_geom_idx on area_queimada using gist (geom);

-- =====================================================================
-- 7. VISÃO vw_bdg — a Tabela Principal do BDG, calculada
--    Mesmas colunas e mesma ordem da planilha "Atualizar BDG".
-- =====================================================================
create or replace view vw_bdg as
with por_dia as (   -- soma os turnos de cada dia (como a coluna TOTAL do ROI)
  select cod_bdp, data,
         sum(comb_uc) comb_uc, sum(comb_ftp) comb_ftp, sum(comb_sm) comb_sm,
         sum(comb_par) comb_par, sum(comb_vol) comb_vol, sum(comb_bm) comb_bm,
         sum(comb_pm) comb_pm
  from roi_evolucao group by cod_bdp, data
),
evol as (          -- dia de maior empenho de CADA classe (regra do BDG)
  select cod_bdp,
         max(comb_uc) comb_uc, max(comb_ftp) comb_ftp, max(comb_sm) comb_sm,
         max(comb_par) comb_par, max(comb_vol) comb_vol, max(comb_bm) comb_bm,
         max(comb_pm) comb_pm
  from por_dia group by cod_bdp
),
b as (
  select r.*,
    coalesce(e.comb_uc,  r.comb_uc)  c_uc,  coalesce(e.comb_ftp, r.comb_ftp) c_ftp,
    coalesce(e.comb_sm,  r.comb_sm)  c_sm,  coalesce(e.comb_par, r.comb_par) c_par,
    coalesce(e.comb_vol, r.comb_vol) c_vol, coalesce(e.comb_bm,  r.comb_bm)  c_bm,
    coalesce(e.comb_pm,  r.comb_pm)  c_pm,
    case when r.dat_final is not null and r.hr_final is not null
          and r.dat_detec is not null and r.hr_detec is not null
         then r.dh_final - r.dh_detec end                       as dur_ocor,
    case when r.dat_comb is not null and r.hr_comb is not null
          and r.dat_detec is not null and r.hr_detec is not null
         then r.dh_comb - r.dh_detec end                        as tp_resp,
    -- soma_area: soma das fitofisionomias; se nenhuma foi preenchida
    -- (comum no histórico), usa interna + entorno, como a planilha fazia.
    case when num_nonnulls(r.veg_f_e_d, r.veg_f_e_s, r.veg_f_o, r.veg_c_r, r.veg_c_c,
                           r.veg_c_a, r.veg_c_s_s, r.veg_c_d, r.veg_ver, r.veg_ant) > 0
          and coalesce(r.veg_f_e_d,0)+coalesce(r.veg_f_e_s,0)+coalesce(r.veg_f_o,0)
             +coalesce(r.veg_c_r,0)+coalesce(r.veg_c_c,0)+coalesce(r.veg_c_a,0)
             +coalesce(r.veg_c_s_s,0)+coalesce(r.veg_c_d,0)+coalesce(r.veg_ver,0)
             +coalesce(r.veg_ant,0) > 0
         then coalesce(r.veg_f_e_d,0)+coalesce(r.veg_f_e_s,0)+coalesce(r.veg_f_o,0)
             +coalesce(r.veg_c_r,0)+coalesce(r.veg_c_c,0)+coalesce(r.veg_c_a,0)
             +coalesce(r.veg_c_s_s,0)+coalesce(r.veg_c_d,0)+coalesce(r.veg_ver,0)
             +coalesce(r.veg_ant,0)
         else coalesce(r.area_int,0) + coalesce(r.area_ent,0) end as soma_area,
    -- área total para a classe: interna + entorno (se ambas vazias, soma das fitofisionomias)
    case when r.area_int is not null or r.area_ent is not null
         then coalesce(r.area_int,0) + coalesce(r.area_ent,0)
         else nullif(coalesce(r.veg_f_e_d,0)+coalesce(r.veg_f_e_s,0)+coalesce(r.veg_f_o,0)
             +coalesce(r.veg_c_r,0)+coalesce(r.veg_c_c,0)+coalesce(r.veg_c_a,0)
             +coalesce(r.veg_c_s_s,0)+coalesce(r.veg_c_d,0)+coalesce(r.veg_ver,0)
             +coalesce(r.veg_ant,0), 0) end                     as area_total,
    greatest(ceil(extract(epoch from r.hr_detec) / 7200)::int - 1, 0) as k_detec,
    extract(day from r.dat_detec)::int                          as dia,
    extract(month from r.dat_detec)::int                        as m
  from roi r left join evol e using (cod_bdp)
)
select
  b.id, b.cod_bdp, b.ano, b.ri, b.roi, b.local, b.base_op, b.ufbio,
  b.categoria, b.nome_uc, b.grupo, b.municipio, b.bioma_uc, b.f_detec,
  b.dat_detec, b.hr_detec, b.dh_detec,
  b.dat_comb,  b.hr_comb,  b.dh_comb,
  b.dat_final, b.hr_final, b.dh_final,
  b.dur_ocor,
  case
    when b.dat_comb is null and b.f_detec ilike '%sat%lite%'
      then 'Não Houve Combate - Detecção Por Satélite'
    when b.dat_comb is null                  then 'Não Houve Combate - Sem Informações'
    when b.dur_ocor is null                  then 'Sem Informações'
    when b.dur_ocor < interval '30 min'      then '<00h30min'
    when b.dur_ocor < interval '1 hour'      then '00h30min-00h59min.'
    when b.dur_ocor < interval '3 hours'     then '01h00min-02h59min.'
    when b.dur_ocor < interval '5 hours'     then '03h00min-04h59min.'
    when b.dur_ocor < interval '12 hours'    then '05h00min-11h59min.'
    when b.dur_ocor < interval '24 hours'    then '12h00min-23h59min'
    else 'Maior que 24h00min.'
  end                                                          as dur_class,
  -- Intervalo de 2 h com LIMITE SUPERIOR incluído, como no histórico:
  -- 14:00:00 exatas -> '12:00:00 - 14:00:00'; 14:00:01 -> '14:00:00 - 16:00:00'.
  case when b.hr_detec is null then 'Não Informada'
       when b.k_detec >= 11   then '22:00:00 - 23:59:59'
       else to_char(time '00:00' + b.k_detec * interval '2 hours', 'HH24:MI:SS')
            || ' - ' ||
            to_char(time '00:00' + (b.k_detec + 1) * interval '2 hours', 'HH24:MI:SS')
  end                                                          as int_detec,
  b.tp_resp,
  case
    when b.dat_comb is null                  then 'Não Houve Combate'
    when b.tp_resp is null                   then 'Não Classificado'
    when b.tp_resp < interval '10 min'       then 'Menor que 10min.'
    when b.tp_resp < interval '30 min'       then '10min - 29min'
    when b.tp_resp < interval '1 hour'       then '30min - 59min'
    when b.tp_resp < interval '5 hours'      then '1h - 4h59min'
    when b.tp_resp < interval '12 hours'     then '5h - 11h59min'
    else 'Maior que 12 horas'
  end                                                          as tr_class,
  (array['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'])[b.m]
    || '_S0' || case when b.dia <= 7 then 1 when b.dia <= 15 then 2 when b.dia <= 23 then 3 else 4 end
                                                               as mes_sem,
  'M' || lpad(b.m::text, 2, '0')
    || '_S0' || case when b.dia <= 7 then 1 when b.dia <= 15 then 2 when b.dia <= 23 then 3 else 4 end
                                                               as m_sem,
  (array['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'])
    [extract(dow from b.dat_detec)::int + 1]                   as dia_sem,
  (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto',
         'setembro','outubro','novembro','dezembro'])[b.m]     as mes,
  case                                     -- área total = interna + entorno
    when b.area_total is null then 'Não Classificado'
    when b.area_total < 1    then '0 até 0,99 ha'
    when b.area_total < 5    then '1 ha até 4,99 ha'
    when b.area_total < 10   then '5 ha até 9,99 ha'
    when b.area_total < 50   then '10 ha até 49,99 ha'
    when b.area_total < 100  then '50 ha até 99,99 ha'
    when b.area_total < 500  then '100 ha até 499,99 ha'
    when b.area_total < 1000 then '500 ha até 999,99 ha'
    else 'Maior que 1000 ha'
  end                                                          as ar_class,
  b.c_uc  as comb_uc,  b.c_ftp as comb_ftp, b.c_sm as comb_sm, b.c_par as comb_par,
  b.c_vol as comb_vol, b.c_bm  as comb_bm,  b.c_pm as comb_pm,
  coalesce(b.c_uc,0)+coalesce(b.c_ftp,0)+coalesce(b.c_sm,0)+coalesce(b.c_par,0)
 +coalesce(b.c_vol,0)+coalesce(b.c_bm,0)+coalesce(b.c_pm,0)    as total_comb,
  b.vc_4x4, b.vc_4x4_d, b.vc_4x2, b.vc_4x2_d, b.vc_van, b.vc_van_d,
  b.vc_moto, b.vc_moto_d, b.vc_trator, b.vc_trator_d, b.vc_pipa, b.vc_pipa_d,
  b.a_air_tr, b.a_helicop, b.vc_outro,
  b.veg_f_e_d, b.veg_f_e_s, b.veg_f_o, b.veg_c_r, b.veg_c_c, b.veg_c_a,
  b.veg_c_s_s, b.veg_c_d, b.veg_ver, b.veg_ant, b.veg_outro,
  b.area_int, b.area_ent, b.soma_area,
  b.causa_p, b.causa_out, b.ag_causal, b.ag_out, b.ind_aut,
  b.fn_nome, b.fn_qnt, b.fn_coord, b.obs,
  b.atualizado_em::date                                        as data_atua,
  case when exists (select 1 from area_queimada a where a.cod_bdp = b.cod_bdp)
       then 'Não' else 'Sim' end                               as ausentes
from b;

comment on view vw_bdg is 'Tabela Principal do BDG gerada a partir dos ROIs. Exportar: select * from vw_bdg.';

-- =====================================================================
-- 7b. VISÃO vw_combate — operação de combate completa, turno a turno
--     (o BDG/shape guarda só o dia de maior empenho; aqui fica tudo)
-- =====================================================================
create or replace view vw_combate as
select r.cod_bdp, r.nome_uc, r.municipio,
       e.data, e.hr_inicio, e.hr_fim,
       e.comb_uc, e.comb_ftp, e.comb_par, e.comb_sm, e.comb_vol, e.comb_pm, e.comb_bm,
       e.comb_uc + e.comb_ftp + e.comb_par + e.comb_sm + e.comb_vol + e.comb_pm + e.comb_bm as total_turno,
       sum(e.comb_uc + e.comb_ftp + e.comb_par + e.comb_sm + e.comb_vol + e.comb_pm + e.comb_bm)
         over (partition by e.cod_bdp, e.data)                  as total_dia
from roi_evolucao e
join roi r using (cod_bdp)
order by r.cod_bdp, e.data, e.hr_inicio;

-- =====================================================================
-- 8. VISÃO vw_prazos — painel de controle dos ROIs
-- =====================================================================
create or replace view vw_prazos as
select
  i.ano, i.ri, i.nome_uc, i.responsavel,
  i.dat_final, i.data_limite,
  r.cod_bdp,
  coalesce(r.status, 'pendente')                               as status,
  r.enviado_em,
  case when r.cod_bdp is null then i.data_limite - current_date end as dias_restantes,
  case
    when r.cod_bdp is not null                   then 'entregue'
    when i.data_limite is null                   then 'sem data de fim'
    when current_date >  i.data_limite           then 'ATRASADO'
    when i.data_limite - current_date <= 2       then 'vence em até 2 dias'
    else 'no prazo'
  end                                                          as situacao
from ri i
left join roi r on r.ano = i.ano and r.ri = i.ri
order by (r.cod_bdp is not null), i.data_limite nulls last;

-- =====================================================================
-- 8b. VISÃO vw_inconsistencias — registros com datas incoerentes
-- =====================================================================
create or replace view vw_inconsistencias as
select cod_bdp, nome_uc, dat_detec, hr_detec, dat_comb, hr_comb, dat_final, hr_final, problema
from (
  select r.*, unnest(array[
    case when dat_detec is null                             then 'sem data de detecção' end,
    case when dat_detec is not null and extract(year from dat_detec) <> ano
                                                            then 'ano do cod_bdp difere da detecção' end,
    case when dh_comb  < dh_detec                           then 'combate antes da detecção' end,
    case when dh_final < dh_detec                           then 'fim antes da detecção' end,
    case when dh_final < dh_comb                            then 'fim antes do combate' end,
    case when dat_final - dat_detec > 30                    then 'duração maior que 30 dias' end,
    case when dat_comb  - dat_detec > 10                    then 'resposta maior que 10 dias' end
  ]) as problema
  from roi r
) x
where problema is not null
order by cod_bdp;

-- =====================================================================
-- 9. SEGURANÇA (Row Level Security)
--    anon          = qualquer pessoa com o link do formulário
--    authenticated = equipe do Previncêndio, com login no Supabase
-- =====================================================================
alter table dominio       enable row level security;
alter table ri            enable row level security;
alter table roi           enable row level security;
alter table roi_evolucao  enable row level security;
alter table roi_foto      enable row level security;
alter table area_queimada enable row level security;

-- Listas: todos leem (o formulário precisa delas)
create policy dominio_leitura on dominio for select to anon, authenticated using (true);

-- Formulário aberto: SÓ insere. Não lê, não altera, não apaga.
create policy roi_insere_publico on roi for insert to anon
  with check (
        status = 'enviado'
    and cod_bdp ~ '^\d{4}-\d{4}-\d{3}$'                  -- ROI novo: só dígitos
    and dat_detec is not null
    and (dat_comb  is null or dat_comb  >= dat_detec)
    and (dat_final is null or dat_final >= coalesce(dat_comb, dat_detec))
  );
create policy evolucao_insere_publico on roi_evolucao for insert to anon with check (true);
create policy foto_insere_publico     on roi_foto     for insert to anon with check (true);

-- Equipe logada: acesso total
create policy equipe_dominio  on dominio       for all to authenticated using (true) with check (true);
create policy equipe_ri       on ri            for all to authenticated using (true) with check (true);
create policy equipe_roi      on roi           for all to authenticated using (true) with check (true);
create policy equipe_evolucao on roi_evolucao  for all to authenticated using (true) with check (true);
create policy equipe_foto     on roi_foto      for all to authenticated using (true) with check (true);
create policy equipe_area     on area_queimada for all to authenticated using (true) with check (true);

-- As visões respeitam as regras das tabelas (o público não enxerga nada)
alter view vw_bdg    set (security_invoker = true);
alter view vw_prazos set (security_invoker = true);
alter view vw_combate set (security_invoker = true);
alter view vw_inconsistencias set (security_invoker = true);

-- =====================================================================
-- 10. STORAGE — pasta de fotos
--     Público pode enviar foto (até 2 MB, só imagem); só a equipe vê.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roi-fotos', 'roi-fotos', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy fotos_envio_publico on storage.objects for insert to anon
  with check (bucket_id = 'roi-fotos');
create policy fotos_equipe on storage.objects for all to authenticated
  using (bucket_id = 'roi-fotos') with check (bucket_id = 'roi-fotos');
