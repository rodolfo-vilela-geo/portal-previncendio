-- =====================================================================
--  COLIBRI — EMPENHO DE RECURSOS (pessoas, veículos, aeronaves)
--  Categorias → instituições → quantidades por dia (hora de início e fim).
--  Sala de Situação: tabela atuacao (já existente). ROI: roi_empenho.
--  Cada categoria soma numa coluna histórica do ROI (uc, ftp, sm, par,
--  vol, bm, pm, out), para a série 2013–2025 continuar comparável.
--  Vale para 2027; 2026 só para testes. Decisões em docs/decisoes.md.
-- =====================================================================

-- 1. Categorias de empenho
create table if not exists empenho_categoria (
  id        text primary key,
  nome      text not null,
  descricao text,
  coluna    text not null check (coluna in ('uc','ftp','sm','par','vol','bm','pm','out')),
  ordem     int  not null default 0,
  ativo     boolean not null default true
);
comment on table empenho_categoria is 'Categorias do empenho; "coluna" é a coluna histórica do ROI em que a categoria se soma.';
insert into empenho_categoria (id, nome, descricao, coluna, ordem) values
 ('ger', 'Gerente da UC',               'Gerente da UC do incêndio.', 'uc', 1),
 ('uc',  'Equipe da UC',                'Funcionários e monitores da própria UC.', 'uc', 2),
 ('ief', 'IEF – outras equipes',        'Servidores do IEF de outra UC, da URFBio ou da sede (exceto brigada contratada).', 'uc', 3),
 ('ftp', 'Brigada Previncêndio (FTP)',  'Brigadistas da Força-Tarefa Previncêndio.', 'ftp', 4),
 ('cfm', 'Brigada CFM (AMDA)',          'Brigada da Compensação Florestal Minerária, operada pela AMDA.', 'sm', 5),
 ('bm',  'Corpo de Bombeiros Militar',  'CBMMG, sem detalhar pelotão.', 'bm', 6),
 ('pm',  'Polícia Militar',             'PMMG, PM de Meio Ambiente e COMAVE, sem detalhar pelotão.', 'pm', 7),
 ('mun', 'Municípios',                  'Prefeituras, Defesa Civil, guarda e brigadas municipais (uma por município).', 'par', 8),
 ('emp', 'Empresas',                    'Empresas privadas e estatais e as brigadas que mantêm (operadora em observação).', 'par', 9),
 ('pub', 'Órgãos públicos',             'Órgãos federais e estaduais que não são do IEF nem militares.', 'par', 10),
 ('vol', 'Brigadas voluntárias e ONGs', 'Brigadas voluntárias, ONGs e voluntários sem organização.', 'vol', 11),
 ('com', 'Comunidade e particulares',   'Proprietários, fazendas, condomínios e associações de moradores.', 'out', 12),
 ('out', 'Outros',                      'O que não se encaixa nas demais.', 'out', 13)
on conflict (id) do nothing;

-- 2. Instituições: categoria de empenho (grupo) e município; a coluna histórica (categoria) passa a vir do grupo
alter table instituicao add column if not exists grupo text references empenho_categoria(id);
alter table instituicao add column if not exists municipio text;
update instituicao set grupo = case categoria when 'uc' then 'uc' when 'ftp' then 'ftp' when 'sm' then 'cfm' when 'par' then 'emp'
  when 'vol' then 'vol' when 'bm' then 'bm' when 'pm' then 'pm' else 'out' end where grupo is null;
create or replace function tg_instituicao_grupo() returns trigger language plpgsql set search_path = public as $$
begin
  if new.grupo is not null then
    select coluna into new.categoria from empenho_categoria where id = new.grupo;
  end if;
  return new;
end $$;
create trigger instituicao_grupo before insert or update of grupo on instituicao for each row execute function tg_instituicao_grupo();

-- leitura pública do catálogo (o formulário do ROI é aberto); gravação continua com a equipe
create policy instituicao_leitura on instituicao for select to anon, authenticated using (true);
alter table empenho_categoria enable row level security;
create policy empenho_categoria_leitura on empenho_categoria for select to anon, authenticated using (true);
create policy empenho_categoria_grava on empenho_categoria for all to authenticated using (is_gpcif()) with check (is_gpcif());
grant select on instituicao, empenho_categoria to anon;
grant select, insert, update, delete on empenho_categoria to authenticated;

-- 3. Atuações da Sala: sem turnos (dia + hora de início e fim) e contrato da aeronave
alter table atuacao alter column turno drop not null;
alter table atuacao alter column turno set default null;   -- a unicidade antiga (com turno) não atrapalha: turno nulo não colide
alter table atuacao add column if not exists a_contrato text check (a_contrato in ('CFM','FTP','CBMMG/COMAVE','Outro'));

-- 4. Empenho do ROI (preenchido pela UC; vem pré-preenchido com as atuações da Sala)
create table if not exists roi_empenho (
  id             bigint generated always as identity primary key,
  cod_bdp        text not null references roi(cod_bdp) on update cascade on delete cascade,
  data           date not null,
  hr_inicio      time,
  hr_fim         time,
  instituicao_id int  not null references instituicao(id),
  pessoas        int  not null default 0 check (pessoas >= 0),
  vc_4x4 int, vc_4x2 int, vc_pipa int, vc_moto int, vc_trator int, vc_out int,
  a_helicop int, a_air_tr int, a_drone int,
  a_contrato     text check (a_contrato in ('CFM','FTP','CBMMG/COMAVE','Outro')),
  obs            text,
  criado_em      timestamptz not null default now()
);
create index if not exists roi_empenho_cod_idx on roi_empenho (cod_bdp, data);
alter table roi_empenho enable row level security;
create policy roi_empenho_insere_publico on roi_empenho for insert to anon with check (true);
create policy roi_empenho_equipe on roi_empenho for all to authenticated using (true) with check (true);
grant insert on roi_empenho to anon;
grant select, insert, update, delete on roi_empenho to authenticated;

-- 5. Resumo do empenho por ROI (colunas-resumo do BDG e do shapefile)
--    pico_*: maior efetivo diário de cada coluna histórica; pessoas_dia: soma dos efetivos diários
create or replace view vw_roi_empenho_resumo with (security_invoker = true) as
with dia as (
  select e.cod_bdp, e.data, i.categoria as col, i.id as inst,
         max(e.pessoas) p,
         max(coalesce(e.vc_4x4,0)+coalesce(e.vc_4x2,0)+coalesce(e.vc_pipa,0)+coalesce(e.vc_moto,0)+coalesce(e.vc_trator,0)+coalesce(e.vc_out,0)) v,
         max(coalesce(e.a_helicop,0)+coalesce(e.a_air_tr,0)+coalesce(e.a_drone,0)) a
  from roi_empenho e join instituicao i on i.id = e.instituicao_id
  group by e.cod_bdp, e.data, i.categoria, i.id
), col_dia as (
  select cod_bdp, data, col, sum(p) p from dia group by 1, 2, 3
), tot_dia as (
  select cod_bdp, data, sum(p) p, sum(v) v, sum(a) a from dia group by 1, 2
)
select t.cod_bdp,
       max(t.p)::int as pico_pessoas, sum(t.p)::int as pessoas_dia, count(distinct t.data)::int as dias,
       (select count(distinct inst) from dia d where d.cod_bdp = t.cod_bdp)::int as instituicoes,
       max(t.v)::int as pico_veiculos, max(t.a)::int as pico_aeronaves,
       coalesce((select max(p) from col_dia c where c.cod_bdp = t.cod_bdp and c.col = 'uc'), 0)::int  as comb_uc,
       coalesce((select max(p) from col_dia c where c.cod_bdp = t.cod_bdp and c.col = 'ftp'), 0)::int as comb_ftp,
       coalesce((select max(p) from col_dia c where c.cod_bdp = t.cod_bdp and c.col = 'sm'), 0)::int  as comb_sm,
       coalesce((select max(p) from col_dia c where c.cod_bdp = t.cod_bdp and c.col = 'par'), 0)::int as comb_par,
       coalesce((select max(p) from col_dia c where c.cod_bdp = t.cod_bdp and c.col = 'vol'), 0)::int as comb_vol,
       coalesce((select max(p) from col_dia c where c.cod_bdp = t.cod_bdp and c.col = 'bm'), 0)::int  as comb_bm,
       coalesce((select max(p) from col_dia c where c.cod_bdp = t.cod_bdp and c.col = 'pm'), 0)::int  as comb_pm,
       coalesce((select max(p) from col_dia c where c.cod_bdp = t.cod_bdp and c.col = 'out'), 0)::int as comb_out
from tot_dia t group by t.cod_bdp;
grant select on vw_roi_empenho_resumo to authenticated;
