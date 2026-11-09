# Member authentication: signed per-user session tokens

Status: **fixed in code (QA-001), waiting for deploy and for one app release.** The shared key that used to sit
in every installed app can no longer make anyone an administrator or a team member, and it can no longer be
used to pretend to be a specific owner. The old key keeps working for ordinary member features until it is
switched off, so old app versions do not break on the day of the deploy.

Decisions that belong to the owner are marked **DECISION**.

## 1. What was wrong

The phone proved who the member was with a header it built itself (`X-MS-CLIENT-PRINCIPAL`) plus one shared key
(`MEMBER_PROXY_KEY`) that lived inside the app bundle. Anyone could unzip the app, read the key and, with `curl`,
claim any identity: read another member's data, delete an account, or send an owner's e-mail and become admin.
Two more things used the same key: the deploy-smoke name trick (any name containing `deploy-smoke` became admin)
and the signing of recording links.

## 2. What it is now, in plain words

1. The member signs in with Google, Apple, Microsoft or e-mail and password. (Facebook login was removed on
   9 November 2026.)
2. For Google, Apple and Microsoft the phone sends the provider's own signed proof to
   `POST /api/v1/members/session/exchange`. The **server checks that proof with the provider** (signature,
   issuer, audience = our app ids, expiry). A made-up profile fails here.
   E-mail sign-in is checked by the password on the server and returns the tokens directly.
3. The server answers with two tokens:
   - an **access token**, valid one hour, bound to the member's account id and to one device session. It carries
     **no role**, so there is no admin flag to forge;
   - a **refresh token**, valid 30 days (renewed on use), stored on the server only as a hash. Each refresh gives
     a new pair. If an already used refresh token turns up again (a copy), the whole session is ended.
4. The phone keeps both in the system's secure storage (Keychain on iOS, Keystore on Android through
   `expo-secure-store`), never in AsyncStorage, and the Android backup rules exclude that file. It sends
   `Authorization: Bearer <access token>` and refreshes quietly before it expires.
5. **Admin and team rights are read from the database on every request.** Remove someone's admin flag and the
   very next request they make is a plain member request, even with a valid token.

### E-mail sign-up has no mobile number (decision of 9 November 2026)

Sign-up with e-mail is **name, e-mail, password**, three screens in the app. The app does not ask for a mobile
number and no longer sends one. `POST /api/v1/auth/register` accepts a number from an older app or from the
website form (`phone_country_code`, `phone_number`) and **ignores it: it is not stored** and the same number on
two sign-ups is not a conflict any more. `phone_required` in the member profile is always `false`, so nobody is
sent to a "add your number" screen (the app also ignores the flag from an older server). Accounts that already have
a number keep it; `PATCH /api/v1/members/phone` still lets a person add or change one by choice. No migration:
`user_accounts.phone_e164` was already optional.

Still to do (not changed here): the website sign-up form (`apps/web/components/email-auth-panel.tsx`) still asks
for a number, which the server now ignores, and `apps/web/components/phone-required-gate.tsx` becomes inactive by
itself. Remove the field from the form.

### The old shared key

Requests that still arrive with `X-Member-Proxy-Key` and a self-made principal are called **legacy**:

- they work as an **ordinary member only**. Admin, super admin and team rights are forced off for that request
  and nothing is saved, whatever e-mail or name the principal claims;
- their **e-mail address is ignored completely**: it is never used to find, merge or promote an account and is
  never written to one. Anyone holding the shared key can type any address, so it proves nothing. (Only the
  website, with its own key, and a provider's signed proof can vouch for an address.);
- they are counted (`legacy_hits`, and a log line) so we can see when old apps have faded out;
- they can be switched off completely with `ALLOW_LEGACY_MEMBER_PRINCIPAL=false`.

The website is a separate case. The website's server forwards an identity that Azure checked, and it now sends
its **own** key (`WEB_PROXY_KEY`, never shipped to a phone). That key keeps the website's full behaviour
(including admin from the owner list). An old API ignores the new header, so the order of deploy below is safe.

## 3. Other holes closed on the way

- An address is only matched against accounts whose own address a provider confirmed (Google, Apple,
  Microsoft). An account made with e-mail and password or with Facebook (old accounts) is never matched by address at sign-in,
  so a stranger cannot register someone else's address first and have the real owner land in that account.
  An unverified address is not stored at all.
- An **unverified e-mail** never finds, merges or promotes an account. Google and Apple say whether the e-mail is
  verified, Microsoft only for known tenants or when it says so.
- **Owner e-mails cannot be registered** as a local (password) account: 409.
- The **deploy-smoke name trick** works only for the website key, not for tokens or the legacy key.
- Recording links and the author-statistics pepper no longer fall back to the shared key in production;
  they need `RECORDING_SIGNING_SECRET` (or `MEMBER_SESSION_SECRET`).
- A **password reset** ends every session of that account.
- Sign-out ends the session on the server (best effort) and removes the tokens from the phone at once.

## 4. Files

API: `app/services/member_tokens.py` (issue, verify, refresh, revoke), `app/services/provider_tokens.py`
(Google, Apple, Microsoft proofs), `app/api/v1/member_sessions.py` (exchange, refresh, revoke),
`app/models/member_session.py`, migration `0055_member_sessions_rate_limits`, and edits in
`app/services/members.py`, `admin_members.py`, `recordings.py` (`is_team_member`), `local_auth.py`,
`password_reset.py`, `recording_storage.py`, `author_profiles.py`, `app/config.py`.
Mobile: `lib/memberSession.ts`, `lib/memberAuth.ts`, `lib/client.ts`, `lib/session.ts`, `lib/localAuth.ts`,
provider sign-in files, `components/member/MemberSessionSync.tsx`, `plugins/withOfflineBackupExclusion.js`.
Web and deploy: `apps/web/lib/runtime-env.ts` and the routes that forward to the API,
`infra/azure/deploy-app.sh`, `infra/azure/sync-swa-app-settings.sh`, `.github/workflows/deploy.yml`.

## 5. Settings (names only, values go in the secret stores)

| Name | Where | What |
|---|---|---|
| `MEMBER_SESSION_SECRET` | API | Signs access tokens. At least 32 random characters. Not set means tokens are off. |
| `MEMBER_SESSION_SECRET_PREVIOUS` | API | Old secret during a rotation, so live tokens keep working for up to an hour. |
| `WEB_PROXY_KEY` | API and website | The website's own key. Never in a mobile build. |
| `ALLOW_LEGACY_MEMBER_PRINCIPAL` | API | Default `true`. `false` ends the old shared key for members. |
| `LEGACY_PRINCIPAL_UNTIL` | API | Optional date `YYYY-MM-DD`, the last day the old shared key works; the day after it is refused, as with `false`. No default. Recommended `2027-01-31` (`docs/decisions-security.md`). |
| `COPYRIGHT_CONTACT_EMAIL` | API | Where rights holders write (default `info@anandamarga.org`), used in the takedown letters. |
| `LEGACY_PRINCIPAL_ADMIN` | API | Emergency switch, default `false`. `true` gives the shared key its old powers back. |
| `GOOGLE_OAUTH_CLIENT_IDS` | API | Comma list of the Google client ids our apps use (web, iOS, Android). |
| `APPLE_BUNDLE_IDS` | API | Default `net.prabhatasamgiita.ai`. |
| `AZURE_CLIENT_IDS` | API | Microsoft app (client) ids. |
| `MEMBER_TRUSTED_MS_TENANTS` | API | Optional: Microsoft tenants whose e-mail counts as verified. |
| `MEMBER_ACCESS_TTL_SECONDS`, `MEMBER_REFRESH_TTL_DAYS` | API | Optional, defaults 3600 and 30. |

`.env.example` lists the names without values. `EXPO_PUBLIC_MEMBER_PROXY_KEY` in the mobile build is now
optional: leave it empty in the release that ships the tokens.

## 6. Rollout order (do not skip)

1. Create `MEMBER_SESSION_SECRET` and `WEB_PROXY_KEY` as secrets and fill the client id settings.
2. **Deploy the website first.** It sends both headers; the old API ignores the new one.
3. **Deploy the API** (migration 0055 runs). Check the website sign-in and the admin pages.
4. **Release the app.** New builds sign in through the exchange. Old builds keep working as ordinary members.
5. **Team members sign out and in once** after the app update. Until they do, their phones act as ordinary
   members. The website needs nothing.
6. Watch `legacy_hits` in the logs. When old versions have faded out (or the forced update from
   `docs/forced-update.md` has pushed them), set `ALLOW_LEGACY_MEMBER_PRINCIPAL=false` and **rotate**
   `MEMBER_PROXY_KEY` and `MOBILE_MEMBER_PROXY_KEY`.

Rollback: unset `MEMBER_SESSION_SECRET` (tokens off), or set `LEGACY_PRINCIPAL_ADMIN=true` for the old behaviour
of the shared key. Both are settings, not code.

## 7. Revoking access

- One device: `POST /api/v1/members/session/revoke`. All devices: the same with `all_devices: true`.
- An admin removing a member or a flag takes effect on the next request (roles come from the database).
- A leaked signing secret: set a new `MEMBER_SESSION_SECRET` (move the old one to `..._PREVIOUS` for a soft
  switch, or drop it for a hard one: everyone refreshes or signs in again).
- A stolen phone: the person signs in elsewhere and revokes all devices; or an admin deletes the sessions rows.

## 8. Tests

`tests/test_member_session_auth.py` covers a forged signature, `alg: none`, a token for a foreign user id, an
expired token, a role taken away between requests, the legacy key refused as admin and as team, refresh
rotation, a copied refresh token ending the session, revoke and a password reset. `tests/test_provider_exchange.py`
covers each provider's proof (wrong audience, wrong issuer, expired, wrong key, algorithm confusion, unverified
e-mail). `tests/test_member_auth_known_weakness.py` was rewritten on purpose and now asserts that the shared
key stays a plain member. Mobile: `__tests__/memberSession.test.ts`. Web: `tests/proxy-key-headers.test.ts`.

## 9. What is still open

- **E-mail and password accounts are not e-mail verified.** They can use the app, but they never get
  promotion by e-mail. Verifying the address by a link is a separate piece of work.
- **Microsoft e-mail** is treated as unverified unless the tenant is listed or the token says so.
- **The deploy-smoke name trick still exists** for the website key (the deploy script uses it). A dedicated
  smoke token would remove it; not done here.
- **Team members must sign in again once** after the release.
- **Not checked without production:** the real Google, Apple and Microsoft verification (tests use
  generated keys), the number of proxy hops for the client IP in Azure ingress (`RATE_LIMIT_TRUSTED_PROXY_HOPS`),
  secure storage on devices, and the whole flow on a store build.

## 10. DECISIONS for the owner

- **Facebook: decided 9 November 2026, dropped.** Only Apple, Google and e-mail (Microsoft stays optional).
- **Client ids and tenants:** created by the owner, steps in `docs/sign-in-setup.md`. Secrets never go in a chat.
- **Cut-off date** for the legacy key: decided, `2027-01-31` after the forced update (`docs/decisions-security.md`).
