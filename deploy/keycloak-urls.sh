#!/usr/bin/env bash
# Registra en el cliente dc-frontend del realm dc-comics las URLs publicas:
#   - Swagger:  https://api.<DOMAIN>/docs/oauth2-redirect
#   - Frontend: <FRONTEND_URL>/* (si esta definido en .env)
# ademas de las de localhost para seguir desarrollando.
#
# El realm se importa con URLs de localhost; sin esto el login desde Swagger
# o desde Netlify falla con "Invalid parameter: redirect_uri".
# Es idempotente: correrlo de nuevo deja la misma lista.
#
# Uso, desde la raiz del repo en la EC2:
#   ./deploy/keycloak-urls.sh
set -euo pipefail
cd "$(dirname "$0")/.."

leer() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- | tr -d '\r'; }
DOMAIN="$(leer DOMAIN)"
FRONTEND_URL="$(leer FRONTEND_URL)"; FRONTEND_URL="${FRONTEND_URL%/}"
ADMIN="$(leer KEYCLOAK_ADMIN)"
CLAVE="$(leer KEYCLOAK_ADMIN_PASSWORD)"
[[ -n "$DOMAIN" && "$DOMAIN" != CAMBIAR* ]] || { echo "Falta DOMAIN en .env"; exit 1; }

API="https://api.${DOMAIN}"
REDIRECTS="\"http://localhost:5173/*\",\"http://localhost:8000/docs/oauth2-redirect\",\"${API}/docs/oauth2-redirect\""
ORIGENES="\"http://localhost:5173\",\"http://localhost:8000\",\"${API}\""
if [[ -n "$FRONTEND_URL" ]]; then
  REDIRECTS+=",\"${FRONTEND_URL}/*\""
  ORIGENES+=",\"${FRONTEND_URL}\""
fi

kc() { docker compose exec -T keycloak /opt/keycloak/bin/kcadm.sh "$@" --config /tmp/kcadm.config; }

echo "Esperando a Keycloak..."
for _ in $(seq 1 30); do
  if kc config credentials --server http://localhost:8080 --realm master \
       --user "$ADMIN" --password "$CLAVE" >/dev/null 2>&1; then
    break
  fi
  sleep 5
done
kc config credentials --server http://localhost:8080 --realm master --user "$ADMIN" --password "$CLAVE"

ID="$(kc get clients -r dc-comics -q clientId=dc-frontend --fields id --format csv --noquotes | tr -d '\r')"
[[ -n "$ID" ]] || { echo "No encontre el cliente dc-frontend en el realm dc-comics"; exit 1; }

kc update "clients/$ID" -r dc-comics \
  -s "redirectUris=[${REDIRECTS}]" \
  -s "webOrigins=[${ORIGENES}]"

echo "Listo. Redirect URIs de dc-frontend:"
kc get "clients/$ID" -r dc-comics --fields redirectUris,webOrigins
