#!/usr/bin/env bash
# Restore drill: prove that a backup can really be restored, and measure how long it takes.
# Restores into a THROW-AWAY local Postgres (Docker), never into a real database.
#
#   ./restore_drill.sh --file prabhat-20261108T020000Z.dump.age --identity ~/keys/backup.agekey
#   ./restore_drill.sh --file some.dump                 (an unencrypted dump, e.g. a local test)
#   ./restore_drill.sh --latest --identity KEYFILE      (downloads the newest from BACKUP_REMOTE)
#   ./restore_drill.sh --dry-run ...                    prints the plan
#
#   BACKUP_REMOTE   needed for --latest (same value as pg_backup.sh)
#   DRILL_PG_IMAGE  default postgres:16
#
# Needs: docker (pg_restore and psql run inside the container), age for .age files.
# The private key is read from the file you give; it is never copied or printed.
# Exit code 0 only if the restore ran AND the row counts match the receipt (when there is one).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

FILE=""; IDENTITY=""; LATEST=0; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --file) FILE="$2"; shift 2 ;;
    --identity) IDENTITY="$2"; shift 2 ;;
    --latest) LATEST=1; shift ;;
    --dry-run) DRY=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done
IMAGE="${DRILL_PG_IMAGE:-postgres:16}"

if [ "$DRY" = 1 ]; then
  log "DRY RUN. Would: start a temporary $IMAGE container,"
  log "  decrypt ${FILE:-the latest dump from BACKUP_REMOTE} (key file: ${IDENTITY:-not needed for a plain dump}),"
  log "  pg_restore into it, compare row counts with the .json receipt, print the elapsed time,"
  log "  and remove the container and every temporary file."
  exit 0
fi

need docker
START=$(date +%s)
WORK="$(mktemp -d)"
[ -d "$WORK" ] || die "no temporary folder"
CONTAINER="restore-drill-$$"
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "${WORK:?}"; }
trap cleanup EXIT

if [ "$LATEST" = 1 ]; then
  require_env BACKUP_REMOTE; need rclone
  NEWEST=$(rclone lsf "$BACKUP_REMOTE" -R --include "*.dump.age" | sort | tail -n 1)
  [ -n "$NEWEST" ] || die "no dump found in the backup remote"
  log "downloading $NEWEST"
  rclone copyto "${BACKUP_REMOTE%/}/$NEWEST" "$WORK/$(basename "$NEWEST")"
  rclone copyto "${BACKUP_REMOTE%/}/${NEWEST%.dump.age}.json" "$WORK/receipt.json" 2>/dev/null || true
  FILE="$WORK/$(basename "$NEWEST")"
fi
[ -f "$FILE" ] || die "backup file not found: $FILE"

RECEIPT="${FILE%.dump.age}.json"
[ -f "$RECEIPT" ] || RECEIPT="${FILE%.dump}.json"
[ -f "$RECEIPT" ] || RECEIPT="$WORK/receipt.json"

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
[ "$(dirname "$DUMP")" = "$WORK" ] || cp "$DUMP" "$WORK/restore.dump"
BASE="$(basename "$DUMP")"
[ "$(dirname "$DUMP")" = "$WORK" ] || BASE="restore.dump"

log "starting a temporary database"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill \
  -v "$WORK:/work:ro" "$IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -d drill >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -d drill >/dev/null || die "temporary database did not start"

log "restoring"
docker exec "$CONTAINER" pg_restore -U postgres -d drill --no-owner --no-privileges \
  --exit-on-error "/work/$BASE"

log "checking"
q() { docker exec "$CONTAINER" psql -U postgres -d drill -At -c "$1"; }
FAILED=0
for table in songs recordings user_accounts; do
  have=$(q "select count(*) from $table" 2>/dev/null || echo "missing")
  want=""
  if [ -f "$RECEIPT" ]; then
    want=$(sed -n "s/.*\"$table\":\([0-9]*\).*/\1/p" "$RECEIPT" | head -n 1)
  fi
  if [ "$have" = "missing" ]; then log "  $table: MISSING"; FAILED=1
  elif [ -n "$want" ] && [ "$have" != "$want" ]; then log "  $table: $have rows, receipt says $want"; FAILED=1
  else log "  $table: $have rows ${want:+(matches receipt)}"; fi
done
VERSION=$(q "select version_num from alembic_version" 2>/dev/null || echo "none")
log "  alembic version in the backup: $VERSION"

END=$(date +%s)
log "restore drill took $((END - START)) seconds (this is the real RTO for this database size)"
[ "$FAILED" = 0 ] || die "the restored data does not match; do not trust this backup"
log "OK: the backup restores and matches its receipt"
