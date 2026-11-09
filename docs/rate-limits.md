# Request limits

One limiter protects the whole API. It answers `429 Too Many Requests` with a `Retry-After` header
and the code `rate_limited` in `X-Error-Code`. The apps already treat that as "wait a little".

Code: `apps/api/app/services/rate_limit.py`. Tests: `apps/api/tests/test_rate_limit.py`.

## What changed

Before, each limiter (sign-in, uploads, comments, plays) lived in the memory of one API process.
A restart, or a second copy of the API, reset every counter, and each limiter had its own numbers
in its own file. Now:

- the counters live in the database table `rate_limit_counters` (migration `0055`), so they
  survive a restart and are shared by every API process;
- every number is in one table, `POLICIES`, in `rate_limit.py`;
- the route to policy table `ROUTES` applies them before the route runs, so the routes themselves
  did not have to change;
- if the database cannot be reached, the limiter falls back to the memory of that process for that
  call and logs it. It never blocks people because the counter store is down.

## The limits

| Policy | Limit | Counted per | Where |
| --- | --- | --- | --- |
| `sign_in` | 20 in 10 min | address | login, register, forgot-password, reset-password (middleware); token exchange (in the route) |
| `sign_in_account` | 8 in 15 min | e-mail address **and** caller address | login (in the route). Stops one place hammering one account. The caller's address is part of the key on purpose: keyed by the e-mail alone, a stranger could use up the owner's tries and lock the owner out |
| `password_reset_email` | 5 in 1 hour | e-mail address | forgot-password (in the route). Its own bucket, so nobody fills one inbox with reset links and asking for resets never blocks signing in |
| `token_refresh` | 60 in 10 min | address | `POST /members/session/refresh` |
| `upload` | 40 in 1 hour | member (else address) | upload targets, upload files, `POST /recordings` |
| `comment` | 30 in 10 min | member (else address) | song and recording comments |
| `play` | 240 in 10 min | address | `POST /plays`, `POST /recordings/{id}/play` |
| `takedown` | 5 in 24 h | address | `POST /takedown` |
| `takedown_counter` | 3 in 24 h | member | counter-notice |
| `default_write` | 300 in 10 min | member (else address) | every other `POST`, `PUT`, `PATCH`, `DELETE` under `/api/v1` except `/api/v1/admin`. A net, so a new route is never unlimited by accident |

Reads (`GET`) are not limited here. The admin routes use the admin key and are left out.

To change a number, change it in `POLICIES`. Nothing else needs to move.

## Keys, and what is stored

A counter key is a salted hash of the address or the account id, cut to 24 characters. **No
address is stored.** The salt is `RATE_LIMIT_PEPPER` (else `MEMBER_SESSION_SECRET`). If neither is
set, a random one is made at start-up, so keys change at every restart (safe, but counters are
then not shared between processes; set the variable in production).

The account for "per member" is read from a **valid signed access token** only. A forged or
expired token counts as no account, and the request is counted by address instead.

## Which address

The API sits behind the Azure ingress, which appends the real client address to the end of
`X-Forwarded-For`. `client_ip` takes the `RATE_LIMIT_TRUSTED_PROXY_HOPS`-th entry **from the right**
(default 1). Anything a caller wrote themselves sits to the left and is ignored, so a forged header
does not buy a new allowance. If you put another proxy in front (for example Front Door), raise the
number to 2. **Check this on the real deployment**; if the number is wrong, either everybody shares
one address or the header can be forged.

## Settings (`.env.example`)

| Variable | Meaning |
| --- | --- |
| `RATE_LIMIT_ENABLED` | `false` turns every limit off (emergency only) |
| `RATE_LIMIT_BACKEND` | `database` (default) or `memory` |
| `RATE_LIMIT_PEPPER` | secret that salts the keys |
| `RATE_LIMIT_TRUSTED_PROXY_HOPS` | see above |

## How the count works

A sliding window made of two fixed windows: the current one and the one before. The estimate is
`current + previous * (share of the previous window that still overlaps)`, so a burst across the
border of two windows is not free. Old rows are deleted as the counter runs. The write is one
upsert, so two requests at the same moment both count.

## Redis later

The database store implements a one-method interface, `RateStore.hit(key, limit, window_seconds)`.
To use Redis, write a second class with that method and return it from `default_store()`. Nothing
else changes. The database is enough for now: one small write per limited request.

## What this does not do

- It does not stop a patient attacker with many addresses. It stops accidents, simple scripts and
  one-address floods. Play-count fraud has its own second line, see `docs/play-fraud.md`.
- A mobile network or a school may share one address. The limits are generous for that, and
  signed-in members are counted by account where it matters.

## Needs a real deployment to check

- The hop count (above).
- The PostgreSQL behaviour of the upsert under load. It is tested on SQLite; the statement is the
  standard `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`.
