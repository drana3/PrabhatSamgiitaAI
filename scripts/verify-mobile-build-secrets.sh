#!/usr/bin/env bash
# Fail fast when mobile EAS builds would ship without OAuth / member sync env.
set -euo pipefail

missing=()
[[ -z "${MOBILE_AZURE_CLIENT_ID:-}" ]] && missing+=(MOBILE_AZURE_CLIENT_ID)
if [[ -z "${MOBILE_GOOGLE_CLIENT_ID:-}" ]]; then
  if ! node -e "
    const fs = require('fs');
    const eas = JSON.parse(fs.readFileSync('apps/mobile/eas.json', 'utf8'));
    const id = eas.build?.preview?.env?.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim();
    process.exit(id ? 0 : 1);
  " 2>/dev/null; then
    missing+=(MOBILE_GOOGLE_CLIENT_ID)
  fi
fi
[[ -z "${MOBILE_GOOGLE_ANDROID_CLIENT_ID:-}" ]] && missing+=(MOBILE_GOOGLE_ANDROID_CLIENT_ID)
[[ -z "${MOBILE_GOOGLE_IOS_CLIENT_ID:-}" ]] && missing+=(MOBILE_GOOGLE_IOS_CLIENT_ID)
[[ -z "${MOBILE_MEMBER_PROXY_KEY:-}" ]] && missing+=(MOBILE_MEMBER_PROXY_KEY)

if ((${#missing[@]})); then
  echo "::error::Missing mobile build secrets: ${missing[*]}"
  echo "Run: ./scripts/sync-mobile-github-secrets.sh"
  exit 1
fi

echo "Mobile OAuth and member-sync secrets are present for Android and iOS builds."
