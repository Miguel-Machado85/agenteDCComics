#!/usr/bin/env bash
# Restaura en la EC2 la base exportada con deploy/exportar-base.ps1.
# Reemplaza documentos, chunks y embeddings; no toca Keycloak.
#
# Uso, desde la raiz del repo en la EC2:
#   ./deploy/restaurar-base.sh kb.dump
set -euo pipefail
cd "$(dirname "$0")/.."

DUMP="${1:-kb.dump}"
[[ -f "$DUMP" ]] || { echo "No existe $DUMP"; exit 1; }
leer() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '\r'; }
USUARIO="$(leer POSTGRES_USER)"; BASE="$(leer POSTGRES_DB)"
psql_db() { docker compose exec -T db psql -U "$USUARIO" -d "$BASE" "$@"; }

docker compose up -d --wait db
docker compose stop backend 2>/dev/null || true   # que nadie escriba durante el restore

docker compose cp "$DUMP" db:/tmp/kb.dump
echo "Restaurando (el indice HNSW se reconstruye: puede tardar unos minutos)..."
docker compose exec -T db pg_restore -U "$USUARIO" -d "$BASE" \
  --no-owner --no-privileges --clean --if-exists /tmp/kb.dump \
  || echo "AVISO: pg_restore reporto errores (suelen ser avisos de objetos ya existentes); revisa los conteos."
docker compose exec -T db rm /tmp/kb.dump

# Que los ids nuevos (POST /documents) no choquen con los restaurados
psql_db -c "SELECT setval('documents_id_seq', COALESCE((SELECT max(id) FROM documents), 1)),
                   setval('chunks_id_seq', COALESCE((SELECT max(id) FROM chunks), 1));" >/dev/null
psql_db -c "ANALYZE documents; ANALYZE chunks;" >/dev/null

echo "Contenido restaurado (debe coincidir con tu base local):"
psql_db -c "SELECT source, count(*) AS documentos FROM documents GROUP BY source;"
psql_db -c "SELECT count(*) AS chunks, pg_size_pretty(pg_database_size(current_database())) AS tamano FROM chunks;"

docker compose up -d backend
