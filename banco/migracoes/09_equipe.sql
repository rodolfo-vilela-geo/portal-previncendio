-- =====================================================================
--  PORTAL PREVINCÊNDIO — EQUIPE (quem tem acesso à área interna)
--  Estar logado NÃO basta: o e-mail precisa estar nesta lista e ativo.
--  Para incluir alguém: 1) Authentication → Users → Add user (e-mail e senha);
--                       2) insert into equipe (email, nome, papel) values (...);
-- =====================================================================
create table equipe (
  email      text primary key check (email = lower(email)),
  nome       text not null,
  papel      text not null default 'sala' check (papel in ('sala','gpcif','admin')),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);
comment on table equipe is 'Membros com acesso à área interna (sala de situação, Previncêndio). Login sem cadastro aqui não acessa nada.';

create or replace function is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from equipe
                 where email = lower(coalesce(auth.jwt() ->> 'email', '')) and ativo);
$$;
create or replace function meu_perfil() returns json
language sql stable security definer set search_path = public as $$
  select row_to_json(e) from equipe e
  where email = lower(coalesce(auth.jwt() ->> 'email', '')) and ativo;
$$;
revoke all on function is_equipe() from public;  grant execute on function is_equipe()  to anon, authenticated;
revoke all on function meu_perfil() from public; grant execute on function meu_perfil() to authenticated;

alter table equipe enable row level security;
create policy equipe_le_equipe on equipe for select to authenticated using (is_equipe());

-- Regras internas passam a exigir estar na lista da equipe
drop policy if exists equipe_dominio  on dominio;       create policy equipe_dominio  on dominio       for all to authenticated using (is_equipe()) with check (is_equipe());
drop policy if exists equipe_ri       on ri;            create policy equipe_ri       on ri            for all to authenticated using (is_equipe()) with check (is_equipe());
drop policy if exists equipe_roi      on roi;           create policy equipe_roi      on roi           for all to authenticated using (is_equipe()) with check (is_equipe());
drop policy if exists equipe_evolucao on roi_evolucao;  create policy equipe_evolucao on roi_evolucao  for all to authenticated using (is_equipe()) with check (is_equipe());
drop policy if exists equipe_foto     on roi_foto;      create policy equipe_foto     on roi_foto      for all to authenticated using (is_equipe()) with check (is_equipe());
drop policy if exists equipe_area     on area_queimada; create policy equipe_area     on area_queimada for all to authenticated using (is_equipe()) with check (is_equipe());
drop policy if exists equipe_uc       on uc;            create policy equipe_uc       on uc            for all to authenticated using (is_equipe()) with check (is_equipe());
drop policy if exists equipe_uc_limite on uc_limite;    create policy equipe_uc_limite on uc_limite    for all to authenticated using (is_equipe()) with check (is_equipe());
drop policy if exists fotos_equipe on storage.objects;
create policy fotos_equipe on storage.objects for all to authenticated
  using (bucket_id = 'roi-fotos' and is_equipe()) with check (bucket_id = 'roi-fotos' and is_equipe());
