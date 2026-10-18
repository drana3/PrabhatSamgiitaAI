#!/usr/bin/env bash
set -euo pipefail

# Register custom hostnames on prabhatai-www. DNS must follow Azure validation instructions.
RG="${RG:-prabhatai-rg}"
SWA_NAME="${SWA_NAME:-prabhatai-www}"
WWW_HOST="${WWW_HOST:-www.prabhatasamgiita.org}"
APEX_HOST="${APEX_HOST:-prabhatasamgiita.org}"

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }

DEFAULT_HOST="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" --query defaultHostname -o tsv)"
echo "Static Web App default hostname: https://${DEFAULT_HOST}"
echo ""
echo "Create DNS at your registrar BEFORE running hostname set (Azure validates CNAME):"
echo "  ${WWW_HOST}  CNAME  ${DEFAULT_HOST}"
echo "  ${APEX_HOST}         follow Azure Portal validation records after www is Ready"
echo ""

if [[ "${SKIP_DNS_CHECK:-}" != "1" ]]; then
  echo "After DNS propagates, run: CONFIRM=1 ./infra/azure/attach-swa-custom-domains.sh"
  exit 0
fi

for HOST in "$WWW_HOST" "$APEX_HOST"; do
  echo "Attaching ${HOST}..."
  az staticwebapp hostname set \
    --hostname "$HOST" \
    --name "$SWA_NAME" \
    --resource-group "$RG" \
    >/dev/null
  echo "  Requested. In Azure Portal → Custom domains, copy DNS records (TXT/CNAME) for ${HOST}."
  echo "  Typical www CNAME target: ${DEFAULT_HOST}"
  echo ""
done

echo "After domains show Ready in Azure Portal:"
echo "  PUBLIC_SITE_URL=https://${WWW_HOST} ./infra/azure/sync-swa-app-settings.sh"
