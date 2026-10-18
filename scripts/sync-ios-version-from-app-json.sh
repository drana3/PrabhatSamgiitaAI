#!/usr/bin/env bash
# Keep checked-in ios/ Xcode versions aligned with apps/mobile/app.json (local EAS skips prebuild).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
APP_JSON="$MOBILE/app.json"
PBX="$MOBILE/ios/PrabhatSamgiitaAI.xcodeproj/project.pbxproj"

if [[ ! -f "$APP_JSON" || ! -f "$PBX" ]]; then
  echo "Missing app.json or Xcode project." >&2
  exit 1
fi

VERSION="$(python3 -c "import json; print(json.load(open('$APP_JSON'))['expo']['version'])")"
BUILD="$(python3 -c "import json; print(json.load(open('$APP_JSON'))['expo']['ios']['buildNumber'])")"

perl -pi -e "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $VERSION;/g" "$PBX"
perl -pi -e "s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = $BUILD;/g" "$PBX"

echo "Synced iOS native project → version $VERSION · build $BUILD"
