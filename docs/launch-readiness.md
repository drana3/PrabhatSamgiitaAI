# Launch readiness: what is done, by whom, what is left

Written 2026-11-10 on the `redesign/v2` branch. Nothing here was run against production, nothing was deployed, no
real account or secret was used. "Done by Claude" means: written, tested on a laptop, committed. "Only Dada" means:
needs a login, a payment, a key or a decision that only the owner can make.

## The table

| # | Item | Done by | State | What remains |
| --- | --- | --- | --- | --- |
| 1 | Server tools (ffmpeg, fpcalc, tzdata, ClamAV) | Claude | Code and Docker image ready; tested | Dada/team: deploy a new image. Decide ClamAV (see below) |
| 2 | PostgreSQL rehearsal | Claude | Migrations from empty and 4 steps down/up pass; suite results below | Team: look at the list of real differences below |
| 3 | Backups | Claude (scripts, drill) / Dada (accounts) | Backup, restore, drill rehearsed on a real PostgreSQL 16 | Dada: backup bucket, age key, secrets, first real run (`docs/backups.md`) |
| 4 | R2 storage | Claude (code, tests) / Dada (bucket) | Fully driven by environment; stand-in bucket tests | Dada: bucket, token, public address, env values (`docs/storage.md`) |
| 5 | Crash reports (Sentry) | Claude (already wired) / Dada (project) | App and server wired, empty DSN is harmless, personal data scrubbed | Dada: Sentry project, DSN values; web site has no Sentry |
| 6 | Build and stores (EAS) | Claude (review) / Dada (logins) | `expo-doctor` 16 of 18, config reviewed | Dada: `eas login`, Apple team, keystore, store listings |
| 7 | Deep-link files | existing in main | `apple-app-site-association` has the Team ID; `assetlinks.json` still has a placeholder | Dada: Play App Signing SHA-256 (`docs/app-links.md`) |
| 8 | Store reviewer account | Claude | Built, disabled by default, 16 tests, documented | Dada: set three environment values, paste login into both consoles (`docs/store-review-account.md`) |
| 9 | This list | Claude | this file | keep it current |
| 10 | Daily housekeeping (cleanup of old rows and orphan uploads) | Claude | Built, off-switch `HOUSEKEEPING_ENABLED`, tests on SQLite, admin page `GET /api/v1/admin/housekeeping` | Team: deploy; watch the first run in the log (`docs/housekeeping.md`); decide on bucket files and song-bound chat messages |

## 1. Server tools

* Present on the laptop this was written on: `ffmpeg`, `ffprobe`, `fpcalc`, tzdata (Python can load `Asia/Kolkata`).
  Missing there: `clamscan`, `clamd`, `freshclam`, and also `age`, `rclone`, Docker, `pg_dump`/`psql` (not
  installed on purpose: nothing was installed on the machine).
* The Docker image (`apps/api/Dockerfile`) installs `ffmpeg`, `libchromaprint-tools` (gives `fpcalc`) and
  `tzdata`. ClamAV only with `--build-arg INSTALL_CLAMAV=1`: its signatures need about 1 GB of memory per scan and the
  Azure container has 1 GB. Better: a separate `clamd` container and `CLAMD_HOST`.
* Missing tool = no crash: one line at start (`server tools: ffmpeg=yes, fpcalc=NO, ...`) and the feature degrades
  (no loudness number, no similar-sound warning, India time zone fallback only for India, scan skipped in `auto`).
* Check: `GET /api/v1/admin/server-tools` (admin) lists each tool: present or not, its version line, what it is for, what is lost without it (no paths); `/api/v1/health/deep` shows yes/no.
  No secrets in either. Tests: `apps/api/tests/test_server_tools.py`.
* Open decision: ClamAV `auto` (default, upload goes on if no scanner) or `required` (upload waits): `docs/upload-validation.md`.

## 2. PostgreSQL rehearsal

Method: a throw-away PostgreSQL 16.2 (`pgserver` in a virtual environment outside the repository, nothing installed
on the system). Not Neon itself.

* `alembic upgrade head` from an empty database: **fails at 0027 before the fix, passes after it** (99 tables, version
  `0068_video_thumbnail`). Cause: 0027 builds `recordings` from the current model and the model points at a table that
  only a later migration added. Fixed in `alembic/versions/0027_recordings.py` (not a main file).
* Down 4 steps (0068 to 0064) and up again, twice, on a database with data: no error, data unchanged.
* **Real bug found and fixed:** the "play counted once per listener per day" insert reported `rowcount -1` on PostgreSQL,
  so every repeat play was counted again (SQLite reported 0). Fixed with `RETURNING` in `song_plays.py` and
  `author_stats.py`. Guard test: `apps/api/tests/test_postgres_traps.py`.
* Whole API test suite on PostgreSQL (`tests/pg_rehearsal.py`, one schema per test, session time zone UTC like Neon):
  **2515 passed, 68 not passed (62 failed, 6 errors) of 2583.** Run it yourself:
  `PG_REHEARSAL_URL=postgresql+psycopg://user:pw@host/scratch_db PYTHONPATH=tests .venv/bin/python -m pytest -p pg_rehearsal -q`
  (the database name must contain `rehearsal` or `scratch`; the plugin refuses anything else).
* **What the 68 are** (checked one by one by their first error line; none is a bug in the running app):
  * 53 are migration tests (49 in files named `*_migration*`, 4 more in song_chords, song_comments, recording_info): they test migrations on SQLite with Alembic batch mode, `PRAGMA` or raw
    SQLite statements (`type "datetime" does not exist`, `PRAGMA foreign_keys=ON`);
  * 6 errors in `test_account_deletion.py`: its fixture runs `PRAGMA foreign_keys=ON` (SQLite only);
  * `test_play_fraud` (2) and `test_song_translations` (1): the test writes made-up keys longer than the column
    (SQLite ignores `VARCHAR(16)`, PostgreSQL does not);
  * `test_recording_loudness` (2), `test_takedown` (1), `test_song_translations` (2): the test builds a table by hand
    without an automatic `id`;
  * `test_recording_practice` (1): relies on SQLite's order for equal values; add a second sort key if you want it
    deterministic.
* **Differences between the migrations and the models** (the app also calls `create_all` at start, which hides them):
  * tables `push_devices`, `push_preferences`, `push_deliveries` exist only in the migrations (no ORM model);
  * 55 columns are nullable in the migrations and `NOT NULL` in the models (mostly `created_at`/`updated_at` and
    `metadata_json` in old tables such as `quiz_*`, `member_sessions`, `media`, `notations`); 22 indexes differ.
  A database born from migrations therefore differs slightly from one born from the models. Harmless today; decide
  once which one is the truth before the first real migration on Neon. Nobody changed those old migrations.

## 3. Backups

Scripts in `infra/backup/`, plain-words guide `docs/backups.md`. Rehearsed on the PostgreSQL above:

* `pg_backup.sh` three times with `BACKUP_KEEP_COPIES=2`: the oldest dump and receipt were removed, two stayed.
* `restore_drill.sh --latest` (temporary database on the same server, no Docker): restore under one second, the
  counts matched the receipt (songs 3, recordings 25, accounts 1).
* `restore.sh --latest` into a new database: **row counts of all 99 tables identical** to the source; a second run was
  refused without `--replace`.
* Not rehearsed (tools not installed): real `age` encryption (flow tested with a stand-in), real `rclone` upload,
  Neon's own address, the time a real-size database needs.

## 4. R2 / storage

Everything comes from environment: `RECORDING_STORAGE_BACKEND`, `RECORDING_S3_ENDPOINT`, `RECORDING_S3_BUCKET`,
`RECORDING_S3_REGION`, `RECORDING_S3_ACCESS_KEY_ID`, `RECORDING_S3_SECRET_ACCESS_KEY`, `RECORDING_PUBLIC_BASE_URL`.
`apps/api/tests/test_s3_fake_server.py` runs the adapter against a stand-in bucket that checks signatures (wrong key,
expired link, changed address, wrong content type are refused). Found and fixed: the docs promised a signed link per
play without a public address, but the code needs `RECORDING_PUBLIC_BASE_URL` (the address is stored in the database).
Now the s3 backend names the missing setting at start. Not in the repository on purpose: the Azure deploy script
(`infra/azure/deploy-app.sh`, a main file) passes none of these values to the container yet; add them as secrets
when the bucket exists.

## 5. Crash reports

* Server: `apps/api/app/observability.py`, `SENTRY_DSN` (empty = off), `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`,
  `SENTRY_TRACES_SAMPLE_RATE`. Scrubs bodies, cookies, query strings, auth headers, IP, emails, tokens, signed-URL
  signatures; local variables not attached; only 5xx and unhandled errors.
* App: `apps/mobile/lib/observability/` with `EXPO_PUBLIC_SENTRY_DSN`; follows the person's analytics choice; build
  plugin for source maps only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are set in EAS.
* Tests: `apps/api/tests/test_observability.py` (9), `apps/mobile/__tests__/observability.test.ts` (12), pass.
* The web site (`apps/web`) has no crash reporting.

## 6. Build and stores

`npx expo config --type public` works offline; bundle id and package `net.prabhatasamgiita.ai`, scheme `prabhatai`,
iOS background audio, privacy manifest (4 required-reason APIs), encryption flag, microphone and speech strings
(voice search only; the app has no in-app recording), photo and camera strings (profile picture), Android media
playback permissions, external storage blocked. Nothing needed fixing. `expo-doctor`: 16 of 18 checks pass.
The two warnings are not ours to fix quietly: `react-native-track-player` is listed as not supporting the new
architecture by the React Native Directory (the app plays audio with it; check on a real device), and `expo-asset`
is one patch version behind (`npx expo install --check`).
There is no `expo-updates` in the app, so there are no update channels: every fix reaches people as a new store build.
`eas.json` submit block reads the Apple values from `APPLE_ID`, `APPLE_APP_STORE_CONNECT_APP_ID`, `APPLE_TEAM_ID`;
the Android block has no service-account key path yet.

## 7. Deep-link files

Both files already exist in `apps/web/public/.well-known/`. `apple-app-site-association` carries Team ID `2665NAM545`.
`assetlinks.json` still holds `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`. Steps for Dada: `docs/app-links.md`.

## 8. Store reviewer account

`docs/store-review-account.md`. Off unless `STORE_REVIEWER_ENABLED=true`; email and password only from the environment.

## 9. Daily housekeeping

`docs/housekeeping.md`. Once a day (first run 10 minutes after start) the API deletes expired sign-in sessions, old
one-time codes and reset tokens (7 days after expiry), finished rate-limit counters, raw play rows older than 400 days
(the daily counters stay), anonymous usage events older than 180 days, read notices older than 180 days and upload files
on the server disk that no recording names (48 hours). Songs, recordings, comments, favourites, playlists and chat are
never touched. Batches of 1000, one failing cleanup does not stop the others, nothing raises into the app.
`HOUSEKEEPING_ENABLED=false` turns it off; `GET /api/v1/admin/housekeeping` (admin) shows the last run. No migration.
Tests: `apps/api/tests/test_housekeeping.py`. Not covered: orphan files in an R2 bucket.

## 10. Terms page, age confirmation, Apple token revocation

Store requirements, written 2026-11-10. Tests green; nothing run against Apple or a real device.

* **Terms of use:** the website now serves `/terms` (`apps/web/app/terms/page.tsx`; before: 404). Short English text: who may
  use it (16+), what may be uploaded, the licence to play uploads, takedown (links `/takedown` and the copyright address),
  account deletion, no warranty, contact. Marked "[нужна проверка владельцем]" on the page: the owner / a lawyer reads it. The
  support address shown is the one the privacy page uses (`apps/web/lib/contact.ts`, one line to change when it is decided).
  The app links it from About (Legal card) and from the sign-in screens (existing `termsUrl()`).
* **Age confirmation:** web and app e-mail sign-up have the box "I'm 16 or older"; Apple / Google buttons have the line "By
  continuing you confirm you are 16 or older". API `age_confirmed`: false refused, missing accepted for old builds
  (`REQUIRE_AGE_CONFIRMATION=true` later). Not stored (no column, no migration for it). `docs/age-confirmation.md`.
* **Apple token revocation:** `apps/api/app/services/apple_revoke.py`; the app now sends `authorizationCode`; one new table
  (migration `0069_apple_refresh_tokens`). Env: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (secret).
  `docs/apple-token-revocation.md`. Dada: create the Apple key, set the three values, run migration 0069 on a copy first,
  ship the app build, test once on a real device.

## What needs Dada (short list)

Neon account and its direct address; backup bucket in another account, age key (offline), GitHub secrets; Cloudflare
R2 bucket, token and public address; Sentry project; `eas login`, Apple developer team, Play Console, keystore; Play
App Signing SHA-256; reviewer account values; deploy of the new image; the ClamAV decision; the Apple "Sign in with Apple" key
(three environment values) and migration 0069; a read of the Terms text and the final support address.
