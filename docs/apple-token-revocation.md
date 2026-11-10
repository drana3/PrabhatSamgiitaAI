# Apple: revoke "Sign in with Apple" when the account is deleted

App Store rule 5.1.1(v): an app that offers account creation must let the person delete the account, and for Sign in with Apple
the app must also **revoke the Apple token** so the app disappears from Settings > Apple ID > Sign in with Apple. Written 2026-11-10.

## How it works

1. **Sign in.** `expo-apple-authentication` returns `identityToken` and a one-time `authorizationCode`. The app sends both to
   `POST /api/v1/members/session/exchange` (`authorization_code`, optional, Apple only).
2. **Server, at sign-in.** After the identity token is verified, `app/services/apple_revoke.py` trades the code at
   `https://appleid.apple.com/auth/token` (client_id + client_secret + code) for a **refresh token** and stores it in
   `apple_refresh_tokens` (migration `0069`). It is kept only if Apple's answer is for the same Apple user as the identity token.
   Any failure is logged and ignored; the sign-in still succeeds.
3. **Delete account** (`DELETE /api/v1/members/me`). The token is read before the account goes. After the account is deleted
   and committed, the server calls `https://appleid.apple.com/auth/revoke` with `client_id`, `client_secret`, `token` and
   `token_type_hint=refresh_token`. The token row goes with the account (`ON DELETE CASCADE`).
4. **Never blocks deletion.** Missing key, no stored token, an error answer, a timeout, an unreadable key: all are caught and
   logged by kind only (never the key, the secret, a token or Apple's answer) and the answer is still 204.

`client_id` is the first entry of `APPLE_BUNDLE_IDS`. `client_secret` is an ES256 JWT (iss = team id, sub = client id,
aud = `https://appleid.apple.com`, kid = key id, valid 10 minutes) signed with the Apple private key.

## Environment (API)

| Name | What | Secret |
|---|---|---|
| `APPLE_BUNDLE_IDS` | already used for sign-in; the **first** entry is the `client_id` | no |
| `APPLE_TEAM_ID` | the 10-character Apple Developer Team ID (the website file `apple-app-site-association` already shows it) | no |
| `APPLE_KEY_ID` | key id of a "Sign in with Apple" key | no |
| `APPLE_PRIVATE_KEY` | contents of the `.p8` file; one line with `\n` instead of line breaks is fine | **yes** |

All three of team, key id and key must be set, otherwise revocation is skipped (log: "apple revoke skipped"). Names are in
`.env.example`. The key never goes into the repository, a log or an answer (`repr=False` in `Settings`).

## What stays for the owner

1. In the Apple Developer account: Keys > create a key with **Sign in with Apple** enabled for the app's primary App ID; download
   the `.p8` once. Note the Key ID and the Team ID.
2. Put `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` into the API's environment (and not into git).
3. Run migration 0069 (`alembic upgrade head`) on a copy first. A server without the table still deletes accounts (the read
   runs in a savepoint and is ignored); it just has no token to revoke.
4. Ship an app build that contains the change (below). Until a person's phone runs it, their account has **no stored token**
   and deleting it only logs "apple revoke skipped: no stored token". Such a person can still remove the link by hand in
   Settings > Apple ID > Sign in with Apple. Accounts created with older builds will not have a token until the person signs in
   again with Apple on the new build (a sign-in stores one).
5. Test once for real on a device with a real Apple ID: sign in with Apple, delete the account, check Settings > Apple ID >
   Sign in with Apple no longer lists the app. Nothing here was run against Apple.

## What the mobile app sends (done)

`lib/appleAuth.ts` returns `authorizationCode` from `AppleAuthentication.signInAsync`; `lib/session.ts`
(`signInWithAppleAccount`) passes it in the proof; `lib/memberSession.ts` (`exchangeProviderProof`) sends it as
`authorization_code` for Apple only. It is never stored on the phone or logged.

## Tests (no network)

API `tests/test_apple_revoke.py` (client secret claims and signature, escaped key, revoke call fields, code exchange and the
"another Apple user" check, deletion with / without token / key, Apple failing, missing table),
`tests/test_apple_refresh_tokens_migration.py`; app `__tests__/ageConfirm.test.ts` (code in the request body),
`__tests__/appleAuth.test.ts`.
