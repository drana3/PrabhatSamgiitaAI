#!/usr/bin/env bash
# Keep checked-in android/ Gradle versions aligned with apps/mobile/app.json
# (local EAS uses the existing native project and skips Expo prebuild).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
APP_JSON="$MOBILE/app.json"
GRADLE="$MOBILE/android/app/build.gradle"

if [[ ! -f "$APP_JSON" || ! -f "$GRADLE" ]]; then
  echo "Missing app.json or android/app/build.gradle." >&2
  exit 1
fi

VERSION="$(python3 -c "import json; print(json.load(open('$APP_JSON'))['expo']['version'])")"
VERSION_CODE="$(python3 -c "import json; print(json.load(open('$APP_JSON'))['expo']['android']['versionCode'])")"

perl -pi -e "s/versionCode\s+\d+/versionCode $VERSION_CODE/" "$GRADLE"
perl -pi -e "s/versionName\s+\"[^\"]+\"/versionName \"$VERSION\"/" "$GRADLE"

echo "Synced Android native project → version $VERSION · versionCode $VERSION_CODE"
