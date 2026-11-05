# App Links (Android) and Universal Links (iOS)

Song pages on `https://www.prabhatasamgiita.org/songs/...` should open the app when it is installed.
The app side is already configured (`apps/mobile/app.config.js` intent filter with `autoVerify: true` for
`www.prabhatasamgiita.org` and `prabhatasamgiita.org`; `associatedDomains` in `app.json`). The website must
publish two files. Both live in `apps/web/public/.well-known/`.

## iOS: `apple-app-site-association`

Ready. App id `2665NAM545.net.prabhatasamgiita.ai`, paths `/songs` and `/songs/*`. Served as `application/json`
(headers in `next.config.mjs` and `staticwebapp.config.json`). Nothing to do except confirm after the next web
deploy: `curl -sI https://www.prabhatasamgiita.org/.well-known/apple-app-site-association` returns 200 and
JSON, with no redirect.

## Android: `assetlinks.json` (needs Dada)

The file currently holds a placeholder: `REPLACE_WITH_PLAY_APP_SIGNING_SHA256 (see docs/app-links.md)`.
Until it is replaced Android cannot verify the links; links open in the browser (the app still works).

Dada must provide the **SHA-256** of the key Google Play signs the app with:

1. Play Console, the app, **Test and release, Setup, App signing**.
2. Copy **SHA-256 certificate fingerprint** under "App signing key certificate" (format `AA:BB:...`, 32 bytes).
   If a second signing key is shown, copy its SHA-256 as well.
3. Optional: the EAS build key SHA-256 (`eas credentials`) if internal APKs should also verify.
4. Replace the placeholder with those values (several strings are allowed in the array), keep the package
   name `net.prabhatasamgiita.ai`, deploy the web app.
5. Both hosts must serve the file: `https://www.prabhatasamgiita.org/.well-known/assetlinks.json` and
   `https://prabhatasamgiita.org/.well-known/assetlinks.json` (the apex has an intent filter too; either
   serve the file there or remove the apex filter).
6. Check: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.prabhatasamgiita.org&relation=delegate_permission/common.handle_all_urls`
   lists the package. On a device after install: `adb shell pm get-app-links net.prabhatasamgiita.ai`
   shows `verified`.

`apps/mobile/__tests__/appLinksFiles.test.ts` fails if the package name drifts or a fingerprint is neither a
real SHA-256 nor a `REPLACE_WITH_` placeholder.
