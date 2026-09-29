#!/usr/bin/env bash
set -euo pipefail

RG="${RG:-prabhatai-rg}"
SWA_NAME="${SWA_NAME:-prabhatai-www}"
WEB_APP="${WEB_APP:-prabhatai-web}"
API_APP="${API_APP:-prabhatai-api}"

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }

az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" >/dev/null

API_FQDN="$(az containerapp show --name "$API_APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
API_BASE="https://${API_FQDN}"

read_secret() {
  local app="$1" name="$2"
  az containerapp secret show --name "$app" --resource-group "$RG" --secret-name "$name" --query value -o tsv 2>/dev/null || true
}

MEMBER_PROXY_KEY="${MEMBER_PROXY_KEY:-$(read_secret "$API_APP" member-proxy-key)}"
AZURE_CLIENT_SECRET="${AZURE_CLIENT_SECRET:-$(read_secret "$WEB_APP" microsoft-provider-authentication-secret)}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-$(read_secret "$WEB_APP" google-client-secret)}"

GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-$(
  az containerapp show --name "$WEB_APP" --resource-group "$RG" \
    --query "properties.template.containers[0].env[?name=='GOOGLE_CLIENT_ID'].value | [0]" -o tsv 2>/dev/null || true
)}"
AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-$(
  az containerapp auth show --name "$WEB_APP" --resource-group "$RG" \
    --query identityProviders.azureActiveDirectory.registration.clientId -o tsv 2>/dev/null || true
)}"

if [[ -z "$MEMBER_PROXY_KEY" ]]; then
  echo "Set MEMBER_PROXY_KEY or ensure ${API_APP} has member-proxy-key secret."
  exit 1
fi

echo "Syncing ${SWA_NAME} application settings (API → ${API_BASE})..."

HOSTNAME="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" --query defaultHostname -o tsv)"
PUBLIC_SITE="${PUBLIC_SITE_URL:-https://${HOSTNAME}}"

SETTINGS=(
  "NEXT_PUBLIC_API_BASE_URL=${API_BASE}"
  "API_BASE_URL=${API_BASE}"
  "NEXT_PUBLIC_AUTH_ENABLED=true"
  "NEXT_PUBLIC_SITE_URL=${PUBLIC_SITE}"
  "AZURE_CLIENT_ID=${AZURE_CLIENT_ID}"
  "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
  "DEFAULT_ADMIN_EMAILS=${DEFAULT_ADMIN_EMAILS:-dewasheesh.rana3@gmail.com}"
)
[[ -n "$MEMBER_PROXY_KEY" ]] && SETTINGS+=("MEMBER_PROXY_KEY=${MEMBER_PROXY_KEY}")
[[ -n "$AZURE_CLIENT_SECRET" ]] && SETTINGS+=("AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET}")
[[ -n "$GOOGLE_CLIENT_SECRET" ]] && SETTINGS+=("GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}")

az staticwebapp appsettings set \
  --name "$SWA_NAME" \
  --resource-group "$RG" \
  --setting-names "${SETTINGS[@]}" \
  >/dev/null

echo "Syncing API CORS for SWA hostname..."
bash "$(dirname "$0")/sync-api-cors-for-swa.sh"

echo "Done. Test at https://${HOSTNAME}"
echo "Microsoft sign-in uses staticwebapp.config.json + AZURE_CLIENT_ID / AZURE_CLIENT_SECRET."
echo "Entra app registration → Authentication:"
echo "  Redirect URI (Web): https://${HOSTNAME}/.auth/login/aad/callback"
echo "  Front-channel logout URL: https://${HOSTNAME}/.auth/logout/complete"
echo "After custom domain, also add www variants of both URLs."
