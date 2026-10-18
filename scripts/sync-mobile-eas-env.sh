#!/usr/bin/env bash
# Push EXPO_PUBLIC_MEMBER_PROXY_KEY to EAS so cloud workers embed it in the JS bundle.
# GitHub Actions secrets on the runner are not available on EAS build machines.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENVIRONMENT="${1:-preview}"
KEY="${MOBILE_MEMBER_PROXY_KEY:-}"

if [[ -z "$KEY" && -f "$ROOT/apps/mobile/.env" ]]; then
  KEY="$(grep -E '^EXPO_PUBLIC_MEMBER_PROXY_KEY=' "$ROOT/apps/mobile/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi

if [[ -z "$KEY" ]]; then
  echo "::error::Set MOBILE_MEMBER_PROXY_KEY or EXPO_PUBLIC_MEMBER_PROXY_KEY in apps/mobile/.env"
  exit 1
fi

if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo "::error::EXPO_TOKEN is required (expo.dev → Access tokens)"
  exit 1
fi

cd "$ROOT/apps/mobile"
eas env:create \
  --name EXPO_PUBLIC_MEMBER_PROXY_KEY \
  --value "$KEY" \
  --environment "$ENVIRONMENT" \
  --visibility sensitive \
  --force \
  --non-interactive

echo "Synced EXPO_PUBLIC_MEMBER_PROXY_KEY to EAS environment: $ENVIRONMENT"
