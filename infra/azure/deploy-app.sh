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
MEMBER_PROXY_KEY="${MEMBER_PROXY_KEY:-}"
DEFAULT_ADMIN_EMAILS="${DEFAULT_ADMIN_EMAILS:-}"
PROTECTED_ADMIN_EMAILS="${PROTECTED_ADMIN_EMAILS:-dewasheesh.rana3@gmail.com}"
ACS_EMAIL_ENABLED="${ACS_EMAIL_ENABLED:-true}"
ACS_EMAIL_FROM="${ACS_EMAIL_FROM:-DoNotReply@a6f8f0fe-ff1d-4f62-8b88-43cd0f36675a.azurecomm.net}"
ACS_EMAIL_CONNECTION_STRING="${ACS_EMAIL_CONNECTION_STRING:-}"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-}"
NEXT_PUBLIC_FACEBOOK_APP_ID="${NEXT_PUBLIC_FACEBOOK_APP_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"

if [[ -z "${PG_PASSWORD}" ]]; then
  echo "Set PG_PASSWORD to a strong password before running."
  exit 1
fi

if [[ -z "${MEMBER_PROXY_KEY}" ]]; then
  # v2 salt rotates any proxy key that was previously leaked into CI logs.
  MEMBER_PROXY_KEY="$(printf 'prabhatai-member-proxy:v2:%s' "$PG_PASSWORD" | python3 -c 'import hashlib,sys; print(hashlib.sha256(sys.stdin.buffer.read()).hexdigest())')"
fi

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read().rstrip("\n"), safe=""))'
}

# Container Apps often return 503 while a new revision is warming or swapping traffic.
# First argument is a safe label for logs; never print raw curl args (they may include secrets).
curl_retry() {
  local label="$1"
  shift
  local attempts="${CURL_RETRY_ATTEMPTS:-30}"
  local sleep_seconds="${CURL_RETRY_SLEEP_SECONDS:-10}"
  local attempt output
  for attempt in $(seq 1 "$attempts"); do
    if output="$(curl --fail --silent --show-error "$@" 2>/dev/null)"; then
      printf '%s' "$output"
      return 0
    fi
    sleep "$sleep_seconds"
  done
  echo "Request failed after ${attempts} attempts: ${label}" >&2
  return 1
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
AUTH_ENABLED="$(az containerapp auth show --name "$WEB_APP" --resource-group "$RG" --query platform.enabled -o tsv 2>/dev/null || true)"
if [[ "$AUTH_ENABLED" != "true" ]]; then
  AUTH_ENABLED=false
fi

az containerapp secret set \
  --name "$API_APP" \
  --resource-group "$RG" \
  --secrets member-proxy-key="$MEMBER_PROXY_KEY" >/dev/null

if [[ -n "${ACS_EMAIL_CONNECTION_STRING}" ]]; then
  az containerapp secret set \
    --name "$API_APP" \
    --resource-group "$RG" \
    --secrets acs-email-connection-string="$ACS_EMAIL_CONNECTION_STRING" >/dev/null
fi

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
    AZURE_OPENAI_API_VERSION="$AZURE_OPENAI_API_VERSION" \
    MEMBER_PROXY_KEY=secretref:member-proxy-key \
    DEFAULT_ADMIN_EMAILS="$DEFAULT_ADMIN_EMAILS" \
    PROTECTED_ADMIN_EMAILS="$PROTECTED_ADMIN_EMAILS" \
    PUBLIC_SITE_URL="https://${WEB_FQDN}" \
    ACS_EMAIL_ENABLED="$ACS_EMAIL_ENABLED" \
    ACS_EMAIL_FROM="$ACS_EMAIL_FROM" \
    ACS_EMAIL_CONNECTION_STRING=secretref:acs-email-connection-string \
    AZURE_OPENAI_RESPONSES_API_VERSION=2025-04-01-preview >/dev/null

API_READY=""
for attempt in $(seq 1 45); do
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

curl_retry "api-song-5018" "https://${API_FQDN}/api/v1/songs/5018" >/dev/null
SEARCH_SMOKE="$(curl_retry "api-search-111" \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{"query":"111"}' \
  "https://${API_FQDN}/api/v1/search")"
printf '%s' "$SEARCH_SMOKE" | python3 -c 'import json, sys; rows=json.load(sys.stdin); raise SystemExit(0 if any(row.get("number") == 111 for row in rows) else 1)'

# Build the web image while the API finishes indexing so ACR time overlaps
# the readiness wait instead of stacking after it.
WEB_BUILD_LOG="$(mktemp)"
(
  az acr build \
    --registry "$ACR_NAME" \
    --image "prabhat-samgiita-web:${TAG}" \
    --file "${ROOT_DIR}/apps/web/Dockerfile" \
    --build-arg "NEXT_PUBLIC_API_BASE_URL=https://${API_FQDN}" \
    --build-arg "NEXT_PUBLIC_AUTH_ENABLED=${AUTH_ENABLED}" \
    --build-arg "NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}" \
    --build-arg "NEXT_PUBLIC_FACEBOOK_APP_ID=${NEXT_PUBLIC_FACEBOOK_APP_ID}" \
    "$ROOT_DIR" >/dev/null
) >"$WEB_BUILD_LOG" 2>&1 &
WEB_BUILD_PID=$!

INDEX_READY=""
for attempt in $(seq 1 360); do
  if [[ -n "${WEB_BUILD_PID}" ]] && ! kill -0 "$WEB_BUILD_PID" 2>/dev/null; then
    if ! wait "$WEB_BUILD_PID"; then
      echo "Web image build failed while waiting for API indexing."
      cat "$WEB_BUILD_LOG" || true
      exit 1
    fi
    WEB_BUILD_PID=""
  fi
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
  if [[ -n "${WEB_BUILD_PID}" ]]; then
    kill "$WEB_BUILD_PID" 2>/dev/null || true
    wait "$WEB_BUILD_PID" 2>/dev/null || true
  fi
  echo "API indexing did not finish within 60 minutes."
  curl --fail --silent --show-error "https://${API_FQDN}/api/v1/health/readiness" || true
  exit 1
fi

if [[ -n "${WEB_BUILD_PID}" ]]; then
  if ! wait "$WEB_BUILD_PID"; then
    echo "Web image build failed."
    cat "$WEB_BUILD_LOG" || true
    exit 1
  fi
fi
rm -f "$WEB_BUILD_LOG"

WEB_IMAGE="${ACR_LOGIN_SERVER}/prabhat-samgiita-web:${TAG}"

az containerapp secret set \
  --name "$WEB_APP" \
  --resource-group "$RG" \
  --secrets member-proxy-key="$MEMBER_PROXY_KEY" >/dev/null

WEB_COMMON_ENV=(
  "NEXT_PUBLIC_API_BASE_URL=https://${API_FQDN}"
  "NEXT_PUBLIC_AUTH_ENABLED=${AUTH_ENABLED}"
  "API_BASE_URL=https://${API_FQDN}"
  "MEMBER_PROXY_KEY=secretref:member-proxy-key"
  "DEFAULT_ADMIN_EMAILS=${DEFAULT_ADMIN_EMAILS}"
)
if [[ -n "${NEXT_PUBLIC_GOOGLE_CLIENT_ID}" ]]; then
  WEB_COMMON_ENV+=("GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}")
fi

if [[ -n "${GOOGLE_CLIENT_SECRET}" ]]; then
  az containerapp secret set \
    --name "$WEB_APP" \
    --resource-group "$RG" \
    --secrets google-client-secret="$GOOGLE_CLIENT_SECRET" >/dev/null
  az containerapp update \
    --name "$WEB_APP" \
    --resource-group "$RG" \
    --image "$WEB_IMAGE" \
    --set-env-vars \
      "${WEB_COMMON_ENV[@]}" \
      GOOGLE_CLIENT_SECRET=secretref:google-client-secret >/dev/null
else
  az containerapp update \
    --name "$WEB_APP" \
    --resource-group "$RG" \
    --image "$WEB_IMAGE" \
    --set-env-vars "${WEB_COMMON_ENV[@]}" >/dev/null
fi

WEB_REVISION="$(az containerapp revision list \
  --name "$WEB_APP" \
  --resource-group "$RG" \
  --query '[0].name' \
  -o tsv)"
if [[ -n "$WEB_REVISION" ]]; then
  az containerapp revision restart \
    --name "$WEB_APP" \
    --resource-group "$RG" \
    --revision "$WEB_REVISION" >/dev/null
fi
sleep 15

WEB_AUTH_READY=""
if [[ "$AUTH_ENABLED" == "true" ]]; then
  for attempt in $(seq 1 45); do
    SIGNIN_HTML="$(curl --fail --silent --show-error "https://${WEB_FQDN}/signin" 2>/dev/null || true)"
    if grep -q 'Continue with Microsoft' <<<"$SIGNIN_HTML" && \
      grep -q '/.auth/login/aad' <<<"$SIGNIN_HTML"; then
      WEB_AUTH_READY=true
      break
    fi
    sleep 10
  done

  if [[ -z "$WEB_AUTH_READY" ]]; then
    echo "Web authentication smoke check failed: Microsoft sign-in is not visible."
    exit 1
  fi
fi

python3 "${ROOT_DIR}/scripts/validate_live_backend.py" "https://${API_FQDN}"

# Authenticated member/admin smoke (never prints the proxy key).
MEMBER_SMOKE_PRINCIPAL="$(python3 - <<'PY'
import base64, json
payload = {
  "auth_typ": "aad",
  "claims": [
    {"typ": "http://schemas.microsoft.com/identity/claims/objectidentifier", "val": "deploy-smoke"},
    {"typ": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier", "val": "deploy-smoke"},
    {"typ": "name", "val": "Deploy Smoke"},
    {"typ": "email", "val": "deploy-smoke@prabhat.local"},
    {"typ": "preferred_username", "val": "deploy-smoke@prabhat.local"},
  ],
}
print(base64.b64encode(json.dumps(payload).encode()).decode())
PY
)"
MEMBER_SESSION_SMOKE="$(curl_retry "member-session" \
  --header "X-MS-CLIENT-PRINCIPAL: ${MEMBER_SMOKE_PRINCIPAL}" \
  --header "X-Member-Proxy-Key: ${MEMBER_PROXY_KEY}" \
  "https://${API_FQDN}/api/v1/members/session")" || {
  echo "Member session smoke failed after API warm-up." >&2
  exit 1
}
printf '%s' "$MEMBER_SESSION_SMOKE" | python3 -c 'import json,sys; data=json.load(sys.stdin); raise SystemExit(0 if data.get("authenticated") is True else 1)'
MEMBER_FEEDBACK_SMOKE="$(curl_retry "member-admin-feedback" \
  --header "X-MS-CLIENT-PRINCIPAL: ${MEMBER_SMOKE_PRINCIPAL}" \
  --header "X-Member-Proxy-Key: ${MEMBER_PROXY_KEY}" \
  "https://${API_FQDN}/api/v1/members/admin/feedback?status=new")" || {
  echo "Member admin feedback smoke failed after API warm-up." >&2
  exit 1
}
printf '%s' "$MEMBER_FEEDBACK_SMOKE" | python3 -c 'import json,sys; data=json.load(sys.stdin); raise SystemExit(0 if isinstance(data.get("items"), list) and "total" in data else 1)'
YOUTUBE_CHANNELS_STATUS="$(curl --silent --show-error --write-out '%{http_code}' --output /dev/null \
  --header "X-MS-CLIENT-PRINCIPAL: ${MEMBER_SMOKE_PRINCIPAL}" \
  --header "X-Member-Proxy-Key: ${MEMBER_PROXY_KEY}" \
  "https://${API_FQDN}/api/v1/members/admin/youtube-channels")" || YOUTUBE_CHANNELS_STATUS="000"
if [[ "$YOUTUBE_CHANNELS_STATUS" != "200" && "$YOUTUBE_CHANNELS_STATUS" != "401" && "$YOUTUBE_CHANNELS_STATUS" != "403" ]]; then
  echo "YouTube channel admin route smoke failed: expected 200/401/403, got ${YOUTUBE_CHANNELS_STATUS}." >&2
  echo "If this is 404, the API image is missing scripts/ or an old revision is still serving." >&2
  exit 1
fi
MEMBER_QUIZ_SMOKE="$(curl_retry "member-quiz-start" \
  --request POST \
  --header "Content-Type: application/json" \
  --header "X-MS-CLIENT-PRINCIPAL: ${MEMBER_SMOKE_PRINCIPAL}" \
  --header "X-Member-Proxy-Key: ${MEMBER_PROXY_KEY}" \
  --data '{"level":"starter"}' \
  "https://${API_FQDN}/api/v1/members/quiz/start")" || {
  echo "Member quiz start smoke failed after API warm-up." >&2
  exit 1
}
printf '%s' "$MEMBER_QUIZ_SMOKE" | python3 -c 'import json,sys; data=json.load(sys.stdin); raise SystemExit(0 if data.get("attempt_id") and len(data.get("questions") or []) == 10 else 1)'

# Remove the ephemeral deploy-smoke member so it does not appear as a duplicate admin.
curl_retry "member-smoke-cleanup" \
  --request DELETE \
  --header "X-MS-CLIENT-PRINCIPAL: ${MEMBER_SMOKE_PRINCIPAL}" \
  --header "X-Member-Proxy-Key: ${MEMBER_PROXY_KEY}" \
  "https://${API_FQDN}/api/v1/members/me" >/dev/null || {
  echo "Member smoke cleanup failed after API warm-up." >&2
  exit 1
}

cat <<EOF
Deployment complete.
Web: https://${WEB_FQDN}
API: https://${API_FQDN}
Registry: ${ACR_LOGIN_SERVER}
EOF
