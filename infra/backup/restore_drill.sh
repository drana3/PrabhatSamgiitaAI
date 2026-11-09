#!/usr/bin/env bash
# Restore drill: prove that a backup can really be restored, and measure how long it takes.
# Restores into a THROW-AWAY database, never into a real one. Two ways to get that database:
#   - Docker (default): a temporary postgres container, removed afterwards.
#   - DRILL_ADMIN_URL: a scratch Postgres server you already have (no Docker). The drill creates a
#     database called drill_<number>, restores into it, and drops it. The URL must point at a server
#     that holds nothing precious: it needs the right to CREATE DATABASE.
#
#   ./restore_drill.sh --file prabhat-20261108T020000Z.dump.age --identity ~/keys/backup.agekey
#   ./restore_drill.sh --file some.dump                 (an unencrypted dump, e.g. a local test)
#   ./restore_drill.sh --latest --identity KEYFILE      (downloads the newest from BACKUP_REMOTE)
#   ./restore_drill.sh --dry-run ...                    prints the plan
#
#   BACKUP_REMOTE   needed for --latest (same value as pg_backup.sh)
#   DRILL_PG_IMAGE  default postgres:16
#   DRILL_ADMIN_URL optional, e.g. postgresql://postgres@localhost:5432/postgres (see above)
#
# Needs: docker (pg_restore and psql run inside the container) OR pg_restore+psql with DRILL_ADMIN_URL;
# age for .age files.
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
ADMIN="${DRILL_ADMIN_URL:-}"

if [ "$DRY" = 1 ]; then
  if [ -n "$ADMIN" ]; then
    log "DRY RUN. Would: create a temporary database on $(printf '%s' "$ADMIN" | redact),"
  else
    log "DRY RUN. Would: start a temporary $IMAGE container,"
  fi
  log "  decrypt ${FILE:-the latest dump from BACKUP_REMOTE} (key file: ${IDENTITY:-not needed for a plain dump}),"
  log "  pg_restore into it, compare row counts with the .json receipt, print the elapsed time,"
  log "  and remove the temporary database and every temporary file."
  exit 0
fi

if [ -n "$ADMIN" ]; then need pg_restore; need psql; else need docker; fi
START=$(date +%s)
WORK="$(mktemp -d)"
[ -d "$WORK" ] || die "no temporary folder"
CONTAINER="restore-drill-$$"
DRILL_DB="drill_$$"
cleanup() {
  if [ -n "$ADMIN" ]; then psql "$ADMIN" -qAt -c "drop database if exists $DRILL_DB" >/dev/null 2>&1 || true; fi
  if [ -z "$ADMIN" ]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi; rm -rf "${WORK:?}"
}
trap cleanup EXIT

if [ "$LATEST" = 1 ]; then
  require_env BACKUP_REMOTE
  NEWEST=$(dest_list "$BACKUP_REMOTE" | tail -n 1)
  [ -n "$NEWEST" ] || die "no dump found in the backup place"
  log "downloading $NEWEST"
  dest_get "${BACKUP_REMOTE%/}/$NEWEST" "$WORK/$(basename "$NEWEST")"
  dest_get "${BACKUP_REMOTE%/}/${NEWEST%.dump*}.json" "$WORK/receipt.json" 2>/dev/null || true
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
if [ "$(dirname "$DUMP")" != "$WORK" ]; then cp "$DUMP" "$WORK/restore.dump"; DUMP="$WORK/restore.dump"; fi
BASE="$(basename "$DUMP")"

if [ -n "$ADMIN" ]; then
  log "creating temporary database $DRILL_DB"
  psql "$ADMIN" -qAt -c "create database $DRILL_DB" >/dev/null
  # Same server, other database: swap the database name in the URL, keep user/host/options.
  DRILL_URL=$(python3 -c '
import sys
from urllib.parse import urlsplit, urlunsplit
u = urlsplit(sys.argv[1])
print(urlunsplit((u.scheme, u.netloc, "/" + sys.argv[2], u.query, "")))' "$ADMIN" "$DRILL_DB")
  log "restoring"
  pg_restore --dbname="$DRILL_URL" --no-owner --no-privileges --exit-on-error "$DUMP"
  q() { psql "$DRILL_URL" -At -c "$1"; }
else
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
  q() { docker exec "$CONTAINER" psql -U postgres -d drill -At -c "$1"; }
fi

log "checking"
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
