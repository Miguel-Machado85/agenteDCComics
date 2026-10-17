#!/usr/bin/env bash
# Tras un Stop -> Start la EC2 puede cambiar de IP publica (sin Elastic IP).
# Este script actualiza DOMAIN en .env, recrea los contenedores que dependen
# del dominio (caddy, keycloak, backend) y registra las URLs nuevas en Keycloak.
# No reconstruye imagenes ni toca la base ni el modelo.
#
# Uso, desde la raiz del repo en la EC2:
#   ./deploy/update-ip.sh
# Despues, en la fase 4: actualizar VITE_API_URL y VITE_KEYCLOAK_URL en
# Netlify y hacer redeploy (Vite incrusta las variables al compilar).
set -euo pipefail
cd "$(dirname "$0")/.."

IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')"
NUEVO="${IP//./-}.sslip.io"
ACTUAL="$(grep -E '^DOMAIN=' .env | cut -d= -f2- | tr -d '\r')"

if [[ "$NUEVO" == "$ACTUAL" ]]; then
  echo "La IP no cambio ($IP). DOMAIN=$ACTUAL"
else
  sed -i "s|^DOMAIN=.*|DOMAIN=${NUEVO}|" .env
  echo "DOMAIN: ${ACTUAL} -> ${NUEVO}"
fi

docker compose up -d
./deploy/keycloak-urls.sh

echo
echo "API:      https://api.${NUEVO}/docs"
echo "Keycloak: https://auth.${NUEVO}"
echo "Si hay frontend: VITE_API_URL=https://api.${NUEVO}  VITE_KEYCLOAK_URL=https://auth.${NUEVO}"
