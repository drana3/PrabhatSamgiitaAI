# Daily housekeeping: what the server cleans up by itself

Status: built and tested on SQLite, **not deployed**. No migration, no new table. Written 2026-11-10.

## Резюме по-русски

- Раз в сутки сервер сам удаляет то, что копится без предела и никому не нужно: просроченные сессии входа, старые
  одноразовые коды, счётчики лимитов, старые «сырые» строки прослушиваний (если они уже посчитаны в дневных
  счётчиках), анонимные события приложения старше 180 дней, прочитанные уведомления старше 180 дней и файлы
  загрузок, которые не стали записью (старше 48 часов).
- Песни, записи, комментарии, избранное, плейлисты, чат и профиль не трогаются никогда.
- Включено по умолчанию. Выключить: `HOUSEKEEPING_ENABLED=false`. Смотреть: `GET /api/v1/admin/housekeeping` (ключ админа).
- Папку с файлами чистит только при локальном диске. В бакете (R2) это делает правило жизненного цикла бакета.

## In plain words

Some tables only grow: every sign-in leaves a session row, every request leaves a counter, every listen leaves a raw
row. Most of them are useless after a while. A job in the API process wakes up once a day, deletes what is safe to
delete, and writes down how much it removed. If it fails, the app keeps running and the next day it tries again.

It reuses the way the API already runs a background job (the catalogue poll in `app/main.py`, an `asyncio` task
started in `lifespan`). The `apscheduler` scheduler in that file is off by default (`SCHEDULER_ENABLED`) and has no jobs,
so it was not used.

## What is cleaned

Defaults in brackets. Every number is an environment variable, read at each run. A value below the floor is raised
to the floor, so a typo cannot delete today's rows.

| Name in the report | What | Deleted when | Env variable (default, floor) |
| --- | --- | --- | --- |
| `member_sessions` | Sign-in sessions (refresh tokens) | expired, or revoked, more than 7 days ago | `HOUSEKEEPING_SESSIONS_GRACE_DAYS` (7, 1) |
| `phone_codes` | One-time phone codes | expired more than 7 days ago | `HOUSEKEEPING_CODES_GRACE_DAYS` (7, 1) |
| `password_reset_tokens` | Password-reset tokens | expired, or used, more than 7 days ago | `HOUSEKEEPING_RESET_TOKENS_GRACE_DAYS` (7, 1) |
| `rate_limit_counters` | Counters of the request limiter | their own `expires_at` passed 1 hour ago | `HOUSEKEEPING_RATE_LIMIT_GRACE_HOURS` (1, 1) |
| `play_events` | Raw listen rows of recordings and of catalogue songs | older than 400 days | `HOUSEKEEPING_PLAY_EVENT_DAYS` (400, 90) |
| `app_events` | Anonymous usage events | older than 180 days | `HOUSEKEEPING_TELEMETRY_DAYS` (180, 30) |
| `read_notices` | Notices to a member (recording removed or restored) that were read | read more than 180 days ago | `HOUSEKEEPING_NOTICE_DAYS` (180, 30) |
| `orphan_uploads` | Audio files on the server disk that no recording names | not written for 48 hours | `HOUSEKEEPING_ORPHAN_FILE_HOURS` (48, 48) |

Why each is safe:

* **Sessions, codes, tokens.** They cannot be used after expiry. The 7 days after expiry keep a short trail for
  support ("why was I signed out?") and for the refresh-token reuse check, which reads a revoked row.
* **Rate-limit counters.** The limiter itself marks the row as deletable after its window; it only cleans up every N
  calls, so rows stay when traffic stops.
* **Play events.** Counted only because `play_daily` and `song_play_daily` already hold the totals (written in the same
  step as the raw row, `services/author_stats.py`, `services/song_plays.py`). The raw rows are kept 400 days for the
  fraud rules and then pruned. This is the same number the code already used (`PLAY_EVENT_RETENTION_DAYS`); the
  request path prunes at most daily as well, so the two do not conflict. The daily counters are never deleted.
* **App events.** The 180 days are the rule already written in `docs/analytics-flags.md` ("nothing calls it by
  itself yet"). This job is that call. The monthly "purge" button is not needed any more.
* **Notices.** Only read ones. An unread notice stays however old it is.
* **Orphan files.** An upload is one `PUT` to the storage; the recording row is written only at publish. A file with no
  row after 48 hours was abandoned (app closed, "Cancel" after the file was sent). A file named by any
  `recordings.audio_key`, whatever its status (published, removed, hidden), is never touched; neither is anything that
  does not look like `recordings/<member id>/<id>.<ext>`.

## What is deliberately not cleaned

| Thing | Why |
| --- | --- |
| Songs, recordings, comments, favourites, playlists, chat messages, profiles, learn progress | Member or team content. Never touched. |
| `push_deliveries`, dead push tokens | Already done by `services/push.py`: dead tokens are deleted when Expo reports `DeviceNotRegistered`, deliveries after 7 days. |
| E-mail verification tokens | There is no such table (sign-in by e-mail uses the password-reset flow only). |
| Idempotency keys | There is no such table. |
| Guest-merge rows | There are none on the server: a guest's saves live on the phone and are merged by `POST /members/favorites/merge`, which stores nothing extra (`docs/guest-saves.md`). |
| Temporary upload chunks | There are none: uploads are a single `PUT`, not chunked. |
| Expired chat messages tied to a song (`user_chat_messages.expires_at`) | Member content. Expired general messages are folded into the member's monthly summary on their next visit (`services/members.py`); song-bound ones are left, because deleting a member's text on a timer was not asked for. Decide separately. |
| Files in an R2/S3 bucket | The job cannot list a bucket, and a blanket lifecycle rule on `recordings/` would delete published files too. Not covered; see "Open items". |

## How it runs

* Started in `lifespan` (`app/main.py`) by `start_housekeeping()`, stopped on shutdown. Never started when
  `APP_ENV=test`.
* First run 10 minutes after the server starts (`HOUSEKEEPING_INITIAL_DELAY_MINUTES`, default 10), then every
  `HOUSEKEEPING_INTERVAL_HOURS` (default 24, at least 1).
* Off with `HOUSEKEEPING_ENABLED=false`.
* Each cleanup deletes in batches: read at most 1000 primary keys, delete exactly those, commit, repeat
  (`delete_in_batches`). One cleanup stops after 1000 batches (a million rows) and carries on the next day.
* Each cleanup has its own session and its own try/except. A failure is logged and put in the report; the rest run.
  The loop never raises into the app.
* Several API instances: each runs its own loop. The deletes are idempotent, so two at once only mean one finds nothing.

## Look at it

`GET /api/v1/admin/housekeeping` with `X-Admin-Key` (the same gate as `/api/v1/admin/server-tools`):

```json
{
  "enabled": true,
  "retention": { "interval_hours": 24, "sessions_grace_days": 7, "play_event_days": 400, "...": "..." },
  "cleanups": ["member_sessions", "phone_codes", "..."],
  "last_run": {
    "started_at": "2026-11-10T12:00:00+00:00",
    "duration_ms": 412,
    "total_deleted": 1830,
    "failed": [],
    "results": { "member_sessions": { "deleted": 12, "error": null }, "...": {} }
  }
}
```

`last_run` is `null` until the first run since the server started: the report is kept in memory and in the log
(`housekeeping: ...` lines), not in the database, because a table would need a migration. Counts and the error class
only; no row content, address or file path.

## Tests

`apps/api/tests/test_housekeeping.py` (SQLite in memory, a temporary folder for files): every retention edge, composite
key delete, batch size, one failing cleanup, a missing table, the daily counter surviving, files kept when a recording
names them, environment floors, the loop surviving a failed run and stopping on cancel, the admin page and its gate,
the real app mounting the route.

## Open items

* Not run against PostgreSQL or the real data. The deletes use plain `SELECT ... LIMIT` then `DELETE ... IN`, which both
  databases accept; the first real run should be watched in the log.
* Orphan files in an R2/S3 bucket are not found. If it matters, add a listing method to the storage adapter and reuse
  `clean_orphan_uploads`'s check (no row names the key and the object is older than 48 hours).
* Decide whether expired song-bound chat messages should be deleted.
