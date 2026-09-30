-- Ajustes apontados pelo verificador de segurança do Supabase (aplicados em 30/09/2026).
alter function public.tg_atualizado_em() set search_path = public;
alter function public.tg_area_queimada() set search_path = public;
do $$ begin   -- função criada pelo próprio Supabase; em outros servidores pode não existir
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
  end if;
end $$;
revoke execute on function public.meu_perfil() from anon;
revoke execute on function public.is_equipe() from anon;
