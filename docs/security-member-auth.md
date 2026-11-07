# Member authentication: the shared key in the app bundle

Status: **open security issue, not fixed in code on purpose.** Changing it changes the auth protocol between the
app, the website and the API, and it has to be deployed in a set order. The decisions that belong to the owner
are marked **DECISION**.

## 1. How it works today

1. The member signs in on the phone with Google, Apple, Microsoft, Facebook or email. The native SDK returns a
   profile (id, email, name). The app keeps only that profile (`stores/authStore.ts`); the provider's ID token
   is thrown away.
2. For every member call the app builds its own header (`apps/mobile/lib/principal.ts`):
   `X-MS-CLIENT-PRINCIPAL` is base64 JSON in the Azure Easy Auth shape (`auth_typ`, claims `oid`, `email`,
   `name`), plus `X-Member-Proxy-Key: <MEMBER_PROXY_KEY>`.
3. The API (`apps/api/app/services/members.py`, `require_member_identity` and `try_member_identity`) compares
   the key in constant time and then **trusts the principal as given**: subject `provider:oid`, email, name.
   `sync_member` finds or creates the account for that subject.
4. The key reaches the phone as `EXPO_PUBLIC_MEMBER_PROXY_KEY` (CI secret `MOBILE_MEMBER_PROXY_KEY`), so it is
   inside the JavaScript bundle of every installed app. The website uses the same variable name server side
   (`MEMBER_PROXY_KEY`, with `MOBILE_MEMBER_PROXY_KEY` as the deploy fallback) and forwards a principal that
   Azure Easy Auth really verified. That web path is sound; the mobile path is the problem.

## 2. The attack

Anyone can read the key from the installed app (unzip the APK/IPA, search the bundle for the string; it takes
minutes and no root). Then, with `curl`:

- **Impersonate any member.** Send the key and a principal with the victim's `oid`/email. The API treats the
  caller as the victim: read their saved songs, chat memory and quiz data, change their profile and phone,
  **delete their account** (`DELETE /api/v1/members/me`).
- **Become admin.** `apply_default_admin` grants admin to any account whose email is in `DEFAULT_ADMIN_EMAILS`
  or `PROTECTED_ADMIN_EMAILS`. A principal that claims an owner email becomes admin: member list, e-mail
  announcements, feedback, content admin routes.
- **Become admin without knowing any email.** `ensure_ephemeral_smoke_admin` makes admin any identity whose
  subject or name contains `deploy-smoke`, `admin-diag`, `feedback-diag`, `quiz-diag` or `member-diag`. The
  deploy script (`infra/azure/deploy-app.sh`) uses this on purpose; it is equally open to anyone with the key.
- **Forge signed media links.** `RecordingStorage` falls back to `MEMBER_PROXY_KEY` as its signing secret when
  `RECORDING_SIGNING_SECRET` is not set (`services/recording_storage.py`). If production relies on that
  fallback, the key also signs recording URLs.
- Rotating the key does not help by itself: the new app build contains the new key again.

`apps/api/tests/test_member_auth_known_weakness.py` pins the first three behaviours so they cannot change
silently. When the fix lands those tests must be rewritten deliberately.

## 3. What was done now (no protocol change)

- The weakness is pinned by tests (above) and described here.
- The mobile client no longer persists or keeps a stale admin flag (`isAdmin` is not written to storage and is
  dropped when the server does not confirm the member). That removes a local tampering path but **does not
  close the server hole**: the server still decides admin from the forged principal.
- Nothing else is changed, because every server-side restriction that would help (reject smoke names,
  stop email based admin, drop the signing fallback) either breaks the deploy smoke test, the mobile admin
  panel or recordings in production until the new flow exists.

## 4. Proposed fix

Replace "trust a self-made principal" with a **server-issued, signed, short-lived session token**. The shared
key leaves the bundle.

1. **Prove identity once.** After sign-in the app sends the provider's ID token (Google, Apple, Microsoft,
   Facebook access token) to a new endpoint `POST /api/v1/members/session`, over HTTPS.
2. **Verify on the server.** The API checks the token's signature against the provider's public keys (JWKS),
   `iss`, `aud` (the app's client ids: Google web/iOS/Android, Apple bundle id, Azure client id), `exp`, and for
   Apple the nonce. Email accounts keep using the existing `local` login (password check already server side).
3. **Issue a token.** The API returns a signed token (JWT HS256 or EdDSA with a server-only secret
   `MEMBER_SESSION_SECRET`): `sub = provider:subject`, `exp` about 1 hour, plus a longer refresh token
   (30 days, rotated, stored hashed, revocable per device). The token contains no admin flag.
4. **Use it.** The app sends `Authorization: Bearer <session token>` instead of the principal and key.
   `require_member_identity` verifies the signature and expiry and builds `MemberIdentity` from the token.
5. **Admin from the database only.** `is_admin` is read from the account row. Email-based auto promotion
   stays, but only for identities whose email the provider verified (`email_verified` in the ID token).
6. **Web stays as is.** The website keeps key + Easy Auth principal, but with its **own** key
   (`WEB_PROXY_KEY`) that never ships to a phone. The old `MEMBER_PROXY_KEY` becomes the web-only key.
7. **Smoke test.** Replace the `deploy-smoke` name trick with a separate `SMOKE_ADMIN_TOKEN` secret checked in
   the deploy script path only (or a signed token with a `smoke` scope), then delete
   `ensure_ephemeral_smoke_admin`.
8. **Recordings.** Require `RECORDING_SIGNING_SECRET` in production and remove the fallback to the proxy key.

## 5. Migration (no big bang)

1. **API, additive.** Ship the new endpoint and Bearer support next to the old header path. Add the
   settings `MEMBER_SESSION_SECRET`, `WEB_PROXY_KEY`, and a switch `ALLOW_LEGACY_MEMBER_PRINCIPAL` (default
   `true`). Nothing changes for existing apps.
2. **Web.** Move the website to `WEB_PROXY_KEY`. Deploy and check sign-in and admin on the site.
3. **App release.** Ship an app version that signs in through the new endpoint and sends Bearer tokens, with
   the old path as fallback only when the endpoint is unreachable. Remove `EXPO_PUBLIC_MEMBER_PROXY_KEY` from
   the build in this release.
4. **Wait for adoption.** Check API logs for the share of requests that still use the legacy path
   (add a counter in step 1). Force the update for old versions with the existing minimum-version mechanism if
   there is one, or a notice in the app.
5. **Close.** Set `ALLOW_LEGACY_MEMBER_PRINCIPAL=false` for the mobile key (the old key stops working for
   members), rotate `MEMBER_PROXY_KEY`, remove the smoke trick and the signing fallback.

Rollback at every step: the legacy switch stays available until step 5.

## 6. API changes

- New: `POST /api/v1/members/session` (body: provider, id token, nonce; returns token, refresh token,
  expiry), `POST /api/v1/members/session/refresh`, `POST /api/v1/members/session/revoke`.
- Changed: `require_member_identity` and `try_member_identity` accept `Authorization: Bearer`.
- New settings: `MEMBER_SESSION_SECRET`, `WEB_PROXY_KEY`, `ALLOW_LEGACY_MEMBER_PRINCIPAL`,
  `SMOKE_ADMIN_TOKEN`; `RECORDING_SIGNING_SECRET` becomes mandatory in production.
- New table for refresh tokens (hashed, device label, last used, revoked at).
- Mobile: keep the provider ID token at sign-in, new `lib/memberSession.ts` (store tokens in
  `expo-secure-store`, refresh before expiry), replace `buildMemberAuthHeaders`. The `/ai/explain` call uses the
  same header.

## 7. Effort

- API: 3 to 4 days (JWKS verification for four providers with tests, token issue/refresh/revoke, table,
  config, legacy switch, counters).
- Mobile: 2 days plus a store release cycle (sign-in flows return tokens, secure storage, refresh, tests).
- Web and deploy scripts: 1 day (own proxy key, smoke token).
- Rollout and watching adoption: calendar time, 2 to 4 weeks for old app versions to fade out.

## 8. Decisions for the owner

- **DECISION 1: go or no go.** Until it ships, assume a motivated person can read every member's data and
  administer the site. This is the most serious open item.
- **DECISION 2: stop-gap now?** Cheapest partial measures, each with a cost: (a) remove the smoke-name
  admin path (breaks the deploy smoke test until `SMOKE_ADMIN_TOKEN` exists); (b) turn off email based
  auto-admin for requests that come with the mobile key (breaks the mobile admin panel); (c) require
  `RECORDING_SIGNING_SECRET` (check production sets it first). Say which, if any.
- **DECISION 3: Facebook.** Facebook gives an access token, not a signed ID token; verifying it needs a call
  to Facebook's debug endpoint. Keep Facebook sign-in or drop it?
- **DECISION 4: forced update.** How strict to be with old app versions after the cut-over.
- **Secrets rotation** (console work, owner only): new `MEMBER_PROXY_KEY` and `MOBILE_MEMBER_PROXY_KEY` in the
  GitHub secrets and the Azure container app after step 5.

## 9. Related notes

- No tokens or passwords are stored on the phone, so `expo-secure-store` is not needed today. It becomes
  needed in step 3 for session tokens.
- Android `allowBackup` stays on (Learn progress and favorites are local-only and worth restoring). When
  session tokens exist, exclude their storage from backup (same mechanism as the offline audio exclusion in
  `plugins/withOfflineBackupExclusion.js`).
