#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RG="${RG:-prabhatai-rg}"
LOCATION="${LOCATION:-centralindia}"
PREFIX="${PREFIX:-prabhatai}"
TAG="${TAG:-$(date +%Y%m%d%H%M%S)}"
PG_ADMIN="${PG_ADMIN:-codexadmin}"
PG_PASSWORD="${PG_PASSWORD:-}"
ACR_NAME="${ACR_NAME:-${PREFIX}acr}"
ACA_ENV="${ACA_ENV:-${PREFIX}-env}"
PG_SERVER="${PG_SERVER:-${PREFIX}-pg}"
PG_DB="${PG_DB:-prabhatai}"
WEB_APP="${WEB_APP:-${PREFIX}-web}"
API_APP="${API_APP:-${PREFIX}-api}"
AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-}"
AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY:-}"
AZURE_OPENAI_CHAT_DEPLOYMENT="${AZURE_OPENAI_CHAT_DEPLOYMENT:-${AZURE_OPENAI_DEPLOYMENT:-}}"
AZURE_OPENAI_EMBEDDING_DEPLOYMENT="${AZURE_OPENAI_EMBEDDING_DEPLOYMENT:-${AZURE_OPENAI_CHAT_DEPLOYMENT:-}}"
AZURE_OPENAI_API_VERSION="${AZURE_OPENAI_API_VERSION:-2024-10-21}"

if [[ -z "${PG_PASSWORD}" ]]; then
  echo "Set PG_PASSWORD to a strong password before running."
  exit 1
fi

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }

az group show --name "$RG" >/dev/null
az acr show --name "$ACR_NAME" --resource-group "$RG" >/dev/null
az containerapp env show --name "$ACA_ENV" --resource-group "$RG" >/dev/null
az postgres flexible-server show --name "$PG_SERVER" --resource-group "$RG" >/dev/null
az containerapp show --name "$API_APP" --resource-group "$RG" >/dev/null
az containerapp show --name "$WEB_APP" --resource-group "$RG" >/dev/null

ACR_LOGIN_SERVER="$(az acr show --name "$ACR_NAME" --resource-group "$RG" --query loginServer -o tsv)"
PG_HOST="$(az postgres flexible-server show --resource-group "$RG" --name "$PG_SERVER" --query fullyQualifiedDomainName -o tsv)"
DATABASE_URL="postgresql+psycopg://${PG_ADMIN}:${PG_PASSWORD}@${PG_HOST}:5432/${PG_DB}?sslmode=require"

az acr build \
  --registry "$ACR_NAME" \
  --image "prabhat-samgiita-api:${TAG}" \
  --file "${ROOT_DIR}/apps/api/Dockerfile" \
  "$ROOT_DIR" >/dev/null

az acr build \
  --registry "$ACR_NAME" \
  --image "prabhat-samgiita-web:${TAG}" \
  --file "${ROOT_DIR}/apps/web/Dockerfile" \
  "$ROOT_DIR" >/dev/null

API_IMAGE="${ACR_LOGIN_SERVER}/prabhat-samgiita-api:${TAG}"
WEB_IMAGE="${ACR_LOGIN_SERVER}/prabhat-samgiita-web:${TAG}"

az containerapp update \
  --name "$API_APP" \
  --resource-group "$RG" \
  --image "$API_IMAGE" \
  --set-env-vars \
    DATABASE_URL="$DATABASE_URL" \
    APP_ENV=production \
    API_CORS_ORIGINS="*" \
    CONTENT_SOURCE_URL=https://prabhatasamgiita.net \
    CONTENT_CACHE_DIR=/tmp/content-cache \
    LOG_LEVEL=INFO \
    AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
    AZURE_OPENAI_API_KEY="$AZURE_OPENAI_API_KEY" \
    AZURE_OPENAI_DEPLOYMENT="$AZURE_OPENAI_CHAT_DEPLOYMENT" \
    AZURE_OPENAI_CHAT_DEPLOYMENT="$AZURE_OPENAI_CHAT_DEPLOYMENT" \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT="$AZURE_OPENAI_EMBEDDING_DEPLOYMENT" \
    AZURE_OPENAI_API_VERSION="$AZURE_OPENAI_API_VERSION" >/dev/null

API_FQDN="$(az containerapp show --name "$API_APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

az containerapp update \
  --name "$WEB_APP" \
  --resource-group "$RG" \
  --image "$WEB_IMAGE" \
  --set-env-vars \
    NEXT_PUBLIC_API_BASE_URL="https://${API_FQDN}" >/dev/null

WEB_FQDN="$(az containerapp show --name "$WEB_APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

cat <<EOF
Deployment complete.
Web: https://${WEB_FQDN}
API: https://${API_FQDN}
Registry: ${ACR_LOGIN_SERVER}
EOF
