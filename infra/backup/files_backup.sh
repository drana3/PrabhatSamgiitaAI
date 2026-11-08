#!/usr/bin/env bash
# Copy the recordings bucket to a second bucket (ideally another account or provider).
#
#   FILES_SOURCE   rclone path of the live bucket, e.g. "r2:prabhat-recordings"
#   FILES_BACKUP   rclone path of the copy,        e.g. "backup:prabhat-recordings-copy"
#   (the remotes are configured with RCLONE_CONFIG_* env vars; nothing is stored in a file)
#
#   ./files_backup.sh --dry-run    lists what would be copied, copies nothing
#   ./files_backup.sh              copies
#
# `rclone copy` only ADDS: a file deleted in the live bucket stays in the copy until the copy
# bucket's own lifecycle rule removes it (docs/backups.md). `--immutable` refuses to overwrite a
# file in the copy whose content changed, so damage in the live bucket cannot spread.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1
require_env FILES_SOURCE FILES_BACKUP

if [ "$DRY" = 1 ]; then
  log "DRY RUN. Would copy $FILES_SOURCE -> $FILES_BACKUP (add only, never delete, never overwrite)"
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$FILES_SOURCE" "$FILES_BACKUP" --immutable --dry-run --stats-one-line -v 2>&1 | tail -n 20 >&2 || true
  fi
  exit 0
fi

need rclone
log "copying $FILES_SOURCE -> $FILES_BACKUP"
rclone copy "$FILES_SOURCE" "$FILES_BACKUP" --immutable --transfers 8 --checksum \
  --stats-one-line --stats 30s -v
log "verifying that every live file is in the copy with the same size"
rclone check "$FILES_SOURCE" "$FILES_BACKUP" --one-way --size-only --stats-one-line || \
  die "the copy does not match the live bucket"
log "done"
