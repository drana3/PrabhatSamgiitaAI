#!/usr/bin/env bash
# Print SHA-1 / SHA-256 for Google Cloud Android OAuth clients.
# Usage:
#   ./scripts/android-google-sha1.sh path/to/app.aab
#   ./scripts/android-google-sha1.sh   # defaults to newest apps/mobile/build-*.aab
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Prefer JDK 17 keytool (Homebrew OpenJDK 24 can fail on some jars).
if [[ -z "${JAVA_HOME:-}" || ! -x "${JAVA_HOME}/bin/keytool" ]]; then
  for candidate in \
    "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
  do
    if [[ -x "$candidate/bin/keytool" ]]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  TARGET="$(ls -t "$ROOT"/apps/mobile/build-*.aab 2>/dev/null | head -1 || true)"
fi
if [[ -z "$TARGET" || ! -f "$TARGET" ]]; then
  echo "ERROR: Pass an .aab/.apk path, or build one first."
  exit 1
fi

echo "==> Signing certificate for: $TARGET"
echo "    Package: net.prabhatasamgiita.ai"
echo
keytool -printcert -jarfile "$TARGET" | awk '
  /Owner:/ { print "    " $0 }
  /SHA1:/ || /SHA-1:/ || /SHA256:/ || /SHA-256:/ { print "    " $0 }
'
echo
echo "Google Cloud → Credentials → Create OAuth client → Android"
echo "  Package name: net.prabhatasamgiita.ai"
echo "  SHA-1: paste the SHA1 value above"
echo
echo "Play Store installs need separate Android OAuth clients for each Play signing key:"
echo "  Classical app signing SHA-1  (App signing → Classical key)"
echo "  Post-quantum signing SHA-1   (App signing → Post-quantum key, if shown)"
echo "Upload key SHA-1 above is only for APK sideloads — not Play installs."
echo "No app rebuild required after adding SHA-1s in Google Cloud."
