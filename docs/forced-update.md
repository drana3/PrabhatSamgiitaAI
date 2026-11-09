# Forced and recommended app updates

Why it exists: when a leaked key, a broken release or a security fix makes old app versions unsafe, the team needs
a way to say "this version must update". Without it the only choice is to leave the hole open for months
(`docs/incident-response.md`, `docs/security-member-auth.md` step 6).

## How it works

1. At launch, and each time the app comes back to the front (at most once a minute), the app asks the API:
   `GET /api/v1/app/version-status?platform=ios&version=2.0.0`. No sign-in is needed.
2. The server compares the version with the limits for that platform and answers one of three things:
   - **ok**: nothing is shown.
   - **recommended**: the version is below the *recommended* version but not below the *minimum*. A thin banner
     at the top says "A new version of the app is ready" with **Update** and **Not now**. Not now hides it until
     the server recommends a newer version.
   - **required**: the version is below the *minimum*. A full-screen page "Please update the app" with one button
     to the store covers everything. Nothing underneath can be reached. Texts: English, Russian, Spanish
     (`apps/mobile/locales/appUpdate.ts`; Russian and Spanish are in `review.json` as not yet read by a native
     speaker).
3. The button opens the store link, looked up in this order:
   1. the link the team saved on the server (`store_url` below);
   2. Android: the Google Play page of the package `net.prabhatasamgiita.ai`;
   3. iOS: the link the build was given in `EXPO_PUBLIC_IOS_APP_STORE_URL`
      (`https://apps.apple.com/app/id<number>`, set in the EAS build environment, see below).
   With none of these on iOS there is no button, and the page says "Open the App Store and look for the app".
   No App Store id is guessed anywhere in the update code. **Set a store link before the first forced
   update.**

## Rules that stop it from locking people out by mistake

- A network error, a server error or an unreadable answer means **ok**. The app is never blocked because the
  server was unreachable.
- Exception: if the last good answer **for this exact app version** was "required", the stop stays even offline
  (otherwise turning on flight mode would bypass it). The saved answer is dropped as soon as the app is updated,
  and the server lifting the minimum lifts the stop at the next check.
- An unknown platform (web), a missing or unreadable version, or a platform with no row all mean **ok**.
- Only `https` links to apps.apple.com, itunes.apple.com, play.google.com or market.android.com are accepted, by
  the server when the team saves them and again by the app before it opens one.
- The team cannot save a recommended version lower than the minimum, or a malformed version.
- Version numbers compare part by part (`2.10.0` is above `2.9.0`; `2.1` equals `2.1.0`). A pre-release suffix
  (`2.2.0-beta.1`) counts as `2.2.0`.
- Preview builds (`MOCKUP_DATA`) and builds with `EXPO_PUBLIC_UPDATE_CHECK=off` never ask.

## How the team sets it

Needs an administrator account (signed in through the app or the website; the old shared key cannot do this).

```
PUT /api/v1/admin/app-versions/ios
{ "minimum_version": "2.1.0", "recommended_version": "2.2.0",
  "store_url": "https://apps.apple.com/app/id<your id>", "note": "why, for the team" }

PUT /api/v1/admin/app-versions/android      (same shape)
GET /api/v1/admin/app-versions              (what is set now)
```

Sending empty values lifts the limit. Changes show up within about two minutes (the answer is cached for 60
seconds and the app asks at most once a minute).

There is no admin screen yet. Until there is, use the API (the website admin's browser tools, or curl with a
signed-in admin token).

### The App Store link for iOS builds

The App Store id exists only after the app is created in App Store Connect (App Information, "Apple ID",
a number). Dada creates it; it is not a secret. Two ways to hand it over, either is enough:

- on the server: `PUT /api/v1/admin/app-versions/ios` with `"store_url": "https://apps.apple.com/app/id<number>"`.
  Works for every installed version that already has the update check, with no new build. Preferred.
- in the build: EAS environment variable `EXPO_PUBLIC_IOS_APP_STORE_URL` with the same address. It is read when
  the build is made, so only builds made after setting it have it. It is the fallback when the server has no
  link.

Only https links to apps.apple.com / itunes.apple.com / play.google.com / market.android.com are accepted;
anything else is dropped and the button is not shown.

Note: `apps/mobile/lib/webLinks.ts` and `apps/web/lib/mobile-stores.ts` (the team's files) hold an older
App Store address with id 6802943117 for the share pages. Nobody checked that this id is the real one, and
the update code does not use it. Compare it with the Apple ID in App Store Connect.

### Release checklist

1. Ship the new build to the stores and wait until **both stores really serve it** (reviews finish at different
   times).
2. Set `recommended_version` to the new version first and watch for a few days.
3. Only when the old versions must go (security): set `minimum_version`. **Never raise the minimum above a
   version that is not yet live in that store**: people would be stopped with nothing to install.
4. When the legacy sign-in key is switched off (`ALLOW_LEGACY_MEMBER_PRINCIPAL=false`), old apps already get a
   401 "This app version can no longer sign in. Please update." Raise the minimum first so they see the update
   page instead of an error.

## Limits

- It only works for versions that already contain this feature. Builds from before it never ask, so they can
  only be moved by the legacy key being switched off. Ship this feature early.
- iOS needs the App Store address, from `store_url` or `EXPO_PUBLIC_IOS_APP_STORE_URL`.
- Not verified without a real build in both stores: the store links, and the screen on a device.

## Where the code is

API: `app/models/app_version.py`, `app/services/app_versions.py`, `app/api/v1/app_versions.py`, migration
`0056_app_version_policies`, tests `tests/test_app_versions.py`.
App: `lib/appUpdate/policy.ts` (rules), `lib/appUpdate/index.ts` (wiring), `components/update/UpdateGate.tsx`
(screen and banner, mounted in `app/_layout.tsx`), `locales/appUpdate.ts`, tests `__tests__/appUpdate.test.ts`.
