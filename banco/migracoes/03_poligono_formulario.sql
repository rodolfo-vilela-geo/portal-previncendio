-- =====================================================================
--  PORTAL PREVINCÊNDIO — POLÍGONO DO SMC ANEXADO AO ROI
--  Rodar UMA vez no SQL Editor (depois do 01 e do 02).
--
--  1. Área em hectares calculada pelo banco (geodésica, em cima do elipsoide).
--  2. Polígono inválido (autointerseção etc.) é corrigido na entrada.
--  3. O formulário público pode gravar polígono SÓ para um ROI enviado
--     nas últimas 24 horas — não dá para anexar a ROIs antigos.
-- =====================================================================

-- 1 e 2. Gatilho: corrige geometria e calcula a área
create or replace function tg_area_queimada() returns trigger language plpgsql as $$
begin
  if not st_isvalid(new.geom) then
    new.geom := st_multi(st_collectionextract(st_makevalid(new.geom), 3));
  end if;
  new.area_ha := round((st_area(new.geom::geography) / 10000)::numeric, 2);
  return new;
end $$;

create trigger area_queimada_calc before insert or update of geom on area_queimada
  for each row execute function tg_area_queimada();

-- Calcula a área também dos polígonos que já existirem
update area_queimada set geom = geom where area_ha is null;

-- 3. Verificação feita "por fora" das regras de leitura
--    (o público não enxerga a tabela roi, então a função consulta por ele)
create or replace function roi_recente(p_cod text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from roi
    where cod_bdp = p_cod
      and status = 'enviado'
      and enviado_em > now() - interval '24 hours'
  );
$$;
revoke all on function roi_recente(text) from public;
grant execute on function roi_recente(text) to anon, authenticated;

create policy area_insere_publico on area_queimada for insert to anon
  with check (fonte in ('SMC','campo') and roi_recente(cod_bdp));
