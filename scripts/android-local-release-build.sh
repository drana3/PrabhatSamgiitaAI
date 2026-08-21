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

echo "==> Checking Java (Android local builds need JDK 17)..."
# Prefer JDK 17 — OpenJDK 21+ can break React Native CMake/Gradle (restricted System methods).
if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/java" ]]; then
  for candidate in \
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" \
    "/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home"
  do
    if [[ -x "$candidate/bin/java" ]]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi
if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
  export PATH="$JAVA_HOME/bin:$PATH"
fi
if ! command -v java >/dev/null; then
  echo "ERROR: Java not found. Install JDK 17, e.g.:"
  echo "  brew install openjdk@17"
  exit 1
fi
java -version 2>&1 | head -1 || true
echo "    JAVA_HOME=${JAVA_HOME:-"(unset; using PATH java)"}"

# Local Gradle needs the Android SDK (unlike iOS, which uses Xcode).
if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
  for candidate in \
    "$HOME/Library/Android/sdk" \
    "$HOME/Android/Sdk" \
    "/opt/homebrew/share/android-commandlinetools" \
    "/usr/local/share/android-commandlinetools"
  do
    if [[ -d "$candidate/platforms" ]]; then
      export ANDROID_HOME="$candidate"
      export ANDROID_SDK_ROOT="$candidate"
      break
    fi
  done
fi
if [[ -z "${ANDROID_HOME:-}" || ! -d "${ANDROID_HOME}/platforms" ]]; then
  echo "ERROR: Android SDK not found (ANDROID_HOME unset or incomplete)."
  echo "Install command-line tools and packages, then re-run:"
  echo "  brew install --cask android-commandlinetools"
  echo "  export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools"
  echo "  yes | sdkmanager --licenses"
  echo "  sdkmanager \"platform-tools\" \"platforms;android-35\" \"build-tools;35.0.0\" \"ndk;27.1.12297006\""
  exit 1
fi
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
if [[ -z "${ANDROID_NDK_HOME:-}" ]]; then
  if [[ -d "$ANDROID_HOME/ndk" ]]; then
    newest_ndk="$(ls -1 "$ANDROID_HOME/ndk" 2>/dev/null | sort -V | tail -1 || true)"
    if [[ -n "$newest_ndk" && -d "$ANDROID_HOME/ndk/$newest_ndk" ]]; then
      export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/$newest_ndk"
    fi
  fi
fi
echo "    ANDROID_HOME=$ANDROID_HOME"
if [[ -n "${ANDROID_NDK_HOME:-}" ]]; then
  echo "    ANDROID_NDK_HOME=$ANDROID_NDK_HOME"
fi

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

npx eas-cli@22.0.0 build \
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
