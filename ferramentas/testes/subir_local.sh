#!/bin/bash
# Sobe o banco local (Postgres), o PostgREST (porta 3000) e o servidor estático do site (porta 8765).
POSTGREST="${POSTGREST:-/tmp/claude-0/postgrest}"; SITE="${SITE:-$(cd "$(dirname "$0")/../.." && pwd)}"
pg_isready -q || { service postgresql start >/dev/null 2>&1; sleep 2; }
pgrep -x postgrest >/dev/null || setsid nohup "$POSTGREST" "$(dirname "$0")/postgrest.conf" >/tmp/postgrest.log 2>&1 < /dev/null &
curl -s -o /dev/null --max-time 2 http://localhost:8765/ || (cd "$SITE" && setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 < /dev/null &)
sleep 1; pg_isready
