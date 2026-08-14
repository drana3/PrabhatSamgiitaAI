#!/usr/bin/env bash
# Fail fast when mobile EAS builds would ship without OAuth / member sync env.
set -euo pipefail

missing=()
[[ -z "${MOBILE_AZURE_CLIENT_ID:-}" ]] && missing+=(MOBILE_AZURE_CLIENT_ID)
[[ -z "${MOBILE_GOOGLE_ANDROID_CLIENT_ID:-}" ]] && missing+=(MOBILE_GOOGLE_ANDROID_CLIENT_ID)
[[ -z "${MOBILE_GOOGLE_IOS_CLIENT_ID:-}" ]] && missing+=(MOBILE_GOOGLE_IOS_CLIENT_ID)
[[ -z "${MOBILE_MEMBER_PROXY_KEY:-}" ]] && missing+=(MOBILE_MEMBER_PROXY_KEY)

if ((${#missing[@]})); then
  echo "::error::Missing mobile build secrets: ${missing[*]}"
  echo "Run: EXPO_TOKEN=... ./scripts/sync-mobile-github-secrets.sh"
  exit 1
fi

echo "Mobile OAuth and member-sync secrets are present."
