#!/usr/bin/env bash
# Shared helpers. Source this file; do not run it.
# Rule: a secret is never printed. `redact` hides what looks like a password in a URL.

set -euo pipefail

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

# postgresql://user:password@host/db -> postgresql://user:***@host/db
redact() { sed -E 's#(://[^:/@]+):[^@/]*@#\1:***@#g'; }

need() { command -v "$1" >/dev/null 2>&1 || die "'$1' is not installed"; }

require_env() {
  local name
  for name in "$@"; do
    [ -n "${!name:-}" ] || die "$name is not set"
  done
}

# Used with rclone --min-age.
retention_days() { printf '%s' "${BACKUP_RETENTION_DAYS:-35}"; }

stamp() { date -u +%Y%m%dT%H%M%SZ; }
