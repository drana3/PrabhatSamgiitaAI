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

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().rstrip("\n"), safe=""))'
}

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }

az group show --name "$RG" >/dev/null
az acr show --name "$ACR_NAME" --resource-group "$RG" >/dev/null
az containerapp env show --name "$ACA_ENV" --resource-group "$RG" >/dev/null
az postgres flexible-server show --name "$PG_SERVER" --resource-group "$RG" >/dev/null
az containerapp show --name "$API_APP" --resource-group "$RG" >/dev/null
az containerapp show --name "$WEB_APP" --resource-group "$RG" >/dev/null

ACR_LOGIN_SERVER="$(az acr show --name "$ACR_NAME" --resource-group "$RG" --query loginServer -o tsv)"
PG_HOST="$(az postgres flexible-server show --resource-group "$RG" --name "$PG_SERVER" --query fullyQualifiedDomainName -o tsv)"
PG_PASSWORD_ENC="$(printf '%s' "$PG_PASSWORD" | urlencode)"
DATABASE_URL="postgresql+psycopg://${PG_ADMIN}:${PG_PASSWORD_ENC}@${PG_HOST}:5432/${PG_DB}?sslmode=require"
WEB_FQDN="$(az containerapp show --name "$WEB_APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
API_FQDN="$(az containerapp show --name "$API_APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"

az acr build \
  --registry "$ACR_NAME" \
  --image "prabhat-samgiita-api:${TAG}" \
  --file "${ROOT_DIR}/apps/api/Dockerfile" \
  "$ROOT_DIR" >/dev/null

API_IMAGE="${ACR_LOGIN_SERVER}/prabhat-samgiita-api:${TAG}"

az containerapp update \
  --name "$API_APP" \
  --resource-group "$RG" \
  --image "$API_IMAGE" \
  --set-env-vars \
    DATABASE_URL="$DATABASE_URL" \
    APP_ENV=production \
    API_CORS_ORIGINS="https://${WEB_FQDN}" \
    TRUSTED_HOSTS="${API_FQDN},localhost,127.0.0.1" \
    CONTENT_SOURCE_URL=https://prabhatasamgiita.net \
    CONTENT_CACHE_DIR=/tmp/content-cache \
    LOG_LEVEL=INFO \
    AZURE_OPENAI_ENDPOINT="$AZURE_OPENAI_ENDPOINT" \
    AZURE_OPENAI_API_KEY="$AZURE_OPENAI_API_KEY" \
    AZURE_OPENAI_DEPLOYMENT="$AZURE_OPENAI_CHAT_DEPLOYMENT" \
    AZURE_OPENAI_CHAT_DEPLOYMENT="$AZURE_OPENAI_CHAT_DEPLOYMENT" \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT="$AZURE_OPENAI_EMBEDDING_DEPLOYMENT" \
    AZURE_OPENAI_API_VERSION="$AZURE_OPENAI_API_VERSION" >/dev/null

API_READY=""
for attempt in $(seq 1 30); do
  if API_READY="$(curl --fail --silent --show-error "https://${API_FQDN}/api/v1/health/readiness" 2>/dev/null)"; then
    if printf '%s' "$API_READY" | python3 -c 'import json, sys; data=json.load(sys.stdin); raise SystemExit(0 if data.get("snapshot_complete") and data.get("snapshot", {}).get("songs") == 5018 else 1)'; then
      break
    fi
  fi
  API_READY=""
  sleep 10
done

if [[ -z "$API_READY" ]]; then
  echo "API readiness check failed: the packaged 5,018-song catalog is unavailable."
  exit 1
fi

curl --fail --silent --show-error "https://${API_FQDN}/api/v1/songs/5018" >/dev/null
SEARCH_SMOKE="$(curl --fail --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"query":"111"}' \
  "https://${API_FQDN}/api/v1/search")"
printf '%s' "$SEARCH_SMOKE" | python3 -c 'import json, sys; rows=json.load(sys.stdin); raise SystemExit(0 if any(row.get("number") == 111 for row in rows) else 1)'

INDEX_READY=""
for attempt in $(seq 1 360); do
  READINESS="$(curl --fail --silent --show-error "https://${API_FQDN}/api/v1/health/readiness" 2>/dev/null || true)"
  if [[ -n "$READINESS" ]]; then
    if printf '%s' "$READINESS" | python3 -c 'import json, sys; data=json.load(sys.stdin); provider=data.get("embedding_provider_configured", False); indexed=data.get("embedding_progress", 0) >= 1; ready=data.get("database_synced") and data.get("rag_chunks_ready") and (indexed if provider else True); raise SystemExit(0 if ready else 1)'; then
      INDEX_READY="$READINESS"
      break
    fi
  fi
  sleep 10
done

if [[ -z "$INDEX_READY" ]]; then
  echo "API indexing did not finish within 60 minutes."
  curl --fail --silent --show-error "https://${API_FQDN}/api/v1/health/readiness" || true
  exit 1
fi

az acr build \
  --registry "$ACR_NAME" \
  --image "prabhat-samgiita-web:${TAG}" \
  --file "${ROOT_DIR}/apps/web/Dockerfile" \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=https://${API_FQDN}" \
  "$ROOT_DIR" >/dev/null

WEB_IMAGE="${ACR_LOGIN_SERVER}/prabhat-samgiita-web:${TAG}"

az containerapp update \
  --name "$WEB_APP" \
  --resource-group "$RG" \
  --image "$WEB_IMAGE" \
  --set-env-vars \
    NEXT_PUBLIC_API_BASE_URL="https://${API_FQDN}" >/dev/null

python3 "${ROOT_DIR}/scripts/validate_live_backend.py" "https://${API_FQDN}"

cat <<EOF
Deployment complete.
Web: https://${WEB_FQDN}
API: https://${API_FQDN}
Registry: ${ACR_LOGIN_SERVER}
EOF
