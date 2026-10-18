#!/usr/bin/env bash
set -euo pipefail

# Stops billing for prabhatai-web on Container Apps after Static Web Apps serves production traffic.

RG="${RG:-prabhatai-rg}"
WEB_APP="${WEB_APP:-prabhatai-web}"

if [[ "${CONFIRM:-}" != "1" ]]; then
  cat <<EOF
This deletes the ${WEB_APP} Container App (custom domain must already point at Static Web Apps).

Re-run with: CONFIRM=1 $0
EOF
  exit 1
fi

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }

if ! az containerapp show --name "$WEB_APP" --resource-group "$RG" >/dev/null 2>&1; then
  echo "${WEB_APP} is already removed."
  exit 0
fi

echo "Deleting ${WEB_APP}..."
az containerapp delete --name "$WEB_APP" --resource-group "$RG" --yes
echo "Deleted. API (${API_APP:-prabhatai-api}) and mobile builds are unchanged."
