#!/usr/bin/env bash
# Put a backup back into a database. This is the "real restore" (the drill below only rehearses it).
#
#   ./restore.sh --file prabhat-20261108T020000Z.dump.age --identity ~/keys/backup.agekey --target-url URL
#   ./restore.sh --latest --identity KEYFILE --target-url URL      (newest dump from BACKUP_REMOTE)
#   ./restore.sh --dry-run ...                                     prints the plan, changes nothing
#
#   --target-url   the database to restore INTO (direct URL, not pooled). Usually a NEW empty database.
#   --replace      allow restoring into a database that already has tables: they are dropped first.
#                  Without it the script stops if the target is not empty.
#   BACKUP_REMOTE  needed for --latest (same value as pg_backup.sh)
#
# Needs: pg_restore and psql (same major version as the server), age for .age files.
# The private key is read from the file you give; it is never copied or printed.
# After a restore: run `alembic upgrade head` once (it does nothing if the dump is already current),
# then check the row counts against the .json receipt that sits next to the dump.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

FILE=""; IDENTITY=""; LATEST=0; DRY=0; REPLACE=0; TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --identity) IDENTITY="$2"; shift 2 ;;
    --target-url) TARGET="$2"; shift 2 ;;
    --latest) LATEST=1; shift ;;
    --replace) REPLACE=1; shift ;;
    --dry-run) DRY=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -n "$TARGET" ] || die "--target-url is required (the database to restore into)"
[ -n "$FILE" ] || [ "$LATEST" = 1 ] || die "give --file <dump> or --latest"

if [ "$DRY" = 1 ]; then
  log "DRY RUN. Would restore ${FILE:-the newest dump from BACKUP_REMOTE} into $(printf '%s' "$TARGET" | redact)"
  log "  key file: ${IDENTITY:-not needed for a plain dump}; existing tables: $([ "$REPLACE" = 1 ] && echo 'dropped first' || echo 'stop if any')"
  exit 0
fi

need pg_restore; need psql
WORK="$(mktemp -d)"
[ -d "$WORK" ] || die "no temporary folder"
trap 'rm -rf "${WORK:?}"' EXIT

if [ "$LATEST" = 1 ]; then
  require_env BACKUP_REMOTE
  NEWEST=$(dest_list "$BACKUP_REMOTE" | tail -n 1)
  [ -n "$NEWEST" ] || die "no dump found in the backup place"
  log "fetching $NEWEST"
  dest_get "${BACKUP_REMOTE%/}/$NEWEST" "$WORK/$(basename "$NEWEST")"
  FILE="$WORK/$(basename "$NEWEST")"
fi
[ -f "$FILE" ] || die "backup file not found: $FILE"

DUMP="$FILE"
case "$FILE" in
  *.age)
    [ -f "$IDENTITY" ] || die "--identity (private age key file) is needed for an encrypted dump"
    need age
    DUMP="$WORK/restore.dump"
    log "decrypting"
    age -d -i "$IDENTITY" -o "$DUMP" "$FILE"
    ;;
esac

EXISTING=$(psql "$TARGET" -At -c "select count(*) from information_schema.tables where table_schema='public'")
if [ "$EXISTING" != "0" ] && [ "$REPLACE" != 1 ]; then
  die "the target database already has $EXISTING tables. Restore into an empty database, or add --replace if you really mean to overwrite it"
fi

log "restoring into $(printf '%s' "$TARGET" | redact)"
if [ "$REPLACE" = 1 ]; then
  pg_restore --dbname="$TARGET" --no-owner --no-privileges --clean --if-exists --exit-on-error "$DUMP"
else
  pg_restore --dbname="$TARGET" --no-owner --no-privileges --exit-on-error "$DUMP"
fi
log "restored. Next: run 'alembic upgrade head', then compare row counts with the .json receipt"
