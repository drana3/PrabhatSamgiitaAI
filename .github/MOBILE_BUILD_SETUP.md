# Mobile cloud builds — GitHub & Expo setup

EAS project: **dewasheesh3s-team / prabhatsamgiitaai**  
Project ID: `7cbd8dae-da81-4236-a7c2-c9c707540afe`

## 1. GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Required | Purpose |
|--------|----------|---------|
| `EXPO_TOKEN` | **Yes** | [expo.dev access token](https://expo.dev/settings/access-tokens) from a user with access to **dewasheesh3s-team** |
| `EAS_PROJECT_ID` | Optional | `7cbd8dae-da81-4236-a7c2-c9c707540afe` (also hardcoded in the workflow) |
| `MOBILE_API_BASE_URL` | Optional | Overrides production API URL in CI builds |
| `MOBILE_WEB_BASE_URL` | Optional | Share links base URL |
| `MOBILE_MEMBER_PROXY_KEY` | Recommended | Member sync (same as API `MEMBER_PROXY_KEY`) |
| `MOBILE_AZURE_CLIENT_ID` | Recommended | Microsoft sign-in |
| `MOBILE_AZURE_TENANT_ID` | Optional | Defaults in `eas.json` if unset |
| `MOBILE_GOOGLE_IOS_CLIENT_ID` | Recommended | Google sign-in on iOS builds |
| `MOBILE_GOOGLE_ANDROID_CLIENT_ID` | Recommended | Google sign-in on Android builds |

**All four** (`MOBILE_AZURE_CLIENT_ID`, both Google IDs, `MOBILE_MEMBER_PROXY_KEY`) are required — mobile CI fails the build if any are missing.

GitHub secrets are **not** forwarded to EAS cloud workers. Microsoft/Google client IDs (public OAuth IDs) are also set in `apps/mobile/eas.json` and `app.config.js` so preview/production APKs actually show those buttons.

`MOBILE_MEMBER_PROXY_KEY` is pushed to EAS automatically before each build (`scripts/sync-mobile-eas-env.sh` in CI). For a one-off local sync:

```bash
EXPO_TOKEN=... MOBILE_MEMBER_PROXY_KEY=... ./scripts/sync-mobile-eas-env.sh preview
```

Use **sensitive** visibility (not secret) so `EXPO_PUBLIC_MEMBER_PROXY_KEY` is embedded in the app bundle for member sync and admin status.

### One-shot from your machine (after `gh auth login`)

```bash
./scripts/sync-mobile-github-secrets.sh
```

This reads `apps/mobile/.env` and pushes matching values to GitHub secrets.

## 2. Expo team environment variables (alternative to GitHub)

[expo.dev → dewasheesh3s-team → prabhatsamgiitaai → Environment variables](https://expo.dev/accounts/dewasheesh3s-team/projects/prabhatsamgiitaai/environment-variables)

Add the same `EXPO_PUBLIC_*` keys for environment **preview** (and **production** later).

CI passes GitHub secrets when set; otherwise `eas.json` defaults and Expo env vars apply.

## 3. Trigger a build

EAS dashboard: [dewasheesh3s-team / prabhatsamgiitaai](https://expo.dev/accounts/dewasheesh3s-team/projects/prabhatsamgiitaai)

### Preview (QA / sideload)

- **Automatic:** push to `main` under `apps/mobile/`
- **Manual:** Actions → **Mobile preview build** → **Run workflow**

Artifacts: Android `.apk` + iOS Simulator `.tar.gz`

### Release (store-ready)

- **Manual:** Actions → **Mobile release build** → **Run workflow**
- **Local:** `npm run mobile:build:release` (from repo root)

Artifacts: Android `.aab` (Play Store) + iOS `.ipa` (TestFlight / App Store)

## 4. After first Android team build

```bash
cd apps/mobile
eas credentials -p android
```

Add the EAS keystore **SHA-1** to Google Cloud → Android OAuth client (`net.prabhatasamgiita.ai`).
