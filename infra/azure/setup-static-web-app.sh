#!/usr/bin/env bash
set -euo pipefail

# One-time bootstrap for hosting the Next.js site on Azure Static Web Apps (Standard).
# Container Apps web (prabhatai-web) can be decommissioned after DNS cutover.

RG="${RG:-prabhatai-rg}"
SWA_NAME="${SWA_NAME:-prabhatai-www}"
# Static Web Apps is not available in centralindia; East Asia is closest to the API region.
SWA_LOCATION="${SWA_LOCATION:-eastasia}"
SKU="${SKU:-Standard}"

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }

if ! az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" >/dev/null 2>&1; then
  echo "Creating Static Web App ${SWA_NAME} (${SKU}, ${SWA_LOCATION})..."
  az staticwebapp create \
    --name "$SWA_NAME" \
    --resource-group "$RG" \
    --location "$SWA_LOCATION" \
    --sku "$SKU" \
    >/dev/null
else
  echo "Static Web App ${SWA_NAME} already exists."
fi

HOSTNAME="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" --query defaultHostname -o tsv)"
TOKEN="$(az staticwebapp secrets list --name "$SWA_NAME" --resource-group "$RG" --query properties.apiKey -o tsv)"

cat <<EOF

Static Web App ready.
  Default URL: https://${HOSTNAME}

Next steps:
  1. Add GitHub Actions secret AZURE_STATIC_WEB_APPS_API_TOKEN (deployment token).
  2. Run: ./infra/azure/sync-swa-app-settings.sh
  3. Merge/deploy — web ships via deploy.yml (Static Web Apps), not prabhatai-web Container App.
  4. Validate https://${HOSTNAME} then attach custom domains (see infra/azure/README.md).
  5. Run: CONFIRM=1 ./infra/azure/decommission-web-container-app.sh

Deployment token (also stored in Azure; add to GitHub Secrets):
  ${TOKEN}

EOF
