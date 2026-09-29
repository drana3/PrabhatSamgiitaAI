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

while IFS= read -r link; do
  rm -rf "${link}"
  mkdir -p "$(dirname "${link}")"
  cp -R "${ROOT}/packages/core" "${link}"
done < <(find "${STANDALONE}" -type l -path '*/node_modules/@prabhat/core' 2>/dev/null || true)

while IFS= read -r link; do
  target="$(readlink "${link}")"
  case "${target}" in
    ../*|../../*|../../../*)
      resolved="$(cd "$(dirname "${link}")" && cd "${target}" 2>/dev/null && pwd)" || continue
      rm -f "${link}"
      if [[ -d "${resolved}" ]]; then
        cp -R "${resolved}" "${link}"
      elif [[ -f "${resolved}" ]]; then
        cp "${resolved}" "${link}"
      fi
      ;;
  esac
done < <(find "${STANDALONE}/node_modules" -type l 2>/dev/null | head -200 || true)

cp "${WEB}/staticwebapp.config.json" "${STANDALONE}/"
cp "${WEB}/staticwebapp.config.json" "${WEB}/.next/"

echo "Prepared SWA artifact: ${STANDALONE}"
