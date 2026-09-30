-- =====================================================================
--  PORTAL PREVINCÊNDIO — CONTROLE DE ATUAÇÕES (apoios empenhados)
--  · instituicao: catálogo padronizado de quem atua nos combates, cada
--    uma ligada a uma categoria do BDG/ROI (uc, ftp, sm = Brigada CFM,
--    par, vol, bm, pm, out);
--  · atuacao: registro da sala, por RI, dia e turno — quantas pessoas,
--    veículos e aeronaves cada instituição empenhou (sem nomes);
--  · vw_atuacao_dia: consolidação diária (a mesma instituição em vários
--    turnos do dia conta pelo maior efetivo; instituições diferentes somam);
--  · integração: vw_boletim / boletim_publico passam a usar as atuações
--    quando existem, e ri_para_roi devolve a evolução diária e os veículos
--    para pré-preencher o ROI.
-- =====================================================================

create table instituicao (
  id         int generated always as identity primary key,
  nome       text not null unique,
  sigla      text,
  categoria  text not null check (categoria in ('uc','ftp','sm','par','vol','bm','pm','out')),
  orgao      text,                                -- agrupamento para relatórios (ex.: AMDA, IEF)
  variantes  text[] not null default '{}',        -- grafias antigas, para busca/conversão
  ativo      boolean not null default true,
  obs        text
);
comment on column instituicao.categoria is 'uc=Funcionários da UC · ftp=Brigada Previncêndio · sm=Brigada CFM · par=Parceiros/Municipais · vol=Voluntários · bm=Bombeiros · pm=Polícia Militar · out=Outros (no ROI entra como parceiros)';

create table atuacao (
  id             bigint generated always as identity primary key,
  ano            int  not null,
  ri             text not null,
  data           date not null,
  turno          text not null default 'integral' check (turno in ('integral','manha','tarde','noite')),
  hr_inicio      time,
  hr_fim         time,
  instituicao_id int  not null references instituicao(id),
  pessoas        int  not null default 0 check (pessoas >= 0),
  vc_4x4 int, vc_4x2 int, vc_pipa int, vc_moto int, vc_trator int, vc_out int,
  a_helicop int, a_air_tr int, a_drone int,
  obs            text,
  criado_por     text default (auth.jwt() ->> 'email'),
  criado_em      timestamptz not null default now(),
  foreign key (ano, ri) references ri (ano, ri) on update cascade on delete cascade,
  unique (ano, ri, data, turno, instituicao_id)
);
create index atuacao_ri_idx   on atuacao (ano, ri, data);
create index atuacao_inst_idx on atuacao (instituicao_id);

alter table instituicao enable row level security;
alter table atuacao     enable row level security;
create policy equipe_instituicao on instituicao for all to authenticated using (is_equipe()) with check (is_equipe());
create policy equipe_atuacao     on atuacao     for all to authenticated using (is_equipe()) with check (is_equipe());
grant select, insert, update, delete on instituicao, atuacao to authenticated;
revoke all on instituicao, atuacao from anon;

-- ao registrar atuação, o RI é marcado como atualizado
create or replace function tg_atuacao_ri() returns trigger language plpgsql set search_path = public as $$
begin
  update ri set atualizado_em = now() where ano = new.ano and ri = new.ri;
  return new;
end $$;
create trigger atuacao_ri after insert or update on atuacao for each row execute function tg_atuacao_ri();

-- ---------------------------------------------------------------------
-- Catálogo inicial (a partir de ~3 mil linhas de recursos dos RIs 2026)
-- ---------------------------------------------------------------------
insert into instituicao (nome, sigla, categoria, orgao, variantes, obs) values
 ('Funcionários da UC',                         'UC',        'uc',  'IEF',   '{"funcionarios da uc","veiculo 4x4 da uc","gerente","monitores"}', 'Equipe da própria UC do RI'),
 ('IEF – equipe de outra UC',                   'IEF',       'uc',  'IEF',   '{"funcionarios do mn itatiaia","veiculo 4x4 ief"}', 'Informe a UC de origem em observações'),
 ('Brigada Previncêndio (FTP)',                 'FTP',       'ftp', 'IEF',   '{"brigadistas ftp","brigadistas previncendio"}', null),
 ('Brigada CFM AMDA/Previncêndio',              'CFM',       'sm',  'AMDA',  '{"brigadistas cfm amda/previncendio-ief","brigadistas cfm"}', 'Compensação minerária'),
 ('Brigada AMDA – Jardim Canadá',               'AMDA JC',   'sm',  'AMDA',  '{"brigadistas amda jardim canada"}', null),
 ('Brigada AMDA – Centro Integrado',            'AMDA CI',   'sm',  'AMDA',  '{"brigadistas amda centro integrado"}', null),
 ('Brigada AMDA – Gerdau',                      'AMDA GD',   'sm',  'AMDA',  '{"brigadistas amda gerdau","brigadistas amda guerdal"}', null),
 ('Brigada AMDA – Itabirito',                   'AMDA IT',   'sm',  'AMDA',  '{"brigadistas amda itabirito"}', null),
 ('Brigada AMDA – Metropolitana',               'AMDA MT',   'sm',  'AMDA',  '{"brigadistas amda metropolitana"}', null),
 ('Brigada AMDA – Miguel Burnier',              'AMDA MB',   'sm',  'AMDA',  '{"brigadistas amda miguel burnier"}', null),
 ('Brigada AMDA – Congonhas',                   'AMDA CG',   'sm',  'AMDA',  '{"brigadistas amda congonhas"}', null),
 ('Corpo de Bombeiros Militar (CBMMG)',         'CBMMG',     'bm',  'CBMMG', '{"bombeiros militares","cbmmg"}', null),
 ('Comando de Aviação do Estado (COMAVE)',      'COMAVE',    'bm',  'COMAVE','{"militares comave"}', 'Conferir categoria'),
 ('Polícia Militar (PMMG)',                     'PMMG',      'pm',  'PMMG',  '{"policiais militares","policia militar"}', null),
 ('ICMBio',                                     'ICMBio',    'par', 'ICMBio','{"brigadistas icmbio"}', null),
 ('IBAMA/Prevfogo',                             'IBAMA',     'par', 'IBAMA', '{"brigadistas ibama"}', null),
 ('COPASA',                                     'COPASA',    'par', 'COPASA','{"funcionarios da copasa","veiculo 4x4 da copasa"}', null),
 ('CEMIG',                                      'CEMIG',     'par', 'CEMIG', '{"funcionarios cemig"}', null),
 ('Brigada ArcelorMittal',                      'Arcelor',   'par', 'Empresas', '{"brigada arcelor"}', null),
 ('Brigada Vale',                               'Vale',      'par', 'Empresas', '{"brigadistas vale","vale ambipar"}', null),
 ('Mineradora AVG',                             'AVG',       'par', 'Empresas', '{"brigadistas da mineradora avg"}', null),
 ('Habitat',                                    'Habitat',   'par', 'ONG',   '{"brigadistas habitat"}', null),
 ('Defesa Civil municipal',                     'Def. Civil','par', 'Municípios', '{"defesa civil"}', 'Informe o município em observações'),
 ('Prefeitura municipal',                       'Prefeitura','par', 'Municípios', '{"prefeitura"}', 'Informe o município em observações'),
 ('Brigada voluntária / voluntários',           'Vol.',      'vol', 'Voluntários', '{"voluntarios","brigadistas voluntarios"}', null),
 ('Particulares (proprietários e moradores)',   'Part.',     'out', 'Particulares', '{"fazenda","haras","veiculo 4x4 particular"}', 'Informe a propriedade em observações');

-- ---------------------------------------------------------------------
-- Consolidação diária
-- ---------------------------------------------------------------------
create or replace view vw_atuacao_dia with (security_invoker = true) as
with pi as (                         -- por instituição no dia (turnos: maior efetivo)
  select a.ano, a.ri, a.data, i.id as inst, i.nome, i.categoria,
         max(a.pessoas) as p,
         max(coalesce(a.vc_4x4,0)) as vc_4x4, max(coalesce(a.vc_4x2,0)) as vc_4x2, max(coalesce(a.vc_pipa,0)) as vc_pipa,
         max(coalesce(a.vc_moto,0)) as vc_moto, max(coalesce(a.vc_trator,0)) as vc_trator, max(coalesce(a.vc_out,0)) as vc_out,
         max(coalesce(a.a_helicop,0)) as a_helicop, max(coalesce(a.a_air_tr,0)) as a_air_tr, max(coalesce(a.a_drone,0)) as a_drone,
         min(a.hr_inicio) as hr_inicio,
         max(a.data + a.hr_fim + case when a.hr_fim < a.hr_inicio then interval '1 day' else interval '0' end) as fim,
         sum(a.pessoas * extract(epoch from (a.hr_fim - a.hr_inicio
             + case when a.hr_fim < a.hr_inicio then interval '24 hours' else interval '0' end)) / 3600.0) as hh,
         string_agg(distinct a.obs, '; ') as obs
  from atuacao a join instituicao i on i.id = a.instituicao_id
  group by a.ano, a.ri, a.data, i.id, i.nome, i.categoria
), txt as (
  select pi.*,
         pi.nome || ' — ' || concat_ws(', ',
           case when p > 0 then p || case when p = 1 then ' pessoa' else ' pessoas' end end,
           case when vc_4x4 > 0 then vc_4x4 || ' veíc. 4x4' end, case when vc_4x2 > 0 then vc_4x2 || ' veíc. 4x2' end,
           case when vc_pipa > 0 then vc_pipa || ' cam. pipa/ABT' end, case when vc_moto > 0 then vc_moto || ' moto' end,
           case when vc_trator > 0 then vc_trator || ' trator' end, case when vc_out > 0 then vc_out || ' outro veíc.' end,
           case when a_helicop > 0 then a_helicop || ' helicóptero' end, case when a_air_tr > 0 then a_air_tr || ' Air Tractor' end,
           case when a_drone > 0 then a_drone || ' drone' end)
         || coalesce(' (' || obs || ')', '') as linha
  from pi
)
select ano, ri, data, min(hr_inicio) as hr_inicio, max(fim)::time as hr_fim, max(fim) as fim,
       coalesce(sum(p) filter (where categoria = 'uc'), 0)::int  as comb_uc,
       coalesce(sum(p) filter (where categoria = 'ftp'), 0)::int as comb_ftp,
       coalesce(sum(p) filter (where categoria = 'sm'), 0)::int  as comb_sm,
       coalesce(sum(p) filter (where categoria = 'par'), 0)::int as comb_par,
       coalesce(sum(p) filter (where categoria = 'vol'), 0)::int as comb_vol,
       coalesce(sum(p) filter (where categoria = 'bm'), 0)::int  as comb_bm,
       coalesce(sum(p) filter (where categoria = 'pm'), 0)::int  as comb_pm,
       coalesce(sum(p) filter (where categoria = 'out'), 0)::int as comb_out,
       sum(p)::int as total_pessoas,
       sum(vc_4x4)::int as vc_4x4, sum(vc_4x2)::int as vc_4x2, sum(vc_pipa)::int as vc_pipa, sum(vc_moto)::int as vc_moto,
       sum(vc_trator)::int as vc_trator, sum(vc_out)::int as vc_out,
       sum(a_helicop)::int as a_helicop, sum(a_air_tr)::int as a_air_tr, sum(a_drone)::int as a_drone,
       -- veículos só da UC e das demais instituições (colunas do ROI)
       coalesce(sum(vc_4x4)    filter (where categoria = 'uc'), 0)::int as vc_4x4_uc,
       coalesce(sum(vc_4x2)    filter (where categoria = 'uc'), 0)::int as vc_4x2_uc,
       coalesce(sum(vc_pipa)   filter (where categoria = 'uc'), 0)::int as vc_pipa_uc,
       coalesce(sum(vc_moto)   filter (where categoria = 'uc'), 0)::int as vc_moto_uc,
       coalesce(sum(vc_trator) filter (where categoria = 'uc'), 0)::int as vc_trator_uc,
       round(sum(hh), 1) as horas_homem,
       count(*)::int as n_instituicoes,
       string_agg(linha, E'\n' order by array_position(array['uc','ftp','sm','bm','pm','par','vol','out'], categoria), p desc) as recursos_txt,
       string_agg(nome, '; ' order by nome) filter (where categoria <> 'uc') as instituicoes_externas
from txt
group by ano, ri, data;

-- ---------------------------------------------------------------------
-- Boletim: atuações (dia mais recente) têm prioridade sobre os eventos
-- ---------------------------------------------------------------------
drop view if exists vw_boletim;
create view vw_boletim with (security_invoker = true) as
select r.ano, r.ri, r.base_op, r.status, r.nome_uc, r.local, r.municipio,
       r.dat_detec, r.hr_detec, r.dat_final, r.hr_final, r.lat, r.lon,
       case when d.data is not null then coalesce(d.fim, d.data + coalesce(d.hr_inicio, '00:00')) else e.data_hora end as ultima_atualizacao,
       case when d.data is not null then d.comb_uc  else e.comb_uc  end as comb_uc,
       case when d.data is not null then d.comb_ftp else e.comb_ftp end as comb_ftp,
       case when d.data is not null then d.comb_sm  else e.comb_sm  end as comb_sm,
       case when d.data is not null then d.comb_par else e.comb_par end as comb_par,
       case when d.data is not null then d.comb_vol else e.comb_vol end as comb_vol,
       case when d.data is not null then d.comb_bm  else e.comb_bm  end as comb_bm,
       case when d.data is not null then d.comb_pm  else e.comb_pm  end as comb_pm,
       case when d.data is not null then d.comb_out else e.comb_out end as comb_out,
       case when d.data is not null then d.total_pessoas else
         coalesce(e.comb_uc,0)+coalesce(e.comb_ftp,0)+coalesce(e.comb_sm,0)+coalesce(e.comb_par,0)
        +coalesce(e.comb_vol,0)+coalesce(e.comb_bm,0)+coalesce(e.comb_pm,0)+coalesce(e.comb_out,0) end as total_pessoas,
       case when d.data is not null then d.vc_4x4    else e.vc_4x4    end as vc_4x4,
       case when d.data is not null then d.vc_4x2    else e.vc_4x2    end as vc_4x2,
       case when d.data is not null then d.vc_pipa   else e.vc_pipa   end as vc_pipa,
       case when d.data is not null then d.vc_moto   else e.vc_moto   end as vc_moto,
       case when d.data is not null then d.vc_trator else e.vc_trator end as vc_trator,
       case when d.data is not null then d.vc_out    else e.vc_out    end as vc_out,
       case when d.data is not null then d.a_helicop else e.a_helicop end as a_helicop,
       case when d.data is not null then d.a_air_tr  else e.a_air_tr  end as a_air_tr,
       case when d.data is not null then d.a_drone   else e.a_drone   end as a_drone,
       case when d.data is not null then d.recursos_txt else e.recursos_txt end as recursos_txt,
       (select count(*) from ri_evento x where x.ano = r.ano and x.ri = r.ri) as n_eventos,
       exists (select 1 from roi o where o.ano = r.ano and o.ri = r.ri) as tem_roi,
       case when d.data is not null then 'atuacoes' when e.id is not null then 'eventos' end as fonte_recursos,
       coalesce(d.data is null and e.criado_por like 'importação%', false) as importado,
       d.data as data_atuacao,
       (select count(distinct a.data) from atuacao a where a.ano = r.ano and a.ri = r.ri) as dias_atuacao
from ri r
left join lateral (
  select * from vw_atuacao_dia x where x.ano = r.ano and x.ri = r.ri order by x.data desc limit 1
) d on true
left join lateral (
  select * from ri_evento x
  where x.ano = r.ano and x.ri = r.ri
    and (x.recursos_txt is not null or num_nonnulls(x.comb_uc, x.comb_ftp, x.comb_sm, x.comb_par, x.comb_vol,
                                                   x.comb_bm, x.comb_pm, x.comb_out, x.vc_4x4, x.a_helicop) > 0)
  order by x.data_hora desc nulls last, x.id desc limit 1
) e on true;
grant select on vw_boletim, vw_atuacao_dia to authenticated;
revoke all on vw_boletim, vw_atuacao_dia from anon;

-- ---------------------------------------------------------------------
-- Boletim público (mesma saída de antes + fonte dos recursos)
-- ---------------------------------------------------------------------
create or replace function boletim_publico(p_ano int default null)
returns json language sql stable security definer set search_path = public as $$
  with par as (select coalesce(p_ano, extract(year from (now() at time zone 'America/Sao_Paulo'))::int) as ano),
  hist as (
    select extract(month from o.dat_detec)::int as mes, count(*) as n
    from roi o, par where o.ano between 2013 and par.ano - 1 and o.dat_detec is not null group by 1
  ),
  anos as (select count(distinct o.ano) as n, min(o.ano) as ini, max(o.ano) as fim from roi o, par where o.ano between 2013 and par.ano - 1),
  ris as (
    select b.ri, b.status, b.base_op, b.nome_uc, u.categoria, b.local, b.municipio,
           b.dat_detec, b.hr_detec, b.dat_final, b.hr_final,
           b.ultima_atualizacao as atualizado, b.recursos_txt, b.importado, b.fonte_recursos as fonte,
           json_build_object('comb_uc',b.comb_uc,'comb_ftp',b.comb_ftp,'comb_sm',b.comb_sm,'comb_par',b.comb_par,'comb_vol',b.comb_vol,
                             'comb_bm',b.comb_bm,'comb_pm',b.comb_pm,'comb_out',b.comb_out,'vc_4x4',b.vc_4x4,'vc_4x2',b.vc_4x2,
                             'vc_pipa',b.vc_pipa,'vc_moto',b.vc_moto,'vc_trator',b.vc_trator,'vc_out',b.vc_out,
                             'a_helicop',b.a_helicop,'a_air_tr',b.a_air_tr,'a_drone',b.a_drone) as rec
    from vw_boletim b cross join par
    left join uc u on u.nome_uc = b.nome_uc
    where b.ano = par.ano and b.status <> 'cancelado'
  )
  select json_build_object(
    'gerado_em', now(),
    'ano', (select ano from par),
    'anos_historico', (select json_build_object('ini', ini, 'fim', fim, 'n', n) from anos),
    'media_mensal', (select json_agg(coalesce(round(h.n::numeric / nullif((select n from anos), 0), 1), 0) order by m)
                     from generate_series(1, 12) m left join hist h on h.mes = m),
    'media_anual', (select round(count(*)::numeric / nullif((select n from anos), 0), 1) from roi o, par
                    where o.ano between 2013 and par.ano - 1),
    'ris', coalesce((select json_agg(row_to_json(ris) order by ri desc) from ris), '[]'::json)
  );
$$;
revoke all on function boletim_publico(int) from public;
grant execute on function boletim_publico(int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- ROI: dados do RI + evolução diária e veículos a partir das atuações
-- (categoria "out" entra como parceiros, que é a coluna existente no ROI)
-- ---------------------------------------------------------------------
create or replace function ri_para_roi(p_ano int, p_ri text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('ano', r.ano, 'ri', r.ri, 'base_op', r.base_op, 'status', r.status, 'nome_uc', r.nome_uc,
           'local', r.local, 'municipio', r.municipio, 'dat_detec', r.dat_detec, 'hr_detec', r.hr_detec,
           'dat_final', r.dat_final, 'hr_final', r.hr_final, 'lat', r.lat, 'lon', r.lon,
           'evolucao', (select json_agg(json_build_object('data', d.data, 'hr_inicio', to_char(d.hr_inicio, 'HH24:MI'),
                                 'hr_fim', to_char(d.hr_fim, 'HH24:MI'),
                                 'comb_uc', d.comb_uc, 'comb_ftp', d.comb_ftp, 'comb_par', d.comb_par + d.comb_out,
                                 'comb_sm', d.comb_sm, 'comb_vol', d.comb_vol, 'comb_pm', d.comb_pm, 'comb_bm', d.comb_bm) order by d.data)
                        from vw_atuacao_dia d where d.ano = r.ano and d.ri = r.ri),
           'veiculos', (select json_build_object(
                          'vc_4x4', max(vc_4x4_uc), 'vc_4x4_d', max(vc_4x4 - vc_4x4_uc),
                          'vc_4x2', max(vc_4x2_uc), 'vc_4x2_d', max(vc_4x2 - vc_4x2_uc),
                          'vc_pipa', max(vc_pipa_uc), 'vc_pipa_d', max(vc_pipa - vc_pipa_uc),
                          'vc_moto', max(vc_moto_uc), 'vc_moto_d', max(vc_moto - vc_moto_uc),
                          'vc_trator', max(vc_trator_uc), 'vc_trator_d', max(vc_trator - vc_trator_uc),
                          'a_helicop', max(a_helicop), 'a_air_tr', max(a_air_tr),
                          'vc_outro', nullif(concat_ws('; ',
                              case when max(vc_out) > 0 then 'Outros veículos, ' || max(vc_out) end,
                              case when max(a_drone) > 0 then 'Drone, ' || max(a_drone) end), ''))
                        from vw_atuacao_dia d where d.ano = r.ano and d.ri = r.ri having count(*) > 0),
           'instituicoes', (select string_agg(distinct i.nome, '; ') from atuacao a join instituicao i on i.id = a.instituicao_id
                            where a.ano = r.ano and a.ri = r.ri and i.categoria <> 'uc'))
  from ri r where r.ano = p_ano and r.ri = lpad(p_ri, 4, '0') and r.status <> 'cancelado';
$$;
revoke all on function ri_para_roi(int, text) from public;
grant execute on function ri_para_roi(int, text) to anon, authenticated;
