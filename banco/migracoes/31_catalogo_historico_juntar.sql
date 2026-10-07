-- =====================================================================
--  31 · Catálogo de instituições: histórico, juntar instituições e
--  reclassificação que vale para o passado (decisão de 07/10/2026).
--  · instituicao e empenho_categoria passam a ter auditoria (quem, quando, o quê).
--  · juntar_instituicao(de, para): passa as atuações da Sala e o empenho dos ROIs
--    para a instituição certa, guarda o nome antigo como variante e inativa a duplicada.
--  · Trocar a categoria de uma instituição muda o passado: a Sala já recalcula na hora;
--    os ROIs com empenho novo (roi_empenho) têm a evolução por coluna e a seção 3
--    recalculadas (roi_recalcular_empenho). O histórico 2013–2025 (só por coluna) não muda.
-- =====================================================================

-- 1. Histórico (o gatilho roda depois do instituicao_grupo, para registrar também a coluna antiga)
create trigger zz_auditoria before insert or update or delete on instituicao
  for each row execute function tg_auditoria('id');
create trigger zz_auditoria before insert or update or delete on empenho_categoria
  for each row execute function tg_auditoria('id');
create policy equipe_le_auditoria_catalogo on auditoria for select to authenticated
  using (tabela in ('instituicao', 'empenho_categoria') and is_equipe());

-- 2. Recalcula, a partir do roi_empenho, a evolução por coluna (roi_evolucao) e a seção 3 do ROI
--    (mesma regra do formulário: mesma instituição no dia = maior efetivo; veículos = maior soma diária;
--     "da UC" = categorias ger e uc; categoria "out" soma em Parceiros)
-- evolução por dia e coluna antiga, calculada do roi_empenho
create or replace function roi_evolucao_calculada(p_cod text)
returns table (data date, ini time, fim time, uc int, ftp int, par int, sm int, vol int, pm int, bm int)
language sql stable security definer set search_path = public as $$
  with i as (
    select e.data, e.instituicao_id, min(e.hr_inicio) ini, max(e.hr_fim) fim, max(e.pessoas) p, n.categoria col
    from roi_empenho e join instituicao n on n.id = e.instituicao_id
    where e.cod_bdp = p_cod group by e.data, e.instituicao_id, n.categoria)
  select data, min(ini), max(fim),
         coalesce(sum(p) filter (where col = 'uc'), 0)::int,  coalesce(sum(p) filter (where col = 'ftp'), 0)::int,
         coalesce(sum(p) filter (where col in ('par', 'out')), 0)::int, coalesce(sum(p) filter (where col = 'sm'), 0)::int,
         coalesce(sum(p) filter (where col = 'vol'), 0)::int, coalesce(sum(p) filter (where col = 'pm'), 0)::int,
         coalesce(sum(p) filter (where col = 'bm'), 0)::int
  from i group by data;
$$;
revoke all on function roi_evolucao_calculada(text) from public;

create or replace function roi_recalcular_empenho(p_cod text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from roi_empenho where cod_bdp = p_cod) then return; end if;
  -- atualiza os dias que já existem (uma linha por dia, gravada pelo formulário) e inclui os que faltarem
  update roi_evolucao r set hr_inicio = x.ini, hr_fim = x.fim, comb_uc = x.uc, comb_ftp = x.ftp, comb_par = x.par,
         comb_sm = x.sm, comb_vol = x.vol, comb_pm = x.pm, comb_bm = x.bm
    from roi_evolucao_calculada(p_cod) x where r.cod_bdp = p_cod and r.data = x.data;
  insert into roi_evolucao (cod_bdp, data, hr_inicio, hr_fim, comb_uc, comb_ftp, comb_par, comb_sm, comb_vol, comb_pm, comb_bm)
  select p_cod, x.data, x.ini, x.fim, x.uc, x.ftp, x.par, x.sm, x.vol, x.pm, x.bm from roi_evolucao_calculada(p_cod) x
   where not exists (select 1 from roi_evolucao r where r.cod_bdp = p_cod and r.data = x.data);
  with d as (
    select e.data, coalesce(n.grupo in ('ger', 'uc'), false) uc,
           sum(coalesce(e.vc_4x4, 0)) v44, sum(coalesce(e.vc_4x2, 0)) v42, sum(coalesce(e.vc_pipa, 0)) vp,
           sum(coalesce(e.vc_moto, 0)) vm, sum(coalesce(e.vc_trator, 0)) vt
    from roi_empenho e join instituicao n on n.id = e.instituicao_id where e.cod_bdp = p_cod group by 1, 2),
  a as (select data, sum(coalesce(a_helicop, 0)) h, sum(coalesce(a_air_tr, 0)) t from roi_empenho where cod_bdp = p_cod group by 1)
  update roi set
    vc_4x4 = nullif((select max(v44) from d where uc), 0),      vc_4x4_d = nullif((select max(v44) from d where not uc), 0),
    vc_4x2 = nullif((select max(v42) from d where uc), 0),      vc_4x2_d = nullif((select max(v42) from d where not uc), 0),
    vc_pipa = nullif((select max(vp) from d where uc), 0),      vc_pipa_d = nullif((select max(vp) from d where not uc), 0),
    vc_moto = nullif((select max(vm) from d where uc), 0),      vc_moto_d = nullif((select max(vm) from d where not uc), 0),
    vc_trator = nullif((select max(vt) from d where uc), 0),    vc_trator_d = nullif((select max(vt) from d where not uc), 0),
    a_helicop = nullif((select max(h) from a), 0),              a_air_tr = nullif((select max(t) from a), 0),
    vc_instituicoes = (select string_agg(distinct n.nome, '; ') from roi_empenho e join instituicao n on n.id = e.instituicao_id
                       where e.cod_bdp = p_cod and coalesce(n.grupo, '') not in ('ger', 'uc'))
  where cod_bdp = p_cod;
end $$;
revoke all on function roi_recalcular_empenho(text) from public;

-- 3. Trocar a categoria recalcula os ROIs que usaram a instituição
create or replace function tg_instituicao_recalcula() returns trigger
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  for c in select distinct cod_bdp from roi_empenho where instituicao_id = new.id loop
    perform roi_recalcular_empenho(c);
  end loop;
  return null;
end $$;
create trigger instituicao_recalcula after update of grupo on instituicao
  for each row when (old.grupo is distinct from new.grupo) execute function tg_instituicao_recalcula();

-- 4. Juntar instituições (só o Previncêndio)
create or replace function juntar_instituicao(p_de int, p_para int) returns json
language plpgsql security definer set search_path = public as $$
declare de instituicao; pa instituicao; n_at int; n_roi int; c text; cods text[];
begin
  if not is_gpcif() then raise exception 'Só o Previncêndio pode juntar instituições.'; end if;
  select * into de from instituicao where id = p_de;
  select * into pa from instituicao where id = p_para;
  if de.id is null or pa.id is null then raise exception 'Instituição não encontrada.'; end if;
  if de.id = pa.id then raise exception 'Escolha uma instituição diferente.'; end if;
  if de.nome like '% (juntada)' then raise exception 'Esta instituição já foi juntada a outra.'; end if;
  select array_agg(distinct cod_bdp) into cods from roi_empenho where instituicao_id in (p_de, p_para);
  -- registros antigos com turno: se as duas estão no mesmo RI, dia e turno, o da juntada fica sem turno
  -- (nada é apagado; o resumo do dia já conta a mesma instituição pelo maior efetivo)
  update atuacao s set turno = null
    from atuacao t
   where s.instituicao_id = p_de and t.instituicao_id = p_para and s.turno is not null
     and t.ano = s.ano and t.ri = s.ri and t.data = s.data and t.turno = s.turno;
  update atuacao set instituicao_id = p_para where instituicao_id = p_de;  get diagnostics n_at = row_count;
  update roi_empenho set instituicao_id = p_para where instituicao_id = p_de;  get diagnostics n_roi = row_count;
  update instituicao set variantes = (select coalesce(array_agg(distinct v order by v), '{}') from unnest(
           coalesce(pa.variantes, '{}') || lower(de.nome) || coalesce(de.variantes, '{}')) v where v is not null and v <> lower(pa.nome))
   where id = p_para;
  update instituicao set ativo = false, nome = de.nome || ' (juntada)',
         obs = 'Juntada a ' || pa.nome || ' em ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
   where id = p_de;
  foreach c in array coalesce(cods, '{}') loop perform roi_recalcular_empenho(c); end loop;
  return json_build_object('atuacoes', n_at, 'roi_empenho', n_roi, 'para', pa.nome);
end $$;
revoke all on function juntar_instituicao(int, int) from public;
grant execute on function juntar_instituicao(int, int) to authenticated;
