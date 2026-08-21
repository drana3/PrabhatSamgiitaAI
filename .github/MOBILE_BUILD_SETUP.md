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
| `APPLE_ID` | Optional | Apple ID email for `eas submit` (local only; not used by CI today) |
| `APPLE_APP_STORE_CONNECT_APP_ID` | Optional | Numeric App Store Connect app ID (`ascAppId`) |
| `APPLE_TEAM_ID` | Optional | 10-character Apple Developer Team ID |

Public OAuth client IDs are also baked into `apps/mobile/eas.json` and `app.config.js`. GitHub secrets let CI override them.

Apple submit secrets are **not** wired into GitHub Actions yet — set them locally when running `eas submit`, or add an App Store Connect API key to `eas.json` (see §4).

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

### Play Store (AAB) — required extra SHA-1

APK sideloads and Play Store installs use **different signing certificates**.

| Build source | Certificate | SHA-1 (this project) |
|--------------|-------------|------------------------|
| EAS preview APK | Upload keystore | `29:36:BD:D1:9B:F2:C7:96:13:4C:13:CD:12:8D:E5:B8:21:B2:F7:9D` |
| Play Store (classical app signing) | App signing key | `0A:CD:27:EE:73:CC:3D:6B:BB:41:9A:F2:7D:45:64:07:67:0B:A6:75` |
| Play Store (post-quantum signing, beta) | Post-quantum app signing key | `27:C2:FB:E5:B3:9A:26:33:4D:35:98:3B:0E:4B:4D:B8:71:17:AE:06` |
| Play Store (previous / legacy classical) | Previous app signing keys | Copy from Play Console — required with Quantum-ready |

If Google Sign-In works on APK but fails on Play (`DEVELOPER_ERROR` / `invalid_request`):

1. Play Console → **App signing**
2. Copy **SHA-1** for **every** key shown: current classical, post-quantum, **and Previous app signing keys** (Quantum-ready uses multiple classical keys)
3. Google Cloud → **Credentials** → **Create credentials** → **OAuth client ID** → **Android** — **one new client per SHA-1**
4. Same package `net.prabhatasamgiita.ai` each time
5. No change to `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` — native sign-in uses the Web client ID; Google matches the install certificate automatically.

Do **not** add `prabhatai://` to the Web OAuth client — Google only allows `https://` redirect URIs there.

Save, wait ~5–10 minutes, uninstall the Play build, reinstall, retry.

### If every Play SHA-1 (including Previous) is already in Google Cloud

Check **OAuth consent screen** (Testing → add your Google account as a Test user, or publish to Production).

Optional hardening: Firebase + `google-services.json` (same GCP project `495992354696`, all SHA-1 fingerprints on the Android app). Rebuild only if you add that file.

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

After the release workflow finishes, follow **§4 (iOS)** or upload the Android `.aab` to Play Console.

---

## 4. iOS App Store / TestFlight (production)

**Status in repo:** EAS project, bundle ID, OAuth env, production build profile, and export-compliance flag are ready.  
**Blocker:** an active **Apple Developer Program** membership ($99/year). Without it, `eas device:create`, device builds, and App Store uploads fail with *“You are not registered as an Apple Developer.”*

Only **iOS Simulator** builds have run so far (`preview-ios-simulator`). No production `.ipa` exists yet.

### Known app identifiers

| Field | Value |
|-------|-------|
| App name | Prabhat Samgiita AI |
| Bundle ID | `net.prabhatasamgiita.ai` |
| URL scheme (OAuth) | `prabhatai://` |
| Marketing version | `1.0.0` (`apps/mobile/app.json` → `expo.version`) |
| iOS build number | `2` (`apps/mobile/app.json` → `expo.ios.buildNumber`) — **increment for every App Store / TestFlight upload** |
| EAS owner / slug | `dewasheesh3s-team` / `prabhatsamgiitaai` |
| Privacy policy | `https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io/privacy` |
| Delete account | `https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io/delete-account` |
| Support email | `anandamarga01@gmail.com` |
| App icon | `apps/mobile/assets/icon.png` (1024×1024 — App Store ready) |

### Step 1 — Enroll in Apple Developer Program

1. Sign in at [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/) with the Apple ID you will use for releases.
2. Pay **$99 USD / year** (Individual or Organization).
3. Wait for approval (usually 24–48 hours; can be same day).
4. Confirm access: [App Store Connect](https://appstoreconnect.apple.com/) opens without “pending enrollment” errors.

Use the **same Apple ID** on EAS when prompted for credentials.

### Step 2 — Register the bundle ID (Apple Developer)

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → **Identifiers** → **+**.
2. **App IDs** → **App** → Continue.
3. Description: `Prabhat Samgiita AI`
4. Bundle ID: **Explicit** → `net.prabhatasamgiita.ai`
5. Capabilities: defaults are fine (no Sign in with Apple required — app uses Google + Microsoft).
6. Register.

### Step 3 — Create the app in App Store Connect

1. [App Store Connect](https://appstoreconnect.apple.com/) → **Apps** → **+** → **New App**.
2. **Platforms:** iOS  
3. **Name:** `Prabhat Samgiita AI`  
4. **Primary language:** English (or your choice)  
5. **Bundle ID:** select `net.prabhatasamgiita.ai`  
6. **SKU:** e.g. `prabhatsamgiitaai` (internal only; cannot change later)  
7. **User Access:** Full Access  
8. Save.

Copy these for `eas submit`:

| What | Where to find it |
|------|------------------|
| **Apple ID** (email) | Your developer account login |
| **Team ID** (`APPLE_TEAM_ID`) | [Membership details](https://developer.apple.com/account#MembershipDetailsCard) → **Team ID** (10 chars) |
| **App Store Connect App ID** (`APPLE_APP_STORE_CONNECT_APP_ID`) | App → **App Information** → **Apple ID** (numeric, e.g. `6750123456`) |

### Step 4 — EAS iOS credentials (signing)

EAS creates the **Distribution certificate** and **App Store provisioning profile** on the first successful production iOS build.

```bash
cd apps/mobile
npx eas-cli login          # dewasheesh3 / team owner
npx eas-cli credentials -p ios
```

Choose **production** profile when asked. Let EAS manage credentials unless you already have org-specific signing policies.

Register a test device (optional, for `preview-ios` internal builds only):

```bash
npx eas-cli device:create
```

Requires Apple Developer enrollment. Not needed for TestFlight/App Store builds (`distribution: store`).

### Step 5 — Microsoft sign-in (Entra ID)

App registration **`prabhatai-members`** (client ID in `eas.json`):

| Setting | Value |
|---------|-------|
| Client ID | `14af4263-42b8-41fb-aac8-e730051a6864` |
| Tenant ID | `22cd8762-00e6-4945-850c-7b6ab1798844` |
| Redirect URI (Mobile/desktop) | `prabhatai://auth` |

Azure Portal → **Microsoft Entra ID** → **App registrations** → **prabhatai-members** → **Authentication** → **Add a platform** → **Mobile and desktop applications** → add `prabhatai://auth`.

No iOS-specific redirect is needed beyond the custom URL scheme (already merged in `app.config.js`).

### Step 6 — Google Sign-In (iOS)

Verify in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

| Client | Type | Key field |
|--------|------|-----------|
| Web | OAuth 2.0 Web | Client ID `495992354696-e0gs1mfnndgh9d38nkmp211f43im1h9q.apps.googleusercontent.com` |
| iOS | OAuth 2.0 iOS | Bundle ID `net.prabhatasamgiita.ai` · Client ID `495992354696-l5ddf29pefc5ke9f1t8osi9dch0qckrs.apps.googleusercontent.com` |

Repo wiring (already done):

- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` + `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in `eas.json` / `app.config.js`
- `@react-native-google-signin/google-signin` plugin with reversed URL scheme in `app.json`
- `CFBundleURLTypes` merged in `app.config.js`

Unlike Android, **no SHA-1** is required for iOS. iOS uses the **native Google SDK only** (no browser fallback — do not add `prabhatai://auth/google` to the Web OAuth client). Test Google sign-in on a TestFlight build after first upload.

### Step 7 — Production build

**GitHub Actions (recommended):**

Actions → **Mobile release build** → **Run workflow**  
Produces `prabhat-samgiita-ai-ios-release` (`.ipa`) artifact.

**Local:**

```bash
# From repo root
npm run mobile:build:release

# Or iOS only
cd apps/mobile && npx eas-cli build --platform ios --profile production --wait
```

First iOS production build may fail if Apple credentials are not set up — complete Step 4 interactively, then retry.

**Version bump before each store upload:**

```json
// apps/mobile/app.json
"ios": { "buildNumber": "2" }
```

Keep `expo.version` for user-visible releases; bump `buildNumber` for every binary uploaded to App Store Connect.

### Step 8 — Submit to TestFlight

**Option A — EAS Submit (uses `eas.json` placeholders):**

```bash
cd apps/mobile
export APPLE_ID="your-apple-id@email.com"
export APPLE_TEAM_ID="XXXXXXXXXX"
export APPLE_APP_STORE_CONNECT_APP_ID="6750123456"

npx eas-cli submit --platform ios --profile production --latest
# Or submit a local file:
# npx eas-cli submit --platform ios --profile production --path ./prabhat-samgiita-ai-release.ipa
```

**Option B — Expo dashboard:** open the finished build → **Submit to App Store**.

**Option C — Transporter app:** drag the `.ipa` into [Apple Transporter](https://apps.apple.com/app/transporter/id1450874784).

After processing (~5–30 min), open **TestFlight** in App Store Connect → add internal testers → install on iPhone → verify sign-in, audio, voice search, and member sync.

### Step 9 — App Store listing & review

In App Store Connect → your app → **App Store** tab:

| Field | Suggested value |
|-------|-----------------|
| Subtitle | e.g. *Prabhat Samgiita songs, stories & AI* |
| Category | Music or Lifestyle |
| Privacy Policy URL | `…/privacy` (full URL above) |
| Support URL | production web URL or a `/about` page |
| Marketing URL | optional — same web base |
| Copyright | your org / year |
| Age rating | complete questionnaire (no restricted content expected) |
| App Privacy | declare data collected (account email via OAuth, usage analytics if any) |
| Screenshots | 6.7" and 6.5" iPhone required; iPad if `supportsTablet` (enabled) |

**Export compliance:** `ITSAppUsesNonExemptEncryption: false` is set in `app.config.js` — answer **No** to custom encryption in App Store Connect (standard HTTPS only).

**Account deletion:** link to `…/delete-account` in App Review notes and ensure the URL works (Apple requirement).

Submit for review from the **App Store** tab after TestFlight QA passes.

### Step 10 — Ongoing releases

1. Bump `expo.version` (if user-visible) and `expo.ios.buildNumber` in `app.json`.
2. Run **Mobile release build** (or `eas build --platform ios --profile production`).
3. `eas submit --platform ios --profile production --latest`.
4. Add **What’s New** text in App Store Connect → submit update.

---

## 5. Android Play Store (production checklist)

Android release CI is wired; Play Console setup is mostly external.

| Step | Action |
|------|--------|
| Play Console app | Create app with package `net.prabhatasamgiita.ai` |
| Upload | Release workflow artifact `prabhat-samgiita-ai-android-release` (`.aab`) |
| Google Sign-In | Add Play **app signing** SHA-1 as a second Android OAuth client (§2) |
| Store listing | Privacy `…/privacy`, support email `anandamarga01@gmail.com`, feature graphic in `apps/web/public/brand/feature-graphic-1024x500.png` |
| Versioning | Bump `expo.android.versionCode` in `app.json` each Play upload (currently `2`) |
