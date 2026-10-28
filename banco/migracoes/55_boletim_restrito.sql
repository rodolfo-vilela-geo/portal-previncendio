-- 55 — Painel Informativo da Força Tarefa só com login (decisão de 28/10/2026, provisória: "depois decidimos")
-- O anônimo deixa de executar boletim_publico(); só painel_dados() (Painel de ocorrências) continua público.
-- Para reabrir: grant execute on function boletim_publico(int) to anon;
revoke execute on function boletim_publico(int) from public, anon;
grant execute on function boletim_publico(int) to authenticated;
