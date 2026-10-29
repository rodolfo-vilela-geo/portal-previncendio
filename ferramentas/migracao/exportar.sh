#!/usr/bin/env bash
# Colibri — exporta o banco do Supabase (nuvem) para importar num Supabase self-hosted.
# Segue o guia oficial "Restore a Platform Project to Self-Hosted" (supabase.com/docs/guides/self-hosting/restore-from-platform).
#
# Precisa: Docker rodando, Node (npx) ou Supabase CLI, psql, curl, python3.
# Uso (numa pasta FORA do repositório — o resultado tem dados pessoais):
#   export ORIGEM_DB_URL='[connection string do botão Connect, com a senha do banco]'
#   export ORIGEM_SERVICE_KEY='[chave service_role ou secret key do projeto]'
#   bash exportar.sh
# A connection string está no painel do Supabase → botão "Connect" (use "Session pooler" ou "Direct connection").
# A chave service_role está em Project Settings → API Keys. As duas são secretas: não grave em arquivo nem mande por e-mail.
set -euo pipefail
: "${ORIGEM_DB_URL:?defina ORIGEM_DB_URL}"
: "${ORIGEM_SERVICE_KEY:?defina ORIGEM_SERVICE_KEY}"
ORIGEM_URL="${ORIGEM_URL:-https://nhsjsttvxixgfqnweqos.supabase.co}"
CLI="${SUPABASE_CLI:-npx --yes supabase}"
OUT="colibri_dump_$(date +%Y-%m-%d)"
mkdir -p "$OUT/storage"

echo "1/4 Papéis (roles)…";   $CLI db dump --db-url "$ORIGEM_DB_URL" -f "$OUT/roles.sql" --role-only
echo "2/4 Estrutura…";        $CLI db dump --db-url "$ORIGEM_DB_URL" -f "$OUT/schema.sql"
echo "3/4 Dados…";            $CLI db dump --db-url "$ORIGEM_DB_URL" -f "$OUT/data.sql" --use-copy --data-only

echo "4/4 Arquivos do Storage (fotos)…"
psql "$ORIGEM_DB_URL" -At -c "select bucket_id || '/' || name from storage.objects order by 1" > "$OUT/storage/lista.txt"
n=0
while IFS= read -r p; do
  [ -z "$p" ] && continue
  enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$p")
  mkdir -p "$OUT/storage/$(dirname "$p")"
  curl -sSf -H "apikey: $ORIGEM_SERVICE_KEY" -H "Authorization: Bearer $ORIGEM_SERVICE_KEY" \
       "$ORIGEM_URL/storage/v1/object/$enc" -o "$OUT/storage/$p"
  n=$((n+1))
done < "$OUT/storage/lista.txt"
echo "   $n arquivo(s) baixado(s)"

# Contagens para conferir depois da importação (importar.sh compara com estas)
psql "$ORIGEM_DB_URL" -At -F ';' -f "$(dirname "$0")/contagens.sql" > "$OUT/contagens_origem.csv"
psql "$ORIGEM_DB_URL" -At -c "select extname || ' ' || extversion from pg_extension order by 1" > "$OUT/extensoes.txt"

tar czf "$OUT.tar.gz" "$OUT"
echo
echo "Pronto: $OUT.tar.gz"
echo "ATENÇÃO: contém dados pessoais e as contas dos usuários. Entregue por meio seguro e apague as cópias temporárias."
