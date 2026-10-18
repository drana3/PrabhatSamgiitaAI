#!/usr/bin/env bash
# Smoke-check account deletion URLs for Play Console / Apple privacy forms.
set -euo pipefail

SWA_DEFAULT="${SWA_DEFAULT_HOST:-yellow-desert-06a0d4a00.2.azurestaticapps.net}"
CANONICAL="https://www.prabhatasamgiita.org/delete-account"
PRIVACY_CANONICAL="https://www.prabhatasamgiita.org/privacy"
SWA_URL="https://${SWA_DEFAULT}/delete-account"
SWA_PRIVACY="https://${SWA_DEFAULT}/privacy"
LEGACY_CONTAINER="https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io/delete-account"

check() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" -L --max-time 25 "$url" || echo "000")"
  if [[ "$code" == "200" ]]; then
    echo "OK   $code  $url"
    return 0
  fi
  echo "FAIL $code  $url"
  return 1
}

echo "Public policy URL checks"
echo ""

ok=0
check "$SWA_URL" && ok=1
check "$SWA_PRIVACY" && ok=1
check "$CANONICAL" || true
check "$PRIVACY_CANONICAL" || true
check "$LEGACY_CONTAINER" || true

echo ""
if [[ "$ok" == "1" ]]; then
  echo "Use in Play / App Store (until www DNS is fixed):"
  echo "  Privacy:         $SWA_PRIVACY"
  echo "  Delete account:  $SWA_URL"
  exit 0
fi

echo "No working URL found. Deploy web (GitHub Actions Deploy → deploy_web) or fix DNS per docs/play-data-safety.md"
exit 1
