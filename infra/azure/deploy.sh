#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RG="${RG:-prabhatai-rg}"
LOCATION="${LOCATION:-centralindia}"
PREFIX="${PREFIX:-prabhatai}"
TAG="${TAG:-$(date +%Y%m%d%H%M%S)}"
PG_ADMIN="${PG_ADMIN:-codexadmin}"
PG_PASSWORD="${PG_PASSWORD:-}"

if [[ -z "${PG_PASSWORD}" ]]; then
  echo "Set PG_PASSWORD to a strong password before running."
  exit 1
fi

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().rstrip("\n"), safe=""))'
}

ACR_NAME="${ACR_NAME:-${PREFIX}acr$RANDOM}"
ACA_ENV="${ACA_ENV:-${PREFIX}-env}"
PG_SERVER="${PG_SERVER:-${PREFIX}-pg}"
PG_DB="${PG_DB:-prabhatai}"
WEB_APP="${WEB_APP:-${PREFIX}-web}"
API_APP="${API_APP:-${PREFIX}-api}"
LAW="${LAW:-${PREFIX}-law}"

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }

az group create --name "$RG" --location "$LOCATION" >/dev/null

az acr create \
  --name "$ACR_NAME" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --sku Basic \
  --admin-enabled true >/dev/null

ACR_LOGIN_SERVER="$(az acr show --name "$ACR_NAME" --resource-group "$RG" --query loginServer -o tsv)"
ACR_USERNAME="$(az acr credential show --name "$ACR_NAME" --resource-group "$RG" --query username -o tsv)"
ACR_PASSWORD="$(az acr credential show --name "$ACR_NAME" --resource-group "$RG" --query "passwords[0].value" -o tsv)"

az acr build \
  --registry "$ACR_NAME" \
  --image "prabhat-samgiita-api:${TAG}" \
  --file "${ROOT_DIR}/apps/api/Dockerfile" \
  "$ROOT_DIR" >/dev/null

az monitor log-analytics workspace create \
  --resource-group "$RG" \
  --workspace-name "$LAW" \
  --location "$LOCATION" >/dev/null

LAW_ID="$(az monitor log-analytics workspace show --resource-group "$RG" --workspace-name "$LAW" --query customerId -o tsv)"
LAW_KEY="$(az monitor log-analytics workspace get-shared-keys --resource-group "$RG" --workspace-name "$LAW" --query primarySharedKey -o tsv)"

az containerapp env create \
  --name "$ACA_ENV" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --logs-destination log-analytics \
  --logs-workspace-id "$LAW_ID" \
  --logs-workspace-key "$LAW_KEY" >/dev/null

az postgres flexible-server create \
  --name "$PG_SERVER" \
  --resource-group "$RG" \
  --location "$LOCATION" \
  --admin-user "$PG_ADMIN" \
  --admin-password "$PG_PASSWORD" \
  --tier Burstable \
  --sku-name Standard_B1ms \
  --version 16 \
  --storage-size 32 \
  --public-access 0.0.0.0 >/dev/null

az postgres flexible-server db create \
  --database-name "$PG_DB" \
  --server-name "$PG_SERVER" \
  --resource-group "$RG" >/dev/null

az postgres flexible-server parameter set \
  --resource-group "$RG" \
  --server-name "$PG_SERVER" \
  --name azure.extensions \
  --value vector >/dev/null

az postgres flexible-server restart --resource-group "$RG" --name "$PG_SERVER" >/dev/null

PG_HOST="$(az postgres flexible-server show --resource-group "$RG" --name "$PG_SERVER" --query fullyQualifiedDomainName -o tsv)"
PG_PASSWORD_ENC="$(printf '%s' "$PG_PASSWORD" | urlencode)"
DATABASE_URL="postgresql+psycopg://${PG_ADMIN}:${PG_PASSWORD_ENC}@${PG_HOST}:5432/${PG_DB}?sslmode=require"

az containerapp create \
  --name "$API_APP" \
  --resource-group "$RG" \
  --environment "$ACA_ENV" \
  --image "${ACR_LOGIN_SERVER}/prabhat-samgiita-api:${TAG}" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --ingress external \
  --target-port 8000 \
  --min-replicas 0 \
  --max-replicas 3 \
  --env-vars \
    DATABASE_URL="$DATABASE_URL" \
    APP_ENV=production \
    API_CORS_ORIGINS="*" \
    CONTENT_SOURCE_URL=https://prabhatasamgiita.net \
    CONTENT_CACHE_DIR=/tmp/content-cache \
    LOG_LEVEL=INFO >/dev/null

API_FQDN="$(az containerapp show --name "$API_APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

az acr build \
  --registry "$ACR_NAME" \
  --image "prabhat-samgiita-web:${TAG}" \
  --file "${ROOT_DIR}/apps/web/Dockerfile" \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=https://${API_FQDN}" \
  "$ROOT_DIR" >/dev/null

az containerapp create \
  --name "$WEB_APP" \
  --resource-group "$RG" \
  --environment "$ACA_ENV" \
  --image "${ACR_LOGIN_SERVER}/prabhat-samgiita-web:${TAG}" \
  --registry-server "$ACR_LOGIN_SERVER" \
  --registry-username "$ACR_USERNAME" \
  --registry-password "$ACR_PASSWORD" \
  --ingress external \
  --target-port 3000 \
  --min-replicas 0 \
  --max-replicas 3 \
  --env-vars \
    NEXT_PUBLIC_API_BASE_URL="https://${API_FQDN}" >/dev/null

WEB_FQDN="$(az containerapp show --name "$WEB_APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

cat <<EOF
Deployment complete.
Web: https://${WEB_FQDN}
API: https://${API_FQDN}
Registry: ${ACR_LOGIN_SERVER}
EOF
