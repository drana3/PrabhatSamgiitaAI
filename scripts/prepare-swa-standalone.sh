#!/usr/bin/env bash
# Prepare a flattened Next.js standalone folder for Azure Static Web Apps (monorepo layout).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="${ROOT}/apps/web"
STANDALONE="${WEB}/.next/standalone"
NESTED="${STANDALONE}/apps/web"

cd "${ROOT}"
npm ci
npm run build --workspace apps/web

if [[ ! -f "${NESTED}/server.js" ]]; then
  echo "Expected standalone server at ${NESTED}/server.js" >&2
  exit 1
fi

mkdir -p "${NESTED}/.next"
cp -R "${WEB}/.next/static" "${NESTED}/.next/static"
cp -R "${WEB}/public" "${NESTED}/public"

# SWA warm-up expects server.js at the artifact root, not under apps/web/.
cp -a "${NESTED}/." "${STANDALONE}/"
rm -rf "${STANDALONE}/apps"

cp "${WEB}/staticwebapp.config.json" "${STANDALONE}/"
cp "${WEB}/staticwebapp.config.json" "${WEB}/.next/"

echo "Prepared SWA artifact: ${STANDALONE}"
