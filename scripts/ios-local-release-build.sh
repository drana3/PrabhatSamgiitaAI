#!/usr/bin/env bash
# Local iOS App Store build for Prabhat Samgiita AI.
# Fixes common macOS Tahoe / WWDR certificate issues before running EAS --local.
#
# Usage:
#   ./scripts/ios-local-release-build.sh
#   ./scripts/ios-local-release-build.sh --non-interactive
#
# Output: apps/mobile/build-<timestamp>.ipa (same pattern as Android local .aab)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
OUT_FILE="$MOBILE/build-$(date +%s)000.ipa"

echo "==> Checking fastlane..."
command -v fastlane >/dev/null || { echo "Install fastlane: brew install fastlane"; exit 1; }

echo "==> Ensuring Apple WWDR intermediate certificates..."
TMPDIR_CERTS="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_CERTS"' EXIT
curl -fsSL -o "$TMPDIR_CERTS/AppleWWDRCAG3.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer"
curl -fsSL -o "$TMPDIR_CERTS/AppleWWDRCAG6.cer" "https://www.apple.com/certificateauthority/AppleWWDRCAG6.cer"
security add-trusted-cert -d -r unspecified -k ~/Library/Keychains/login.keychain-db "$TMPDIR_CERTS/AppleWWDRCAG3.cer" || true
security add-trusted-cert -d -r unspecified -k ~/Library/Keychains/login.keychain-db "$TMPDIR_CERTS/AppleWWDRCAG6.cer" || true

echo "==> Unlocking login keychain..."
if [[ -n "${KEYCHAIN_PASSWORD:-}" ]]; then
  security unlock-keychain -p "$KEYCHAIN_PASSWORD" ~/Library/Keychains/login.keychain-db
elif [[ -t 0 ]]; then
  security unlock-keychain ~/Library/Keychains/login.keychain-db || true
else
  echo "    Non-interactive shell — skipping unlock prompt."
  echo "    If signing fails, run: security unlock-keychain ~/Library/Keychains/login.keychain-db"
fi

echo "==> Patching EAS build-tools for macOS Tahoe keychain validation..."
npx -y eas-cli-local-build-plugin@22.0.0 --help >/dev/null 2>&1 || true
while IFS= read -r keychain_js; do
  if grep -q "find-identity', '-v'" "$keychain_js" 2>/dev/null; then
    sed -i '' "s/find-identity', '-v'/find-identity'/g" "$keychain_js"
    echo "    Patched: $keychain_js"
  fi
done < <(find "${TMPDIR:-/tmp}" "$HOME/.npm" -path "*/@expo/build-tools/dist/**/keychain.js" 2>/dev/null || true)

echo "==> Loading mobile env (member sync key, OAuth)..."
if [[ -f "$MOBILE/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$MOBILE/.env"
  set +a
fi
if [[ -z "${EXPO_PUBLIC_MEMBER_PROXY_KEY:-}" ]]; then
  echo "ERROR: EXPO_PUBLIC_MEMBER_PROXY_KEY is missing. Website favorites, quiz, and admin will not sync."
  echo "Add it to apps/mobile/.env (same value as API MEMBER_PROXY_KEY) and rebuild."
  exit 1
fi
echo "    Member proxy key is set (${#EXPO_PUBLIC_MEMBER_PROXY_KEY} chars)."

echo "==> Syncing ios/ MARKETING_VERSION from app.json..."
bash "$ROOT/scripts/sync-ios-version-from-app-json.sh"

APP_VERSION="$(python3 -c "import json; print(json.load(open('$MOBILE/app.json'))['expo']['version'])")"
BUILD_NUMBER="$(python3 -c "import json; print(json.load(open('$MOBILE/app.json'))['expo']['ios']['buildNumber'])")"

echo "==> Starting local iOS production build..."
echo "    version $APP_VERSION · iOS build $BUILD_NUMBER"
echo "    Output: $OUT_FILE"
cd "$MOBILE"
export EAS_BUILD_NO_EXPO_GO_WARNING=true

npx eas-cli@22.0.0 build \
  --platform ios \
  --profile production \
  --local \
  --non-interactive \
  --output "$OUT_FILE" \
  --wait \
  "$@"

echo
echo "✅ iOS artifact ready: $OUT_FILE"
echo "   bundle net.prabhatasamgiita.ai · version $APP_VERSION · build $BUILD_NUMBER"
echo "   Upload via Transporter or: npx eas-cli submit --platform ios --path \"$OUT_FILE\""
