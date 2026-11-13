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

# --- where backups live: a folder on this machine, or an rclone remote (S3 / R2 / B2 ...) ---
# A destination that starts with / or ./ is a folder (used for local rehearsals and for a USB disk).
# Anything else is an rclone path such as "backup:prabhat-backups/db".
is_local_dest() {
  case "$1" in /*|./*|../*) return 0 ;; *) return 1 ;; esac
}

dest_put() { # <local file> <destination file>
  if is_local_dest "$2"; then
    mkdir -p "$(dirname "$2")" && cp "$1" "$2"
  else
    need rclone
    rclone copyto "$1" "$2" --s3-no-check-bucket
  fi
}

dest_get() { # <source file> <local file>
  if is_local_dest "$1"; then cp "$1" "$2"; else need rclone; rclone copyto "$1" "$2"; fi
}

# Dump files under a destination, relative paths, oldest first (the names carry the UTC time).
dest_list() { # <destination folder>
  if is_local_dest "$1"; then
    [ -d "$1" ] || return 0
    (cd "$1" && find . -type f \( -name '*.dump.age' -o -name '*.dump' \) | sed 's#^\./##' | LC_ALL=C sort)
  else
    need rclone
    rclone lsf "$1" -R --include '*.dump.age' --include '*.dump' | LC_ALL=C sort
  fi
}

dest_delete() { # <destination file>
  if is_local_dest "$1"; then rm -f "$1"; else need rclone; rclone deletefile "$1"; fi
}

# Keep the newest N dumps (and their .json receipts); delete the rest. Returns how many were removed.
prune_keep_copies() { # <destination folder> <N>
  local base="$1" keep="$2" total drop file removed=0
  total=$(dest_list "$base" | wc -l | tr -d ' ')
  [ "$total" -gt "$keep" ] || { printf '0'; return 0; }
  drop=$((total - keep))
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    dest_delete "$base/$file" || log "WARNING: could not delete $file"
    dest_delete "$base/${file%.dump*}.json" 2>/dev/null || true
    removed=$((removed + 1))
  done <<EOT
$(dest_list "$base" | head -n "$drop")
EOT
  printf '%s' "$removed"
}

# Delete dumps older than N days. A local folder uses file dates; a remote uses rclone --min-age.
prune_older_than_days() { # <destination folder> <days>
  if is_local_dest "$1"; then
    [ -d "$1" ] && find "$1" -type f \( -name '*.dump.age' -o -name '*.dump' -o -name '*.json' \) -mtime "+$2" -delete
  else
    need rclone
    rclone delete "$1" --min-age "${2}d" --include '*.dump.age' --include '*.dump' --include '*.json'
  fi
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}
