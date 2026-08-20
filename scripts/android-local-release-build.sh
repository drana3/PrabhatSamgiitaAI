#!/usr/bin/env bash
# Local Android Play Store build for Prabhat Samgiita AI (no Expo cloud credits).
# Produces an .aab — same role as ./scripts/ios-local-release-build.sh for .ipa.
#
# Usage:
#   ./scripts/android-local-release-build.sh
#   ./scripts/android-local-release-build.sh --non-interactive
#   ./scripts/android-local-release-build.sh --clear-cache
#
# Sideload APK (optional):
#   PROFILE=preview-android ./scripts/android-local-release-build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
PROFILE="${PROFILE:-production}"
PLATFORM_OUT="aab"
if [[ "$PROFILE" == "preview-android" ]]; then
  PLATFORM_OUT="apk"
fi
OUT_FILE="$MOBILE/build-$(date +%s)000.${PLATFORM_OUT}"

echo "==> Checking Java (Android local builds need a JDK)..."
if ! command -v java >/dev/null; then
  echo "ERROR: Java not found. Install a JDK 17+, e.g.:"
  echo "  brew install --cask temurin@17"
  exit 1
fi
java -version 2>&1 | head -1 || true

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

VERSION_CODE="$(python3 -c "import json; print(json.load(open('$MOBILE/app.json'))['expo']['android']['versionCode'])")"
APP_VERSION="$(python3 -c "import json; print(json.load(open('$MOBILE/app.json'))['expo']['version'])")"

echo "==> Starting local Android build..."
echo "    Profile: $PROFILE"
echo "    version $APP_VERSION · versionCode $VERSION_CODE"
echo "    Output: $OUT_FILE"
cd "$MOBILE"
export EAS_BUILD_NO_EXPO_GO_WARNING=true

npx eas-cli@latest build \
  --platform android \
  --profile "$PROFILE" \
  --local \
  --non-interactive \
  --output "$OUT_FILE" \
  --wait \
  "$@"

echo
echo "✅ Android artifact ready: $OUT_FILE"
echo "   package net.prabhatasamgiita.ai · version $APP_VERSION · versionCode $VERSION_CODE"
if [[ "$PLATFORM_OUT" == "aab" ]]; then
  echo "   Upload this .aab to Play Console (internal / production track)."
else
  echo "   Share the APK; users enable Install unknown apps once, then open the file."
fi
