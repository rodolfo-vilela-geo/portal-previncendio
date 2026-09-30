-- =====================================================================
--  BASE PARA RODAR AS MIGRAÇÕES FORA DO SUPABASE (PostgreSQL 15+ com PostGIS)
--  Recria o mínimo que o Supabase já traz pronto: papéis anon/authenticated,
--  a função auth.jwt() (quem está logado) e o esquema storage das fotos.
--  Num Supabase (nuvem ou instalado na PRODEMGE) NÃO rode este arquivo.
--  Em PostgreSQL "puro", auth.jwt() deve devolver o e-mail do usuário logado
--  pelo sistema de autenticação adotado (ex.: PostgREST com JWT do login do Estado).
-- =====================================================================
create extension if not exists postgis;
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator noinherit login; end if;
end $$;
grant anon, authenticated to authenticator;

create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;

create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id bigserial primary key, bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;

-- o Supabase concede acesso às tabelas do esquema public e controla tudo por RLS
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
