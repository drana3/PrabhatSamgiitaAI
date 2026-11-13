# Learn progress sync between devices

Status: built and tested, **not deployed**. The API needs a deploy that applies migration `0028_learn_progress`
(see "Deploying"). Until then the app's sync calls fail quietly (offline-safe) and Learn works as before.

## Резюме по-русски

- Для вошедших участников прогресс Learn (какие песни учит человек и что сделано по каждой: слушание, слова,
  смысл, аккорды) хранится и на сервере. После переустановки или на втором телефоне он возвращается.
- Гость ничего не отправляет: у него нет аккаунта.
- Слияние по каждой песне отдельно: побеждает запись с более поздним `updated_at`. Старая копия с сервера никогда
  не затирает более новые данные на телефоне. Без сети данные остаются на телефоне и уходят позже.
- Не синхронизируется: карточки слов, результаты квиза, стиль повторения (пока нет проверенных слов, см. F2 в
  чекапе). Это можно добавить позже тем же способом.
- Что нужно от Dada: развернуть API с миграцией `0028_learn_progress`. Миграция при запуске API применяется сама
  (так сделано в `app/main.py`), таблица создаётся и запасным `create_all`. На настоящей базе не проверялось.

## What is synced

One entry per song the learner started, keyed by song id (`ps-<number>`):

| field | meaning |
|---|---|
| `song_id`, `number` | `ps-7` and `7`; `number` is 1 to 5018 and `song_id` must equal `ps-<number>` |
| `title` | the title the app showed, 1 to 200 characters |
| `started_at` | when the song was put on the list (ms since 1970) |
| `removed` | the song was taken off the list. A marker, so the other phones take it off too. Its progress stays, as in the app |
| `path` | `listen`, `words`, `meaning`, `chords` (booleans): the app's steps, plus a passed song quiz |
| `updated_at` | when this entry last changed on the phone that wrote it (ms since 1970) |

Not synced: word cards (spaced repetition state), quiz bests, the review style. The Learn word data is still
prototype data (checkup item F2), so syncing cards would copy unverified content; the document format has
a `version` field and can grow.

## API

Both endpoints are member endpoints (same auth as `/members/*`: `X-Member-Proxy-Key` plus `X-MS-CLIENT-PRINCIPAL`,
see `security-member-auth.md`). No auth is 401. Both are rate limited (60 per minute per address, 429 with
`X-Error-Code: rate_limited`).

`GET /api/v1/members/me/learn-progress`

```json
{ "songs": [ { "song_id": "ps-7", "number": 7, "title": "...", "started_at": 1730000000000,
               "removed": false, "path": { "listen": true, "words": false, "meaning": false, "chords": false },
               "updated_at": 1730000500000 } ],
  "updated_at": "2026-11-06T10:00:00Z", "max_entries": 1000 }
```

A member who never synced gets `{"songs": [], "updated_at": null, ...}`. Reading creates nothing.

`PUT /api/v1/members/me/learn-progress` with `{"songs": [ ...entries the phone changed... ]}`

This is a **merge**, not a replace. Entries the phone leaves out are not touched, so an empty list is a plain read
and two phones cannot erase each other. The reply is the whole merged document (same shape as GET), so one
request both sends and receives.

### Merge rule (per song, last write wins)

- an incoming entry replaces the stored one only if its `updated_at` is **strictly newer**; a tie keeps the stored one;
- an `updated_at` in the future is cut back to the server's clock, so a wrong phone clock cannot pin a song;
- removal markers older than 90 days are dropped;
- the same song twice in one request is 422.

### Limits and errors

- at most 1000 entries (songs plus removal markers) per member. A request body with more is 422; a merge that would
  go over is **413** with `X-Error-Code: learn_progress_too_large` and nothing is changed;
- bad shapes are 422 (unknown fields, a `song_id` that does not match `number`, empty or over-long title, a number
  outside 1 to 5018, `updated_at` below 1 or past 2100). Nothing is stored when any entry is bad;
- the body is bounded by those field limits (about 350 KB at the full 1000 entries).

### Data

Table `member_learn_progress`: `user_id` (primary key, foreign key to `user_accounts` with `ON DELETE CASCADE`, so
`DELETE /members/me` removes it), `document` (JSONB: `{"version": 1, "songs": {"ps-7": {...}}}`), `created_at`,
`updated_at`. Code: `app/models/learn_sync.py`, `app/schemas/learn_sync.py`, `app/services/learn_sync.py`,
`app/api/v1/learn_sync.py`.

## The app

Files (all new): `lib/learn/syncMerge.ts` (the rules, pure), `lib/learn/syncApi.ts` (the two requests),
`lib/learn/syncEngine.ts` (one round, everything injected), `lib/learn/sync.ts` (wiring and triggers),
`stores/learnSyncStore.ts` (bookkeeping). It is started from `components/member/MemberSessionSync.tsx`.

- The Learn store has no change times, so the sync keeps its own per-song record (`stores/learnSyncStore.ts`, per
  account): what was last in step with the server and what is still waiting. It notices changes by comparing the
  store with that record, so the Learn store and the screens are unchanged.
- **When it runs:** a second after the app starts and the stored data is loaded, after sign-in, four seconds after the
  last change to the learning list or a song's progress (a burst of taps is one request), and when the app comes
  back to the foreground.
- **Offline-safe:** a failed request changes nothing. What was waiting stays marked and goes out next time. After a
  failure the automatic rounds pause for 30 seconds.
- **Never overwrites newer local data:** the server's entry is taken only when it is strictly newer than the local
  one. If the phone is newer it is kept and sent. One exception, on purpose: a song that was on the phone before
  it ever talked to the server (for example learned as a guest) and meets a newer but smaller server copy keeps its
  steps; the two step sets are combined once and the result is sent.
- **Guests are not touched.** No request, no bookkeeping. When a guest signs in, the app's existing rule moves the
  guest's Learn data into that account (`lib/account/owner.ts`), and the sync then sends it.
- **Accounts on a shared phone:** the bookkeeping is per account, like the Learn data. Another account never sees it.
- Disabled in the web preview with sample data (`MOCKUP_DATA`), so the prototype's sample songs never reach a server.

Known limits (honest list):

- Two phones offline at the same moment, both editing the *same song*: the later `updated_at` wins for that whole
  song, the other phone's steps on it are replaced. (The one-time combine above covers only a first sync.)
- "Reset all" on the phone clears local data; it does not erase the server copy, and the next sync brings the
  songs back. Deleting the account does remove the server copy.
- If the server copy disappears (the account was deleted and made again with the same sign-in), the phone notices
  that the server returns nothing while it holds songs, and sends them again. The phone itself keeps an account's
  Learn data put aside after deletion (existing behaviour of `lib/account/owner.ts`).

## Deploying

1. Deploy the API. On start it runs `alembic upgrade head` (`app/main.py: initialize_schema`), which applies
   `0028_learn_progress` after `0027_recordings`, and then `Base.metadata.create_all` as a fallback. The migration
   skips itself if the table already exists, so either path is safe, and `downgrade` drops the table.
2. No new settings, no new secrets.
3. Ship the app build that contains `lib/learn/sync.ts`. An old app simply never calls the endpoints.

Verified: 29 API tests on SQLite (merge rules, limits, auth with the real member auth, the migration's
`upgrade` and `downgrade` on an in-memory SQLite) and the app's vitest suite (pure rules, a two-phone simulation
against a fake server that follows the same rule, the requests, and the real stores with a fake network). Not
verified: Postgres (JSONB, the row lock `SELECT ... FOR UPDATE`, running the migration on a real server), a real
phone, a real second device.
