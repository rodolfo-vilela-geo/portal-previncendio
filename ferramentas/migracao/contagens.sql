-- Número de linhas de cada tabela dos esquemas public, auth e storage (para conferir a importação)
select n.nspname || '.' || c.relname,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public', 'auth', 'storage')
  and c.relname not in ('spatial_ref_sys', 'schema_migrations', 'migrations')
order by 1;
