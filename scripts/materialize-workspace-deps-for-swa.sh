#!/usr/bin/env bash
# Azure Static Web Apps zips server artifacts and fails on npm workspace symlinks.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_SRC="${ROOT_DIR}/packages/core"

materialize() {
  local target="$1"
  if [[ -L "$target" || -d "$target" ]]; then
    rm -rf "$target"
    cp -R "$CORE_SRC" "$target"
    echo "Materialized ${target}"
  fi
}

materialize "${ROOT_DIR}/node_modules/@prabhat/core"
mkdir -p "${ROOT_DIR}/apps/web/node_modules/@prabhat"
materialize "${ROOT_DIR}/apps/web/node_modules/@prabhat/core"
