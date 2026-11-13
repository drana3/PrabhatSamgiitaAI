# Crash reports and monitoring

Plain words first. The code is in place and **switched off** until a key is set; nothing here sends data today.
Written 2026-11-09.

## What problem this solves

Today a crash on someone's phone, or an error on the server, is invisible unless the person writes to you. Two
tools fix that, both with free levels:

1. **Crash and error reports** (Sentry): when the app or the server fails, one short report arrives with the line
   of code that broke, so it can be fixed.
2. **"Is it up" checks** (an uptime service): a robot opens the server's health address every few minutes and
   writes to you when it does not answer.

## Is the free Sentry plan enough

Sentry Developer (free) plan, read 2026-11-09 from https://sentry.io/pricing/ : about **5 000 errors a month,
one user, 30 days of history**. The paid Team plan starts at **29 USD a month** (about 2 550 INR at 88 INR per USD,
an assumption), which alone is more than the 2000 INR budget. So the free plan is what we plan on.

Why it is enough for a long time:

* Only **real faults** are sent: server errors (HTTP 5xx) and unhandled exceptions, and in the app, crashes. A
  wrong password, a missing page or a bad form (4xx) is not a crash and is not sent. A quiet app produces a few
  dozen reports a month.
* Performance tracing is **off** (`SENTRY_TRACES_SAMPLE_RATE=0`); it would use the quota fast.
* One user is you. If a second person must see reports, share one login or accept the paid plan.
* **The risk** is one bug that fires thousands of times (a loop on every launch). Sentry then drops the extra
  reports silently, and the quota lasts a day. Use "Spike protection" and the alert below so you hear about it.

If the free plan stops being enough, the code does not change: only the DSN does. Self-hosted alternatives (GlitchTip
speaks the same protocol) can take the same DSN.

## What is sent, and what is not

Privacy is the rule that decides everything here. The tests in `apps/api/tests/test_observability.py` and
`apps/mobile/__tests__/observability.test.ts` prove each line.

Server:

* Request bodies, cookies, query strings, the client IP and the user's email are **removed** before sending.
* Headers with secrets are removed (`Authorization`, cookies, `X-Admin-Key`, member keys, forwarded IP).
* Inside every message, email addresses become `[email]`; bearer tokens, JWTs, signed-URL signatures
  (`X-Amz-Signature`), upload tokens and long hex strings become `[redacted]`.
* `send_default_pii` stays False; local variables are not attached.
* The same masking is applied to **ordinary log lines** (`RedactingFilter`), so the server log is also clean.
* If Sentry cannot start (bad address), the API starts anyway.

App:

* Starts only when `EXPO_PUBLIC_SENTRY_DSN` is set **and** the person's usage-data choice is not "off". Choosing
  "off" in Profile, Usage data stops crash reports too (`docs/analytics-flags.md`).
* Message text, breadcrumbs and URLs are scrubbed the same way before they leave the phone.

## Turning it on (Dada)

1. Create a free account at sentry.io and two projects: one for Python (FastAPI), one for React Native.
2. Copy each project's **DSN** (an address that can only send reports in; it is not a password).
3. Server: set `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production` and optionally `SENTRY_RELEASE` in the Azure Container
   App environment. Redeploy. Open `/health/deep` to see the server is fine, then cause a harmless test error
   (ask me) and see it arrive.
4. App: set `EXPO_PUBLIC_SENTRY_DSN` in the EAS environment for the build.
5. **Source maps** (so a crash shows real code, not a minified blob): in EAS add the secrets `SENTRY_AUTH_TOKEN`,
   `SENTRY_ORG`, `SENTRY_PROJECT`. When all three exist, `app.config.js` adds the Sentry Expo plugin and the build
   uploads the maps. Without them the build still works and reports are just harder to read. The auth token is a
   secret: only in EAS, never in the repository or chat.
6. Not verified on a real device: the native Sentry module in an EAS build. After the first build, force a crash
   from a debug build and check it arrives.

## Alerts (set in Sentry, 5 minutes)

* "A new issue appears" to your email: the default rule is fine.
* "An issue happens more than 50 times in an hour": catches the loop bug above before it eats the quota.
* Enable Spike protection in the project settings.

## "Is it up" checks

Two health addresses exist:

* `/health` (also `/health/live`): answers `{"status":"ok"}` if the process runs. Cheap.
* `/health/deep`: also asks the database a trivial question (4 second limit). Returns **200** when the database
  answers and **503** when not, so an uptime service can alert on the status code alone. It names no secret, host
  or row count: only whether each part works, the version and the environment, and whether recordings go to a
  bucket or to local disk (a useful thing to see after the storage move, see `docs/storage.md`).

Proposal for a free service: **UptimeRobot** (free plan: 50 monitors, 5 minute checks, email alerts; verify
current limits at uptimerobot.com before signing up). Make two monitors: `https://<api host>/health/deep`
(keyword `"status":"ok"`) and the website home page. Alert to your email. Free tiers of Better Stack or Cronitor
work the same way. This is the one thing in this document that detects "the whole server is down", which Sentry
cannot, because a dead server sends nothing.

## Log levels

* Production default is INFO; warnings and errors always show.
* Libraries that print full URLs (`httpx`, `httpcore`, `azure`, `urllib3`) are held at WARNING so tokens in
  addresses do not reach the log.
* In Sentry, error-level log lines become reports; info and warning lines only become breadcrumbs attached to the
  next report.
* Do not log request bodies, emails or tokens in new code. The filter is a net, not permission.

## Where the code is

| What | File |
| --- | --- |
| Masking, Sentry start, log filter | `apps/api/app/observability.py` |
| Wiring | `apps/api/app/main.py` (`harden_logging()`, `init_sentry(settings)`) |
| Health addresses | `apps/api/app/api/v1/health.py` |
| Settings | `apps/api/app/config.py` (`SENTRY_*`) and `.env.example` |
| App | `apps/mobile/lib/observability/{scrub,crashReports,init}.ts`, started from `app/_layout.tsx` |
| Source maps | `apps/mobile/app.config.js` (`sentryPlugins`) |
