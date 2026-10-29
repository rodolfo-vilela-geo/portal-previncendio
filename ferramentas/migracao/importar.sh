#!/usr/bin/env bash
# Colibri — importa no Supabase self-hosted o pacote gerado por exportar.sh.
# Uso:
#   export DESTINO_DB_URL='postgres://postgres.[tenant-id]:[POSTGRES_PASSWORD]@[servidor]:5432/postgres'
#   export DESTINO_URL='https://[endereço do Supabase self-hosted]'       # o do Kong (API)
#   export DESTINO_SERVICE_KEY='[SERVICE_ROLE_KEY do .env do self-hosted]'
#   bash importar.sh colibri_dump_AAAA-MM-DD            # a pasta já descompactada
# Recomendado: rodar primeiro numa instância de teste. Para achar todos os erros de uma vez,
#   TESTE=1 bash importar.sh ...   (importa sem transação única e sem parar no primeiro erro)
set -euo pipefail
DIR="${1:?informe a pasta do pacote (ex.: colibri_dump_2026-10-29)}"
: "${DESTINO_DB_URL:?defina DESTINO_DB_URL}"; : "${DESTINO_URL:?defina DESTINO_URL}"; : "${DESTINO_SERVICE_KEY:?defina DESTINO_SERVICE_KEY}"

echo "1/4 Extensões usadas pelo Colibri…"
psql "$DESTINO_DB_URL" -v ON_ERROR_STOP=1 -c "create extension if not exists postgis; create extension if not exists pg_net; create extension if not exists pgcrypto; create extension if not exists \"uuid-ossp\";"

echo "2/4 Ajustes de compatibilidade (Postgres 15 no destino)…"
cp "$DIR/data.sql" "$DIR/data_ajustado.sql"
v=$(psql "$DESTINO_DB_URL" -At -c "show server_version_num")
if [ "$v" -lt 170000 ]; then sed -i 's/^SET transaction_timeout/-- &/' "$DIR/data_ajustado.sql"; fi

echo "3/4 Papéis, estrutura e dados…"
if [ "${TESTE:-}" = "1" ]; then
  psql "$DESTINO_DB_URL" --file "$DIR/roles.sql" --file "$DIR/schema.sql" \
       --command 'SET session_replication_role = replica' --file "$DIR/data_ajustado.sql" 2>&1 | tee "$DIR/importacao_erros.log" | grep -i "error" || true
  echo "Modo teste: veja $DIR/importacao_erros.log, corrija e rode de novo sem TESTE=1 numa base limpa."; exit 0
fi
psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file "$DIR/roles.sql" --file "$DIR/schema.sql" \
     --command 'SET session_replication_role = replica' --file "$DIR/data_ajustado.sql" \
     --dbname "$DESTINO_DB_URL"

echo "4/4 Arquivos do Storage…"
n=0
while IFS= read -r p; do
  [ -z "$p" ] && continue
  enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$p")
  curl -sSf -X POST -H "apikey: $DESTINO_SERVICE_KEY" -H "Authorization: Bearer $DESTINO_SERVICE_KEY" -H "x-upsert: true" \
       --data-binary @"$DIR/storage/$p" "$DESTINO_URL/storage/v1/object/$enc" > /dev/null
  n=$((n+1))
done < "$DIR/storage/lista.txt"
echo "   $n arquivo(s) enviado(s)"

echo
echo "Conferência (tabela;origem;destino — só as diferenças):"
psql "$DESTINO_DB_URL" -At -F ';' -f "$(dirname "$0")/contagens.sql" > "$DIR/contagens_destino.csv"
join -t ';' -a1 -a2 -e '-' -o 0,1.2,2.2 <(sort "$DIR/contagens_origem.csv") <(sort "$DIR/contagens_destino.csv") | awk -F';' '$2!=$3' || true
echo "(nada listado acima = todas as tabelas com o mesmo número de linhas)"
