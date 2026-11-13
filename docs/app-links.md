# App Links (Android) and Universal Links (iOS)

Song pages on `https://www.prabhatasamgiita.org/songs/...` should open the app when it is installed.
The app side is already configured (`apps/mobile/app.config.js`: an intent filter with `autoVerify: true` for
`www.prabhatasamgiita.org`, and a second, plain filter for `prabhatasamgiita.org`; `associatedDomains` in
`app.json`). The website must publish two files. Both live in `apps/web/public/.well-known/`.

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
5. Only `https://www.prabhatasamgiita.org/.well-known/assetlinks.json` has to work. The bare domain
   (`prabhatasamgiita.org`) has a plain, unverified filter, so it may stay silent; if it is ever made to serve the
   file as well, switch its filter in `app.config.js` back to `autoVerify: true`.
6. Check: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://www.prabhatasamgiita.org&relation=delegate_permission/common.handle_all_urls`
   lists the package. On a device after install: `adb shell pm get-app-links net.prabhatasamgiita.ai`
   shows `verified`.

`apps/mobile/__tests__/appLinksFiles.test.ts` fails if the package name drifts or a fingerprint is neither a
real SHA-256 nor a `REPLACE_WITH_` placeholder.

## Why Android links did not open the app (found 2026-11-09, read-only checks)

Four separate causes, in order of weight:

1. **No fingerprint was ever published.** The live `www` file lists the package but with an **empty**
   `sha256_cert_fingerprints` array. Android verifies the link by comparing the app's signing key with that list;
   an empty list never matches. (The repository holds a placeholder instead, so the file in the repository
   also cannot verify until Dada's SHA-256 is pasted in. Both need the value from Play Console, steps above.)
2. **The bare domain did not answer at all.** `https://prabhatasamgiita.org/.well-known/assetlinks.json` timed
   out after 8 seconds. On Android 11 and older, one host in a filter that fails verification can make the
   **whole filter** fail, including the working `www` host. Fix made in `app.config.js`: `www` has its own
   `autoVerify` filter; the bare domain is a separate filter without it. Needs a new EAS build to take effect.
   Separately, fix the apex DNS or redirect so a typed `prabhatasamgiita.org` reaches the site.
3. **The live site is older than the repository.** The live Apple file was last modified on 2026-10-27 and is
   served as `application/octet-stream`, although `next.config.mjs` and `staticwebapp.config.json` ask for
   `application/json`. Apple's current iOS tolerates a different type on a plain-HTTPS 200 response, but the
   safe state is JSON. After the next web deploy, check again; if the type is still `octet-stream`, the static
   file in `public/.well-known/` is being served by the platform without the header. Then delete the public copy so the Next route
   (`apps/web/app/.well-known/apple-app-site-association/route.ts`) answers instead.
4. **Play App Signing.** Google re-signs the app with its own key. The SHA-256 must be the **Play App Signing**
   key, not the upload key and not the key of a local build. An internal EAS APK uses yet another key; add that
   one as well for testing.

Quick read-only checks (any computer):

```bash
curl -s https://www.prabhatasamgiita.org/.well-known/assetlinks.json
curl -sI https://www.prabhatasamgiita.org/.well-known/apple-app-site-association | grep -i content-type
curl -s -m 8 -o /dev/null -w "%{http_code}\n" https://prabhatasamgiita.org/.well-known/assetlinks.json
```

## What to check on a phone after the next EAS build

Install the **store-signed** build (internal testing track), not a local debug build.

1. Wait a minute after install; Android verifies in the background.
2. `adb shell pm get-app-links net.prabhatasamgiita.ai` must show `www.prabhatasamgiita.org: verified`
   (the bare domain may show `none` or `1024`: expected).
3. `adb shell pm verify-app-links --re-verify net.prabhatasamgiita.ai` forces another attempt.
4. Open a song link from a chat app and from the browser address bar: the app should open on the song, with no
   chooser. On Android 12 and newer, Settings, Apps, the app, Open by default, shows the supported links.
5. iPhone: paste a song link into Notes and tap it: it should open the app. If it opens Safari, long-press the
   link and look for "Open in Prabhat Samgiita AI". Also confirm the Apple file is reachable (curl above) and
   that the Associated Domains capability is in the provisioning profile.
6. If a link only opens the browser, it is almost always (1) or (4).

The code side is tested: `apps/mobile/__tests__/appLinksFiles.test.ts` (package name, fingerprint format, www
filter verified and bare-domain filter not).
