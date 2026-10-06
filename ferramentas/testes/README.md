# Testes locais do Colibri

Um ambiente igual ao de produção, só que local, para testar antes de publicar. As páginas continuam chamando `https://nhsjsttvxixgfqnweqos.supabase.co`, mas o Playwright intercepta essas chamadas (`comum.js`) e as manda para um PostgREST local. O login aceita qualquer senha e emite um token assinado com o segredo local.

## Montar uma vez

1. **PostgreSQL + PostGIS** (Ubuntu/Debian): `apt-get install -y postgresql postgis` (ou `postgresql-16-postgis-3`, conforme a versão).
2. **PostgREST**: baixe o binário em https://github.com/PostgREST/postgrest/releases (linux-static-x64) e informe o caminho em `POSTGREST=/caminho/postgrest`.
3. **Banco `teste`**, na ordem:
   ```bash
   su postgres -c "psql" < ferramentas/testes/criar_banco_local.sql
   su postgres -c "psql -d teste" < banco/ferramentas/base_postgres_sem_supabase.sql
   su postgres -c "psql -d teste -c \"alter role authenticator password 'teste123'\""
   for f in banco/migracoes/*.sql; do su postgres -c "psql -d teste -v ON_ERROR_STOP=1 -q" < "$f" || break; done
   for f in banco/carga/07*.sql; do su postgres -c "psql -d teste -q" < "$f"; done
   su postgres -c "psql -d teste -c \"insert into equipe (email, nome, papel) values ('rodolfo@teste.br','Rodolfo (teste)','admin')\""
   ```
   Dados de exemplo: o banco local nasce vazio. Para testar com dados reais, use o pacote privado (SQL dos PIPCIF) ou carregue o CSV do BDG com `banco/ferramentas/migrar_historico.py`. **Nunca** coloque esses dados no repositório.
4. **Node**: `cd ferramentas/testes && npm install`. O Chromium já vem no ambiente do Claude em `/opt/pw-browsers` (não rode `playwright install`); em outro computador, ajuste `executablePath` nos testes.

## Usar

```bash
ferramentas/testes/subir_local.sh          # Postgres, PostgREST :3000 e site :8765
cd ferramentas/testes
node teste_geo_colibri.js                  # Geo Colibri: login, grupos de camadas, capturas em /tmp
node teste_modulo_risco.js                 # Módulo 6: mapa, conferência, marcações, seção 14
```

- Depois de mudar o esquema do banco local, reinicie o PostgREST: `pkill -x postgrest; ferramentas/testes/subir_local.sh`.
- Para um teste novo, copie um dos existentes: eles começam com `require('./comum')`, fazem login com `rodolfo@teste.br` e usam `rotas()` (Supabase → local) e `extra()` (Leaflet do node_modules e um ladrilho fixo no lugar do satélite).
- Sempre olhe as capturas de tela: o teste passar não garante que a página está bonita.
