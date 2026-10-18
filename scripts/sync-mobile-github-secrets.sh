#!/usr/bin/env bash
# Push mobile build secrets from apps/mobile/.env to GitHub Actions.
# Prerequisites: gh auth login, repo admin access.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/mobile/.env"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Run: gh auth login"
  exit 1
fi

read_env() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    return 1
  fi
  grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed 's/^"//;s/"$//'
}

set_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "skip $name (empty)"
    return
  fi
  echo "set $name"
  gh secret set "$name" --body "$value"
}

# Always set team project id
set_secret "EAS_PROJECT_ID" "7cbd8dae-da81-4236-a7c2-c9c707540afe"

# EXPO_TOKEN must be created manually at expo.dev (never in .env)
if [[ -z "${EXPO_TOKEN:-}" ]]; then
  echo ""
  echo "EXPO_TOKEN is not in the environment."
  echo "Create one at https://expo.dev/settings/access-tokens then run:"
  echo "  EXPO_TOKEN=your_token ./scripts/sync-mobile-github-secrets.sh"
  echo ""
else
  set_secret "EXPO_TOKEN" "$EXPO_TOKEN"
fi

if [[ -f "$ENV_FILE" ]]; then
  set_secret "MOBILE_API_BASE_URL" "$(read_env EXPO_PUBLIC_API_BASE_URL || true)"
  set_secret "MOBILE_WEB_BASE_URL" "$(read_env EXPO_PUBLIC_WEB_BASE_URL || true)"
  set_secret "MOBILE_MEMBER_PROXY_KEY" "$(read_env EXPO_PUBLIC_MEMBER_PROXY_KEY || true)"
  set_secret "MOBILE_AZURE_CLIENT_ID" "$(read_env EXPO_PUBLIC_AZURE_CLIENT_ID || true)"
  set_secret "MOBILE_AZURE_TENANT_ID" "$(read_env EXPO_PUBLIC_AZURE_TENANT_ID || true)"
  set_secret "MOBILE_GOOGLE_IOS_CLIENT_ID" "$(read_env EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || true)"
  set_secret "MOBILE_GOOGLE_ANDROID_CLIENT_ID" "$(read_env EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || true)"
  set_secret "MOBILE_GOOGLE_CLIENT_ID" "$(read_env EXPO_PUBLIC_GOOGLE_CLIENT_ID || true)"
else
  echo "No $ENV_FILE — only EAS_PROJECT_ID (and EXPO_TOKEN if provided) were set."
fi

echo "Done. Re-run Mobile preview build on GitHub Actions."
