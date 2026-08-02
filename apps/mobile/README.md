# Prabhat Samgiita AI — Mobile

Expo app for iOS and Android. Shares API logic with the web app via `@prabhat/core`.

## Setup

This app keeps its own `node_modules` and lockfile. It is deliberately outside the
npm workspaces, because its react 18 / React Native 0.76 stack cannot be hoisted
alongside the web app's react 19 without breaking Metro and CocoaPods resolution.

```bash
# Mobile dependencies (not installed by the root `npm install`)
cd apps/mobile
npm install

# Link Expo project (once, after creating expo.dev account)
npx eas-cli login
npx eas-cli init   # writes projectId into app.json

# Start API locally (another terminal)
npm run dev:api

# Start Expo
npm run mobile
```

Set the API URL for a physical device (use your machine IP, not localhost):

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8000 npm run mobile
```

## Cloud builds (Android + iOS)

| Command | Output | Install target |
|---------|--------|----------------|
| `npm run mobile:build:android` | `.apk` | Any Android phone (sideload) |
| `npm run mobile:build:ios-simulator` | `.tar.gz` with `.app` | Xcode iOS Simulator on Mac |
| `npm run mobile:build:ios` | `.ipa` | Real iPhone/iPad (Apple Developer $99/yr) |
| `npm run mobile:build` | APK + iOS Simulator | CI-style preview pair |

Production store builds:

```bash
cd apps/mobile
eas build --platform android --profile production   # Play Store AAB
eas build --platform ios --profile production       # App Store / TestFlight
```

## GitHub Actions

Push mobile changes to `main` (or run **Mobile preview build** manually). With secrets configured, CI produces:

- **prabhat-samgiita-ai-android-preview** — sideload APK
- **prabhat-samgiita-ai-ios-simulator** — Simulator build for Mac QA

### Required GitHub secrets

| Secret | Purpose |
|--------|---------|
| `EXPO_TOKEN` | [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens) |
| `EAS_PROJECT_ID` | From `app.json` → `extra.eas.projectId` after `eas init` |
| `MOBILE_API_BASE_URL` | *(optional)* overrides API URL in cloud builds |

## Screens

- **Home** — hero, search, today’s recommendations, featured story
- **Explore** — song search
- **Stories** — inspiration reader
- **Account** — member features (Phase 2)
- **Song** — lyrics, meaning, listen, related songs
- **Story** — full reader with related song links

## iPhone users without Apple Developer fee

Safari → open the live website → **Add to Home Screen** (free PWA).

See **[docs/offline-distribution.md](../../docs/offline-distribution.md)** for full install guides.

See `docs/mobile-app-plan.md` for the UX roadmap.
