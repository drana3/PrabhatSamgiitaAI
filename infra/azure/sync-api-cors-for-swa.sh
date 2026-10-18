#!/usr/bin/env bash
set -euo pipefail

# Ensures prabhatai-api allows browser calls from Static Web Apps (and canonical www).
RG="${RG:-prabhatai-rg}"
SWA_NAME="${SWA_NAME:-prabhatai-www}"
API_APP="${API_APP:-prabhatai-api}"
WEB_APP="${WEB_APP:-prabhatai-web}"

command -v az >/dev/null || { echo "Azure CLI is required."; exit 1; }

SWA_HOST="$(az staticwebapp show --name "$SWA_NAME" --resource-group "$RG" --query defaultHostname -o tsv)"
REQUIRED=(
  "https://www.prabhatasamgiita.org"
  "https://prabhatasamgiita.org"
  "https://${SWA_HOST}"
)

WEB_FQDN="$(az containerapp show --name "$WEB_APP" --resource-group "$RG" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || true)"
if [[ -n "$WEB_FQDN" ]]; then
  REQUIRED+=("https://${WEB_FQDN}")
fi

CURRENT="$(
  az containerapp show --name "$API_APP" --resource-group "$RG" \
    --query "properties.template.containers[0].env[?name=='API_CORS_ORIGINS'].value | [0]" -o tsv 2>/dev/null || true
)"

merge_origins() {
  python3 - <<'PY' "$CURRENT" "${REQUIRED[@]}"
import sys
existing = [o.strip() for o in (sys.argv[1] or "").split(",") if o.strip()]
required = [o.strip() for o in sys.argv[2:] if o.strip()]
seen = set()
merged = []
for origin in existing + required:
    if origin in seen:
        continue
    seen.add(origin)
    merged.append(origin)
print(",".join(merged))
PY
}

MERGED="$(merge_origins)"
if [[ "$MERGED" == "$CURRENT" ]]; then
  echo "API_CORS_ORIGINS already includes SWA + www (${API_APP})."
  exit 0
fi

echo "Updating ${API_APP} API_CORS_ORIGINS..."
az containerapp update \
  --name "$API_APP" \
  --resource-group "$RG" \
  --set-env-vars "API_CORS_ORIGINS=${MERGED}" \
  >/dev/null

echo "Done. Origins: ${MERGED}"
