-- =====================================================================
--  40 · Pistas e helipontos das UCs ligados sozinhos ao cadastro único de apoio aéreo
--  Gatilho em uc_ponto (vale para o importador de PIPCIF e para o módulo 2):
--  · pista: procura aeródromo/pista do cadastro a até 2 km (ou com o mesmo nome a até 10 km);
--  · heliponto: procura heliponto/área de pouso a até 300 m (ou com o mesmo nome a até 2 km);
--  · achou: liga, guarda o nome usado pela UC em "outros nomes" e o que a UC informou em atributos.pipcif;
--  · não achou: cria o lugar como "a conferir" (fonte pipcif) com os dados informados.
--  Reimportar o PIPCIF de uma UC refaz a ligação (o registro da UC em atributos.pipcif é substituído).
-- =====================================================================
create or replace function aereo_superficie(t text) returns text language sql immutable as $$
  select case
    when t is null then null
    when t ~* 'cascalh' then 'cascalho'
    when t ~* 'terra|ch[ãa]o' then 'terra'
    when t ~* 'gram|braqui|pasto' then 'grama'
    when t ~* '(sem|n[ãa]o) ?paviment' then null
    when t ~* 'concret|ciment' then 'concreto'
    when t ~* 'asfalt' then 'asfalto'
  end $$;
create or replace function aereo_conservacao(t text) returns text language sql immutable as $$
  select case
    when t is null then null
    when t ~* 'ruim|prec[áa]ri|inoperante|manuten' then 'ruim'
    when t ~* 'regular|razo[áa]vel' then 'regular'
    when t ~* 'bo[ma]|[óo]tim|excelente|perfeit' then 'boa'
  end $$;

create or replace function tg_ligar_ponto_aereo() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  g geometry; rid bigint; reg jsonb; a jsonb := coalesce(new.atributos, '{}'::jsonb); pista boolean := new.tipo = 'pista';
begin
  if new.tipo not in ('pista', 'heliponto') or new.lat is null or new.lon is null
     or new.lat not between -23.5 and -14 or new.lon not between -51.5 and -39.5 then return new; end if;
  if tg_op = 'UPDATE' and new.recurso_id is not null and new.recurso_id is not distinct from old.recurso_id
     and new.lat = old.lat and new.lon = old.lon and new.nome = old.nome then return new; end if;
  if tg_op = 'UPDATE' and new.recurso_id is distinct from old.recurso_id then return new; end if;   -- ligação escolhida à mão
  g := st_setsrid(st_makepoint(new.lon::float8, new.lat::float8), 4674);
  reg := jsonb_strip_nulls(jsonb_build_object('uc', new.nome_uc, 'nome', new.nome)) || a;

  select r.id into rid from recurso_aereo r
   where r.situacao <> 'inativo'
     and (case when pista then r.tipo in ('aerodromo_publico','aerodromo_privado','aerodromo_militar','pista_nao_registrada')
               else r.tipo in ('heliponto','area_pouso') end)
     and (st_dwithin(r.geom::geography, g::geography, case when pista then 2000 else 300 end)
          or ((lower(r.nome) = lower(new.nome) or lower(new.nome) = any(select lower(x) from unnest(r.apelidos) x))
              and st_dwithin(r.geom::geography, g::geography, case when pista then 10000 else 2000 end)))
   order by (lower(r.nome) = lower(new.nome) or lower(new.nome) = any(select lower(x) from unnest(r.apelidos) x)) desc,
            st_distance(r.geom::geography, g::geography)
   limit 1;

  if rid is not null then
    update recurso_aereo r set
      apelidos = case when lower(r.nome) = lower(new.nome) or lower(new.nome) = any(select lower(x) from unnest(r.apelidos) x)
                      then r.apelidos else r.apelidos || new.nome end,
      atributos = jsonb_set(r.atributos, '{pipcif}',
        coalesce((select jsonb_agg(e) from jsonb_array_elements(r.atributos -> 'pipcif') e
                   where not (e ->> 'uc' = new.nome_uc and lower(e ->> 'nome') = lower(new.nome))), '[]'::jsonb) || jsonb_build_array(reg))
    where r.id = rid;
  else
    insert into recurso_aereo (tipo, nome, lat, lon, superficie, comprimento_m, largura_m, conservacao, agua, situacao, fonte, atributos)
    values (case when pista then 'pista_nao_registrada' when new.nome ~* 'heli(ponto|porto)' then 'heliponto' else 'area_pouso' end,
            new.nome, round(new.lat::numeric, 6), round(new.lon::numeric, 6),
            aereo_superficie(coalesce(a ->> 'pavimentacao', a ->> 'piso')),
            case when (a ->> 'comprimento_m') ~ '^\d+(\.\d+)?$' then round((a ->> 'comprimento_m')::numeric) end,
            case when (a ->> 'largura_m') ~ '^\d+(\.\d+)?$' then round((a ->> 'largura_m')::numeric) end,
            aereo_conservacao(a ->> 'conservacao'), a ->> 'reservatorio', 'a_conferir', 'pipcif',
            jsonb_build_object('pipcif', jsonb_build_array(reg)))
    returning id into rid;
  end if;
  new.recurso_id := rid;
  return new;
end $$;
revoke all on function tg_ligar_ponto_aereo() from public, anon, authenticated;

create trigger ligar_ponto_aereo before insert or update of lat, lon, nome, tipo, recurso_id on uc_ponto
  for each row execute function tg_ligar_ponto_aereo();
revoke all on function aereo_superficie(text) from public, anon;
revoke all on function aereo_conservacao(text) from public, anon;
grant execute on function aereo_superficie(text), aereo_conservacao(text) to authenticated;
