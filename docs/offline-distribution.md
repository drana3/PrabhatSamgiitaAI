# Share the app without Play Store or App Store fees

This guide explains how to give Android and iOS users an **installable app** without paying Google Play ($25) or Apple Developer ($99/year).

## Summary

| Platform | Free install method | What you share |
|----------|---------------------|----------------|
| **Android** | Sideload APK | `.apk` file or download link |
| **iOS (Mac QA)** | iOS Simulator build | `.tar.gz` from CI or Expo dashboard |
| **iPhone/iPad (end users, $0)** | Add to Home Screen (PWA) | Website URL (already live) |
| **iPhone/iPad (native, $99/yr)** | TestFlight / internal EAS link | Requires Apple Developer |

Every push to `main` that touches `apps/mobile/` triggers **Android APK + iOS Simulator** builds in GitHub Actions (when `EXPO_TOKEN` is configured).

---

## Android — install without Play Store

### How it works

1. GitHub Actions runs **EAS Build** with profile `preview-android` → produces an **APK** (not Play Store bundle).
2. A parallel job builds **iOS Simulator** (`preview-ios-simulator`) for Mac QA.
3. Artifacts are uploaded to GitHub Actions (kept 90 days).

No $25 Play Console fee is required for sideloading.

### One-time setup (free)

1. Create a free account at [expo.dev](https://expo.dev).
2. In your GitHub repo → **Settings → Secrets → Actions**, add:
   - `EXPO_TOKEN` — from [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)
   - `EAS_PROJECT_ID` — UUID from `apps/mobile/app.json` after `eas init` (`extra.eas.projectId`)
   - `MOBILE_API_BASE_URL` (optional) — your live API, e.g. `https://prabhatai-api.<your-host>.azurecontainerapps.io`
3. Link the project once from your machine:

```bash
cd apps/mobile
npm install -g eas-cli
eas login
eas init
```

### Trigger a build

**Automatic:** push mobile changes to `main`.

**Manual:** GitHub → **Actions** → **Mobile preview build** → **Run workflow** (builds Android APK and iOS Simulator in parallel).

**Local:**

```bash
npm run mobile:build:android          # APK for Android phones
npm run mobile:build:ios-simulator    # Simulator build for Mac
npm run mobile:build:ios              # Real iPhones (Apple Developer required)
npm run mobile:build                  # APK + iOS Simulator
```

### Share with users

**Option A — GitHub artifact (good for offline sharing)**

1. Open the completed workflow run on GitHub.
2. Download **prabhat-samgiita-ai-android-preview** (.apk).
3. Share via WhatsApp, Google Drive, USB, email, etc.

**Option B — Expo link (good for quick updates)**

1. Open [expo.dev](https://expo.dev) → your project → **Builds**.
2. Copy the install link or QR code from the latest **preview** Android build.

### User install steps (Android)

1. Download the APK.
2. Settings → **Install unknown apps** → allow your browser or Files app.
3. Open the APK → **Install**.
4. Open **Prabhat Samgiita AI**.

---

## iOS Simulator — Mac QA without Apple Developer

CI uploads **prabhat-samgiita-ai-ios-simulator** (`.tar.gz`).

1. Download and extract the archive.
2. Open **Xcode → Simulator**.
3. Drag the `.app` bundle onto the simulator window.

This is for developers and testers on Mac. It does **not** install on physical iPhones.

---

## iOS — real devices (Apple Developer required)

Apple does **not** allow sharing a standalone `.ipa` to real iPhones without a paid Apple Developer account (or TestFlight, which also requires it).

**Free option for iOS end users today: Progressive Web App (PWA)**

Your web app already supports install to home screen:

1. Open in **Safari**:  
   `https://prabhatai-web.bluemeadow-9418d5fc.centralindia.azurecontainerapps.io`
2. Tap **Share** → **Add to Home Screen**.
3. The icon opens full-screen like an app (songs, AI, harmonium on web).

This costs **$0** and works offline for cached pages once loaded.

**Native iOS on real devices (Apple Developer $99/year):**

```bash
npm run mobile:build:ios
# or: cd apps/mobile && eas build --platform ios --profile preview-ios
```

Then share via TestFlight or EAS internal install link (requires device registration).

---

## Cost comparison

| Method | Android | iOS |
|--------|---------|-----|
| **Sideload APK / PWA (this guide)** | $0 | $0 |
| Play Store + App Store | $25 + $99/yr | $99/yr |

EAS free tier includes limited cloud builds per month — enough for preview sharing.

---

## Fresh artifact on every build

| Trigger | Result |
|---------|--------|
| Push to `main` (mobile/core paths) | New **Android APK** + **iOS Simulator** artifacts |
| Manual workflow dispatch | Same pair |
| `npm run mobile:build` | APK + iOS Simulator locally |
| `npm run mobile:build:ios` | Native iOS `.ipa` (Apple Developer) |

Each build uses the current code and `EXPO_PUBLIC_API_BASE_URL` from `eas.json` or secrets.

---

## Troubleshooting

**“App not installed” on Android**  
Uninstall any older preview with the same package name, then reinstall.

**App opens but no songs load**  
Check `MOBILE_API_BASE_URL` / API is reachable from the phone (not `localhost`).

**GitHub workflow fails on EXPO_TOKEN**  
Add the secret and run `eas init` once locally to register the project.

**iPhone users want a native app icon**  
Use **Add to Home Screen** (PWA) until Apple Developer is purchased.
