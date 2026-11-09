#!/usr/bin/env bash
# Dump the database, encrypt it, put it in the backup place, and tidy old dumps.
#
#   BACKUP_DATABASE_URL    direct (NOT pooled) Postgres URL, a read-only user is best
#   BACKUP_AGE_RECIPIENT   age public key ("age1..."); the PRIVATE key lives offline with Dada
#   BACKUP_REMOTE          where the dumps go. Either an rclone path, e.g. "backup:prabhat-backups/db"
#                          (the rclone remote itself is configured with RCLONE_CONFIG_* env vars,
#                          see .github/workflows/backup.yml), or a FOLDER that starts with / or ./
#   BACKUP_KEEP_COPIES     optional: keep this many newest dumps and delete the rest ("keep 14")
#   BACKUP_RETENTION_DAYS  used when BACKUP_KEEP_COPIES is not set; default 35
#   BACKUP_ENCRYPT         "age" (default) or "none". "none" is only for a local rehearsal: it also
#                          needs BACKUP_ALLOW_PLAIN=1 and a FOLDER destination, never a cloud bucket.
#
#   ./pg_backup.sh --dry-run     prints the plan, runs nothing, needs no tools
#   ./pg_backup.sh               does it
#
# Needs: pg_dump (same major version as the server), age (unless BACKUP_ENCRYPT=none), rclone
# (unless the destination is a folder), sha256sum or shasum, psql (for the row counts in the receipt).
# Safe: it only reads the database; it deletes only old dumps, and only after the new one is stored.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

ENCRYPT="${BACKUP_ENCRYPT:-age}"
require_env BACKUP_DATABASE_URL BACKUP_REMOTE
case "$ENCRYPT" in
  age) require_env BACKUP_AGE_RECIPIENT ;;
  none)
    [ "${BACKUP_ALLOW_PLAIN:-}" = "1" ] || die "BACKUP_ENCRYPT=none needs BACKUP_ALLOW_PLAIN=1 (rehearsal only)"
    is_local_dest "$BACKUP_REMOTE" || die "an unencrypted dump may only go to a local folder, never to a bucket"
    ;;
  *) die "BACKUP_ENCRYPT must be age or none" ;;
esac
KEEP="${BACKUP_KEEP_COPIES:-}"
case "$KEEP" in ''|*[!0-9]*) [ -z "$KEEP" ] || die "BACKUP_KEEP_COPIES must be a whole number" ;; esac
[ "${KEEP:-1}" -ge 1 ] || die "BACKUP_KEEP_COPIES must be at least 1"

NAME="prabhat-$(stamp)"
DAY="$(date -u +%Y/%m)"
DEST="${BACKUP_REMOTE%/}/$DAY"
RETAIN="$(retention_days)"
EXT="dump"; [ "$ENCRYPT" = "age" ] && EXT="dump.age"

if [ "$DRY" = 1 ]; then
  log "DRY RUN. Would dump: $(printf '%s' "$BACKUP_DATABASE_URL" | redact)"
  log "  -> $NAME.$EXT and $NAME.json (receipt) in $DEST"
  if [ -n "$KEEP" ]; then log "  -> then keep the newest $KEEP dumps in ${BACKUP_REMOTE}, delete older ones"
  else log "  -> then delete dumps older than ${RETAIN} days in ${BACKUP_REMOTE}"; fi
  exit 0
fi

need pg_dump
[ "$ENCRYPT" = "age" ] && need age
WORK="$(mktemp -d)"
[ -d "$WORK" ] || die "no temporary folder"
trap 'rm -rf "${WORK:?}"' EXIT

log "dumping (custom format, compressed)"
pg_dump --format=custom --compress=6 --no-owner --no-privileges \
  --dbname="$BACKUP_DATABASE_URL" --file="$WORK/$NAME.dump"
[ -s "$WORK/$NAME.dump" ] || die "dump is empty"

# Receipt: size, hash of the PLAIN dump, row counts of the tables the restore drill checks, and the
# schema version (alembic) the dump was taken at.
SUM=$(sha256_of "$WORK/$NAME.dump")
SIZE=$(wc -c < "$WORK/$NAME.dump" | tr -d ' ')
COUNTS="{}"
VERSION=""
if command -v psql >/dev/null 2>&1; then
  COUNTS=$(psql "$BACKUP_DATABASE_URL" -At -F: -c "
    select 'songs:'||count(*) from songs union all
    select 'recordings:'||count(*) from recordings union all
    select 'user_accounts:'||count(*) from user_accounts" 2>/dev/null \
    | awk -F: 'BEGIN{printf "{"} {printf "%s\"%s\":%s", (NR>1?",":""), $1, $2} END{printf "}"}') || COUNTS="{}"
  VERSION=$(psql "$BACKUP_DATABASE_URL" -At -c "select version_num from alembic_version" 2>/dev/null | head -n 1) || VERSION=""
fi
printf '{"name":"%s","created_utc":"%s","encrypted":%s,"plain_sha256":"%s","plain_bytes":%s,"alembic_version":"%s","row_counts":%s}\n' \
  "$NAME" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$([ "$ENCRYPT" = age ] && echo true || echo false)" \
  "$SUM" "$SIZE" "$VERSION" "$COUNTS" > "$WORK/$NAME.json"

if [ "$ENCRYPT" = "age" ]; then
  log "encrypting"
  age -r "$BACKUP_AGE_RECIPIENT" -o "$WORK/$NAME.dump.age" "$WORK/$NAME.dump"
  rm -f "${WORK:?}/${NAME:?}.dump"   # the plain dump never leaves this folder
fi

log "storing in $DEST"
dest_put "$WORK/$NAME.$EXT" "$DEST/$NAME.$EXT"
dest_put "$WORK/$NAME.json" "$DEST/$NAME.json"

if [ -n "$KEEP" ]; then
  log "keeping the newest $KEEP dumps"
  REMOVED=$(prune_keep_copies "$BACKUP_REMOTE" "$KEEP") || { REMOVED="?"; log "WARNING: cleanup failed (the new backup is safe)"; }
  log "removed $REMOVED old dump(s)"
else
  log "removing dumps older than ${RETAIN} days"
  prune_older_than_days "$BACKUP_REMOTE" "$RETAIN" || log "WARNING: cleanup failed (the new backup is safe)"
fi

log "done: $DEST/$NAME.$EXT ($SIZE plain bytes)"
