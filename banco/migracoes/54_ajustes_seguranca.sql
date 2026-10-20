-- 54 — Ajustes do Security Advisor do Supabase (20/10/2026)
-- 1) spatial_ref_sys (tabela do PostGIS com os sistemas de coordenadas, dado público, sem dado do Colibri): o alerta
--    "RLS disabled" é sobre ela. A tabela pertence ao supabase_admin; o nosso usuário não consegue ligar RLS nem tirar
--    a permissão de escrita (o revoke abaixo roda sem efeito). Só o suporte do Supabase consegue — pedido feito à parte.
revoke insert, update, delete, truncate, references, trigger on table public.spatial_ref_sys from anon, authenticated;

-- 2) funções de gatilho não precisam ser chamáveis pela API
revoke execute on function tg_area_queimada_imovel(), tg_imovel_antes(), tg_imovel_depois(), tg_instituicao_recalcula()
  from public, anon, authenticated;
revoke execute on function imovel_coincide_uc(geometry, numeric), imovel_fogo_calc(bigint) from public, anon, authenticated;

-- 3) search_path fixo nas funções apontadas
alter function aereo_conservacao(text) set search_path = public;
alter function aereo_superficie(text) set search_path = public;
alter function poligono_valido(geometry) set search_path = public;
alter function tg_uc_cod_fixo() set search_path = public;

-- 4) UCs perto do imóvel: filtro pela caixa antes da distância (sem ele, incluir um imóvel passava de 8 s em produção)
create or replace function tg_imovel_antes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.geom is distinct from old.geom then
    new.geom := poligono_valido(new.geom);
    new.area_ha := round((st_area(new.geom::geography) / 10000)::numeric, 2);
    if new.origem <> 'car' or cardinality(new.ucs) = 0 then          -- UCs perto (UC/ZA + 5 km)
      new.ucs := array(select distinct u from unnest(new.ucs || array(
        select distinct l.nome_uc from uc_limite l where l.geom && st_expand(new.geom, 0.06) and st_dwithin(l.geom::geography, new.geom::geography, 5000))) u order by 1);
    end if;
  end if;
  return new;
end $$;

-- 5) cicatrizes de um imóvel: usa a geometria do imóvel como valor (com milhares de imóveis no banco o plano genérico
--    cruzava a tabela inteira e passava de 8 s ao incluir/desenhar um imóvel)
create or replace function imovel_fogo_calc(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_geom geometry; v_ha numeric;
begin
  select geom, st_area(geom::geography) into v_geom, v_ha from imovel where id = p_id;
  delete from imovel_fogo where imovel_id = p_id;
  if v_geom is null then return; end if;
  insert into imovel_fogo (imovel_id, area_queimada_id, cod_bdp, ano, area_ha, pct)
  select p_id, a.id, a.cod_bdp, coalesce((select r.ano from roi r where r.cod_bdp = a.cod_bdp limit 1), nullif(left(a.cod_bdp, 4), '')::int),
         round((st_area(x.corte::geography) / 10000)::numeric, 2),
         round((100 * st_area(x.corte::geography) / nullif(v_ha, 0))::numeric, 1)
  from area_queimada a
  cross join lateral (select st_intersection(st_makevalid(a.geom), v_geom) corte) x
  where a.geom && v_geom and st_intersects(a.geom, v_geom) and not st_isempty(x.corte) and st_area(x.corte::geography) >= 100;
end $$;
revoke execute on function imovel_fogo_calc(bigint) from public, anon, authenticated;
