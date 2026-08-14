# Mobile cloud builds — GitHub & Expo setup

EAS project: **dewasheesh3s-team / prabhatsamgiitaai**  
Project ID: `7cbd8dae-da81-4236-a7c2-c9c707540afe`

Android and iOS share the same `preview` env in `eas.json`: Microsoft, Google (native), member sync, API URLs.

## 1. GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Required | Purpose |
|--------|----------|---------|
| `EXPO_TOKEN` | **Yes** | [expo.dev access token](https://expo.dev/settings/access-tokens) from a user with access to **dewasheesh3s-team** |
| `EAS_PROJECT_ID` | Optional | `7cbd8dae-da81-4236-a7c2-c9c707540afe` (also hardcoded in the workflow) |
| `MOBILE_API_BASE_URL` | Optional | Overrides production API URL in CI builds |
| `MOBILE_WEB_BASE_URL` | Optional | Share links base URL |
| `MOBILE_MEMBER_PROXY_KEY` | **Yes** | Member sync (same as API `MEMBER_PROXY_KEY`) |
| `MOBILE_AZURE_CLIENT_ID` | **Yes** | Microsoft sign-in (both platforms) |
| `MOBILE_AZURE_TENANT_ID` | Optional | Defaults in `eas.json` if unset |
| `MOBILE_GOOGLE_CLIENT_ID` | **Yes** | Google **Web** client (native sign-in on Android + iOS) |
| `MOBILE_GOOGLE_IOS_CLIENT_ID` | **Yes** | Google iOS OAuth client |
| `MOBILE_GOOGLE_ANDROID_CLIENT_ID` | **Yes** | Google Android OAuth client (SHA-1) |

Public OAuth client IDs are also baked into `apps/mobile/eas.json` and `app.config.js`. GitHub secrets let CI override them.

`MOBILE_MEMBER_PROXY_KEY` is pushed to EAS automatically before each build (`scripts/sync-mobile-eas-env.sh` in CI). For a one-off local sync:

```bash
EXPO_TOKEN=... MOBILE_MEMBER_PROXY_KEY=... ./scripts/sync-mobile-eas-env.sh preview
```

Use **sensitive** visibility (not secret) so `EXPO_PUBLIC_MEMBER_PROXY_KEY` is embedded in the app bundle.

### One-shot from your machine (after `gh auth login`)

```bash
./scripts/sync-mobile-github-secrets.sh
```

This reads `apps/mobile/.env` and pushes matching values to GitHub secrets.

## 2. Google Sign-In (Android + iOS)

The app uses **native** `@react-native-google-signin/google-signin` (not browser OAuth).

| Platform | Google Cloud setup |
|----------|-------------------|
| **Web client** | `EXPO_PUBLIC_GOOGLE_CLIENT_ID` — required on both platforms |
| **Android** | OAuth client type Android · package `net.prabhatasamgiita.ai` · EAS keystore SHA-1 |
| **iOS** | OAuth client type iOS · bundle ID `net.prabhatasamgiita.ai` |

After first Android EAS build:

```bash
cd apps/mobile && eas credentials -p android
```

Add the keystore **SHA-1** to the Android OAuth client in Google Cloud.

## 3. Trigger a build

EAS dashboard: [dewasheesh3s-team / prabhatsamgiitaai](https://expo.dev/accounts/dewasheesh3s-team/projects/prabhatsamgiitaai)

### Preview (QA / sideload)

- **Automatic:** push to `main` under `apps/mobile/`
- **Manual:** Actions → **Mobile preview build** → **Run workflow**

Artifacts: Android `.apk` + iOS Simulator `.tar.gz` (same JS bundle and env as Android).

### iOS on a real iPhone (internal / TestFlight)

Simulator builds cannot be installed on a physical iPhone. For device parity with the Android APK:

```bash
cd apps/mobile && eas build --platform ios --profile preview-ios
```

Install from the EAS internal distribution link (requires Apple Developer).

### Release (store-ready)

- **Manual:** Actions → **Mobile release build** → **Run workflow**
- **Local:** `npm run mobile:build:release` (from repo root)

Artifacts: Android `.aab` (Play Store) + iOS `.ipa` (TestFlight / App Store)
