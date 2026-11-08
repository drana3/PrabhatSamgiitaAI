#!/usr/bin/env bash
# Dump the database, encrypt it, upload it, and tidy old dumps.
#
#   BACKUP_DATABASE_URL    direct (NOT pooled) Postgres URL, a read-only user is best
#   BACKUP_AGE_RECIPIENT   age public key ("age1..."); the PRIVATE key lives offline with Dada
#   BACKUP_REMOTE          rclone destination, e.g. "backup:prabhat-backups/db"
#                          (the rclone remote itself is configured with RCLONE_CONFIG_* env vars)
#   BACKUP_RETENTION_DAYS  default 35
#
#   ./pg_backup.sh --dry-run     prints the plan, runs nothing, needs no tools
#   ./pg_backup.sh               does it
#
# Needs: pg_dump (same major version as the server), age, rclone, sha256sum or shasum.
# Safe: it only reads the database; it deletes only dumps older than the retention period.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

require_env BACKUP_DATABASE_URL BACKUP_AGE_RECIPIENT BACKUP_REMOTE
NAME="prabhat-$(stamp)"
DAY="$(date -u +%Y/%m)"
DEST="${BACKUP_REMOTE%/}/$DAY"
RETAIN="$(retention_days)"

if [ "$DRY" = 1 ]; then
  log "DRY RUN. Would dump: $(printf '%s' "$BACKUP_DATABASE_URL" | redact)"
  log "  -> $NAME.dump.age and $NAME.json (receipt) in $DEST"
  log "  -> then delete dumps older than ${RETAIN} days in ${BACKUP_REMOTE}"
  exit 0
fi

need pg_dump; need age; need rclone
WORK="$(mktemp -d)"
[ -d "$WORK" ] || die "no temporary folder"
trap 'rm -rf "${WORK:?}"' EXIT

log "dumping (custom format, compressed)"
pg_dump --format=custom --compress=6 --no-owner --no-privileges \
  --dbname="$BACKUP_DATABASE_URL" --file="$WORK/$NAME.dump"
[ -s "$WORK/$NAME.dump" ] || die "dump is empty"

# Receipt: size, hash of the PLAIN dump, row counts of the tables the restore drill checks.
if command -v sha256sum >/dev/null 2>&1; then SUM=$(sha256sum "$WORK/$NAME.dump" | cut -d' ' -f1)
else SUM=$(shasum -a 256 "$WORK/$NAME.dump" | cut -d' ' -f1); fi
SIZE=$(wc -c < "$WORK/$NAME.dump" | tr -d ' ')
COUNTS="{}"
if command -v psql >/dev/null 2>&1; then
  COUNTS=$(psql "$BACKUP_DATABASE_URL" -At -F: -c "
    select 'songs:'||count(*) from songs union all
    select 'recordings:'||count(*) from recordings union all
    select 'user_accounts:'||count(*) from user_accounts" 2>/dev/null \
    | awk -F: 'BEGIN{printf "{"} {printf "%s\"%s\":%s", (NR>1?",":""), $1, $2} END{printf "}"}') || COUNTS="{}"
fi
printf '{"name":"%s","created_utc":"%s","plain_sha256":"%s","plain_bytes":%s,"row_counts":%s}\n' \
  "$NAME" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SUM" "$SIZE" "$COUNTS" > "$WORK/$NAME.json"

log "encrypting"
age -r "$BACKUP_AGE_RECIPIENT" -o "$WORK/$NAME.dump.age" "$WORK/$NAME.dump"
rm -f "${WORK:?}/${NAME:?}.dump"   # the plain dump never leaves this folder

log "uploading to $DEST"
rclone copyto "$WORK/$NAME.dump.age" "$DEST/$NAME.dump.age" --s3-no-check-bucket
rclone copyto "$WORK/$NAME.json" "$DEST/$NAME.json" --s3-no-check-bucket

log "removing dumps older than ${RETAIN} days"
rclone delete "$BACKUP_REMOTE" --min-age "${RETAIN}d" --include "*.dump.age" --include "*.json" || \
  log "WARNING: cleanup failed (the new backup is safe)"

log "done: $DEST/$NAME.dump.age ($SIZE plain bytes)"
