# Sign-in setup: Google, Apple, e-mail

What the owner has to create outside the code, step by step, where each value goes, and what must never be
pasted into a chat. Decision of Dada (8 and 9 November 2026): sign-in is **Apple, Google and e-mail with a
password**. Facebook login is gone. Microsoft sign-in still exists in the code and is optional.

How the code uses the values is in `docs/security-member-auth.md`. Android-specific Google details are in
`docs/android-google-signin.md`.

## 1. Read this first: public values and secrets

| Kind | Examples | Rule |
|---|---|---|
| **Public identifiers** | Google client IDs (`...apps.googleusercontent.com`), the Apple bundle ID `net.prabhatasamgiita.ai`, an Apple Services ID, a Key ID, the Team ID | Not secret. They are already inside the app. Safe to write in a chat or a document when needed. |
| **Secrets** | Google client **secret**, the Apple **private key** file (`AuthKey_XXXX.p8`) and its text, `MEMBER_SESSION_SECRET`, `WEB_PROXY_KEY`, any password, token, or `.env` file | Never in a chat, an e-mail, a screenshot, a commit, or a document in the repository. They go only into the server's secret store. |

### NEVER paste into a chat (with an assistant, a developer, or anyone)

- the **text or the file** of an Apple `.p8` key (it starts with `-----BEGIN PRIVATE KEY-----`);
- a Google **client secret** (the string next to "Client secret" on the credentials page), or a downloaded
  `client_secret_....json` file;
- `MEMBER_SESSION_SECRET`, `WEB_PROXY_KEY`, `MEMBER_PROXY_KEY` or any "key", "secret", "token" or "password" of
  the server, Azure, EAS, GitHub, Apple, Google or Expo;
- a full `.env` file, or a screenshot of a page that shows a secret (hide it first);
- your Apple or Google account password, or a one-time code.

What you may send instead: the **name** of the setting, whether it is set ("yes, set"), and public identifiers.
If a secret was pasted by mistake: treat it as leaked, create a new one, delete the old one, and set the new one
in the server (the old one stops working at once).

The assistant will not ask for any of these and will not create accounts or keys for you.

## 2. What is needed, in one table

| Needed | Who creates it | Where it goes | Read by |
|---|---|---|---|
| Google OAuth client IDs: web, iOS, Android | Dada, Google Cloud Console | server `GOOGLE_OAUTH_CLIENT_IDS` (comma list of all that your apps use) and the app build (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `..._IOS_...`, `..._ANDROID_...`) | server and app |
| Apple "Sign in with Apple" capability on the app's ID | Dada, Apple Developer | switched on once for `net.prabhatasamgiita.ai` | the iOS build |
| Apple bundle ID(s) the server accepts | already known | server `APPLE_BUNDLE_IDS` (default `net.prabhatasamgiita.ai`) | server |
| Apple **Services ID** and Apple **key** (`.p8`, Key ID, Team ID) | Dada, Apple Developer | server secret store, **not yet read by any code** (see section 5) | not yet |
| Session signing secret | Dada generates 32+ random characters | server `MEMBER_SESSION_SECRET` (secret store) | server |
| Microsoft (optional) | already created | server `AZURE_CLIENT_IDS` | server |

## 3. Google Cloud Console

Account: the Google account that owns the Google Cloud project. The project number in the existing client IDs is
`495992354696`, so a project already exists. **First look at what is there; create only what is missing.**

1. Open https://console.cloud.google.com/ and choose the project (the one whose number is `495992354696`).
2. Menu "APIs & Services", then "Credentials". You should see three "OAuth 2.0 Client IDs": a **Web** one, an
   **iOS** one and an **Android** one. If all three exist and their IDs match `apps/mobile/eas.json`, skip to
   step 8.
3. "OAuth consent screen" (called "Google Auth Platform" in newer consoles): app name, support e-mail, the privacy
   page `https://www.prabhatasamgiita.org/privacy`. Publishing status must be **In production**, otherwise only
   test users can sign in.
4. **Web client**: "Create credentials", "OAuth client ID", type "Web application". Add the website's address as
   an authorized origin and its sign-in callback as a redirect URI (the same ones the website uses today).
   Its ID is `EXPO_PUBLIC_GOOGLE_CLIENT_ID` in the app (it is the "web client" that native Google sign-in needs)
   and the website's `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. The **client secret** shown next to it is a secret: only
   for the website's server settings (`GOOGLE_CLIENT_SECRET`), never in the app, never in a chat.
5. **iOS client**: type "iOS", bundle ID `net.prabhatasamgiita.ai`. No secret exists for this type. Its ID is
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. The build turns it into the URL scheme automatically
   (`apps/mobile/app.config.js`).
6. **Android client**: type "Android", package name `net.prabhatasamgiita.ai`, and the **SHA-1 fingerprint**. Which
   fingerprint matters: for installs from Google Play it is the **app signing key** of Play App Signing
   (Play Console, "App integrity", "App signing", "SHA-1 certificate fingerprint"). Add the EAS key's SHA-1 as a
   second Android client for internal test builds (`eas credentials`). Details and the failure symptoms:
   `docs/android-google-signin.md`. A fingerprint is public, not a secret.
7. Copy the three IDs (they are public). Put them in the app build settings (section 6) and in one server setting
   (section 4).
8. Check: each ID ends with `.apps.googleusercontent.com`.

## 4. Server settings (where the API runs)

The server **reads the IDs from its environment** and checks every Google or Apple sign-in against them. If a
setting is missing, that provider's sign-in answers a clear error (HTTP 503 "<Provider> sign-in is not set up
on this server yet") and the server log names the missing setting. Nothing falls back to a guess.

| Setting | Value | Secret? |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_IDS` | the web, iOS and Android client IDs, separated by commas, no spaces | no |
| `APPLE_BUNDLE_IDS` | `net.prabhatasamgiita.ai` (default); more bundle IDs, separated by commas | no |
| `AZURE_CLIENT_IDS` | Microsoft application IDs (optional; Microsoft sign-in is off without it) | no |
| `MEMBER_SESSION_SECRET` | 32+ random characters | **yes** |
| `LEGACY_PRINCIPAL_UNTIL` | the date the old shared key stops, `YYYY-MM-DD` (see `docs/decisions-security.md`) | no |

How to set them: in the place where the other server settings already live (Azure Container Apps for the API;
secrets as Container Apps secrets referenced by name, as `MEMBER_SESSION_SECRET` already is in
`infra/azure/deploy-app.sh`). `az containerapp update --set-env-vars NAME=value` keeps the variables that are
already there. **Important:** `infra/azure/deploy-app.sh` and `.github/workflows/deploy.yml` do not pass
`GOOGLE_OAUTH_CLIENT_IDS`, `APPLE_BUNDLE_IDS` or `AZURE_CLIENT_IDS` today. They must be set on the Container App
once by hand or those scripts must be extended by the team; a deploy does not remove them. (Not changed here:
deploy files belong to the team.)

Check that they are in place, without printing any value:

```
cd apps/api
python scripts/check_sign_in_setup.py
```

It prints `OK` or `MISSING` for each setting and exits with 1 when something is missing. Run it where the server
runs (same environment variables). A missing setting also appears in the API log at the first sign-in attempt.

## 5. Apple Developer

Account: the paid Apple Developer Program account that owns the app. Sign in at https://developer.apple.com/account.

1. "Certificates, Identifiers & Profiles", "Identifiers", open the App ID `net.prabhatasamgiita.ai`.
2. Tick the capability **Sign in with Apple** and save. (The Expo config already declares `usesAppleSignIn`; the
   capability must also be on in the Apple account, or sign-in fails on a device.)
3. **What the server needs for the native iPhone flow: only the bundle ID**, which is `APPLE_BUNDLE_IDS`. Apple's
   signed token carries the bundle ID as its audience, and the server checks the signature with Apple's public
   keys. No secret is needed for this.
4. **Services ID** (decision of 9 November: create it): "Identifiers", plus, "Services IDs". Description "Prabhat
   Samgiita AI sign-in", identifier for example `net.prabhatasamgiita.ai.signin`. Save, open it, tick "Sign in
   with Apple", "Configure", choose the app ID as the primary one, add the website domain and the return URL the
   website will use. A Services ID is a public identifier.
5. **Key**: "Keys", plus. Name "Sign in with Apple", tick "Sign in with Apple", configure it for the app ID,
   Continue, Register. **Download the `.p8` file now: Apple shows it only once.** Write down the **Key ID**
   (10 characters, public) and your **Team ID** (top right of the account, public).
6. Keep the `.p8` file in a password manager or the server's secret store. **Never paste its text anywhere.**

What each Apple item is for, plainly:

- The **Services ID** is the identity of a *web* or *Android* "Sign in with Apple". The app signs in on iPhone
  without it.
- The **key** is used to make a short-lived proof that the server is allowed to talk to Apple. Apple requires a
  server to use it to **revoke the person's Apple token when the account is deleted** (App Store Review
  Guideline 5.1.1(v); check the live wording before submitting).
- **Honest status:** the code does not read the Services ID or the key yet and does not call Apple's revoke
  endpoint. Account deletion removes the account on our side only. Building the revoke needs the app to send
  Apple's authorization code at sign-in and new server settings (names proposed:
  `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_SERVICES_ID`). It is **not built**, so creating
  the key now only prepares it. Without it, ask Apple's review about it before the first submission.

## 6. App build settings (EAS)

Public IDs go into the build environment (`apps/mobile/eas.json` already holds the current ones, or EAS
environment variables):

- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (web client), `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_AZURE_CLIENT_ID`, `EXPO_PUBLIC_AZURE_TENANT_ID` (Microsoft, optional)

`EXPO_PUBLIC_*` values are readable by anybody who unpacks the app, so **never put a secret in one**.
`EXPO_PUBLIC_MEMBER_PROXY_KEY` stays empty in new builds.

Without a Google ID the Google button is hidden or the sign-in answers a configuration error; Apple's button is
shown on iOS where the capability exists.

## 7. E-mail and password

Nothing to create in Google or Apple. It works with the server alone. E-mail and password accounts are not
e-mail-verified (`docs/security-member-auth.md`, section 9).

## 8. Order of work

1. Generate `MEMBER_SESSION_SECRET` and set it as a secret (do not write it anywhere else).
2. Google: check or create the three clients; set `GOOGLE_OAUTH_CLIENT_IDS` on the server.
3. Apple: switch on the capability; confirm `APPLE_BUNDLE_IDS`; create the Services ID and the key (store the
   key in the secret store).
4. Run `python scripts/check_sign_in_setup.py` where the server runs. Everything should say OK.
5. Build the app; sign in with each method on a real phone (not tested by this repository: the tests use
   generated keys).

## 9. What was not verified

- Nothing here was run against real Google or Apple accounts. The steps follow the stores' own console layouts as
  they were known; menu names change, follow the labels you see.
- The real verification of Google and Apple tokens (the server asks the providers' key lists) is covered by tests
  only with generated keys.
- That the Container App already has the three settings: check with the script.

## 10. Facebook

Removed from the phone, the API, the tests and these docs. `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are no
longer read; delete them from the server if they are set. Accounts that were made through Facebook stay in the
database and keep working until their session ends (30 days without use); after that the person signs in with
Google, Apple or e-mail. An unverified e-mail never merges accounts, so a person who comes back with another method
may get a new account; an admin can re-point the old account by hand if the person asks.
