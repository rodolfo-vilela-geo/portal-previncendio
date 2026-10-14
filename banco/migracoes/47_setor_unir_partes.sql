-- =====================================================================
--  47 · setor_salvar: funde as partes encostadas (quadrantes ou zonas vizinhas juntados num setor só)
-- =====================================================================
create or replace function setor_salvar(p_id bigint, p_nome_uc text, p_dados jsonb, p_geom jsonb default null)
returns bigint language plpgsql security invoker set search_path = public, extensions as $$
declare g geometry; nid bigint; t text := nullif(trim(p_dados ->> 'nome'), '');
begin
  if p_geom is not null then
    g := st_multi(st_collectionextract(st_makevalid(st_unaryunion(st_collectionextract(st_makevalid(
           st_setsrid(st_force2d(st_geomfromgeojson(p_geom)), 4674)), 3))), 3));
    if g is null or st_isempty(g) then raise exception 'O desenho do setor não forma uma área válida.'; end if;
  end if;
  if p_id is null then
    if g is null then raise exception 'Desenhe o setor no mapa.'; end if;
    insert into uc_setor (nome_uc, nome, origem, geom, acesso, agua, apoio, obs, ordem)
    values (p_nome_uc, coalesce(t, 'Setor'), coalesce(nullif(p_dados ->> 'origem', ''), 'desenhado'), g,
            nullif(trim(p_dados ->> 'acesso'), ''), nullif(trim(p_dados ->> 'agua'), ''), nullif(trim(p_dados ->> 'apoio'), ''),
            nullif(trim(p_dados ->> 'obs'), ''), nullif(p_dados ->> 'ordem', '')::int)
    returning id into nid;
  else
    update uc_setor set nome = coalesce(t, nome), acesso = nullif(trim(p_dados ->> 'acesso'), ''), agua = nullif(trim(p_dados ->> 'agua'), ''),
           apoio = nullif(trim(p_dados ->> 'apoio'), ''), obs = nullif(trim(p_dados ->> 'obs'), ''),
           ordem = coalesce(nullif(p_dados ->> 'ordem', '')::int, ordem), geom = coalesce(g, geom)
     where id = p_id and nome_uc = p_nome_uc returning id into nid;
    if nid is null then raise exception 'Setor não encontrado ou sem permissão para editar esta UC.'; end if;
  end if;
  return nid;
end $$;
revoke all on function setor_salvar(bigint, text, jsonb, jsonb) from public, anon;
grant execute on function setor_salvar(bigint, text, jsonb, jsonb) to authenticated;

alter table uc_setor drop constraint if exists uc_setor_origem_check;
alter table uc_setor add constraint uc_setor_origem_check check (origem in ('desenhado', 'importado', 'zoneamento', 'quadrantes'));
