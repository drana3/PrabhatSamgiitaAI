# Local development setup

Guide for running **Prabhat Samgiita AI** on your machine: API, web (Next.js), and mobile (Expo).

## Repository layout

| Path | Stack | Install |
|------|-------|---------|
| `apps/api` | FastAPI + PostgreSQL + pgvector | `cd apps/api && uv sync` (via `make install`) |
| `apps/web` | Next.js 15, React 19 | Root `npm install` (workspace) |
| `apps/mobile` | Expo 54, React Native 0.81 | `cd apps/mobile && npm install` (separate lockfile) |
| `packages/core` | Shared TypeScript types/helpers | Linked from web and mobile |

The mobile app is **not** in the root npm workspaces (different React versions). Run `npm install` in both the repo root and `apps/mobile`.

---

## Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.12+ and [uv](https://docs.astral.sh/uv/)
- **Docker** (for local PostgreSQL)
- **Web only:** nothing else for day-to-day dev
- **Mobile (iOS):** Xcode, CocoaPods, iOS Simulator or device
- **Mobile (Android):** Android Studio, SDK, emulator or device
- **Optional:** [EAS CLI](https://docs.expo.dev/build/setup/) for cloud builds (`eas login`, `eas init`)

---

## 1. Shared backend setup (required for web and mobile)

### Environment

```bash
cp .env.example .env
```

Edit `.env` as needed. Minimum for local dev:

- `DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/prabhatai`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- `API_BASE_URL=http://localhost:8000`
- `API_CORS_ORIGINS=http://localhost:3000`

### Database

```bash
docker compose up -d db
make install          # root npm + api uv sync
make validate-data
make migrate
make seed
```

### API

```bash
npm run dev:api
# or: make api
```

API: **http://localhost:8000**  
OpenAPI docs: **http://localhost:8000/docs**

---

## 2. Web application

### Install and run

From the repo root (after `make install`):

```bash
npm run dev
# or: make dev   # starts API + web together
```

Web: **http://localhost:3000**

Web reads env from the **repo root** `.env` (`NEXT_PUBLIC_*` vars).

### Web-only commands

```bash
npm run dev:web       # Next.js only (API must already be running)
npm run build         # production build
npm run test          # unit tests (web + core + api)
npm run test:e2e      # Playwright (needs built app / API per project config)
```

### Auth (optional, local)

In root `.env`:

```bash
NEXT_PUBLIC_AUTH_ENABLED=true
MEMBER_PROXY_KEY=<same-long-random-string-on-api-and-clients>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Google Cloud Web OAuth client>
GOOGLE_CLIENT_ID=<same as above>
GOOGLE_CLIENT_SECRET=<server secret for code exchange>
```

Google Cloud → **Web application** OAuth client → authorized redirect URIs must include your local site (e.g. `http://localhost:3000/api/auth/google/callback` or whatever the app registers).

---

## 3. Mobile application

### Install

```bash
cd apps/mobile
npm install
cp .env.example .env
```

### Point mobile at your API

**Simulator (iOS)** — localhost works:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

**Physical device** — use your machine’s LAN IP, not `localhost`:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:8000
```

Ensure the API listens on `0.0.0.0` (`npm run dev:api` already uses `--host 0.0.0.0`).

Member sync (favorites, quiz, chat memory) needs the same proxy key as the API:

```bash
EXPO_PUBLIC_MEMBER_PROXY_KEY=<same as MEMBER_PROXY_KEY in root .env>
```

### Run (development build — not Expo Go)

OAuth (Microsoft / Google) and native speech recognition **do not work in Expo Go**. Use a dev build:

```bash
# Terminal 1 — API (from repo root)
npm run dev:api

# Terminal 2 — Metro
cd apps/mobile
npx expo start --clear

# Terminal 3 — install native app (first time or after native config changes)
cd apps/mobile
npx expo run:ios          # or: npm run ios
npx expo run:android      # or: npm run android
```

From repo root you can start Metro with:

```bash
npm run mobile
```

### Mobile environment reference

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API (local or Azure) |
| `EXPO_PUBLIC_WEB_BASE_URL` | Share links / web parity |
| `EXPO_PUBLIC_MEMBER_PROXY_KEY` | Authenticated member API from native |
| `EXPO_PUBLIC_AZURE_CLIENT_ID` | Microsoft sign-in |
| `EXPO_PUBLIC_AZURE_TENANT_ID` | Usually `common` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google sign-in on iOS (bundle `net.prabhatasamgiita.ai`) |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google sign-in on Android (package + SHA-1) |

Do **not** use the website Web client ID for native Google sign-in. Create separate **iOS** and **Android** OAuth clients in Google Cloud.

Native Google redirect (handled by the app): `net.prabhatasamgiita.ai:/oauthredirect`

### Mobile tests

```bash
cd apps/mobile
npm test
# or from root:
npm run test:mobile
```

### iOS notes

- **Project path with spaces:** This repo path may contain spaces. The Expo plugin `plugins/withIosProjectRootFix.js` patches Xcode scripts; if native build fails on paths, run `npx expo prebuild --platform ios` after pulling.
- **Simulator voice search:** Simulator → **I/O → Audio Input → Mac microphone**. Pause any playing song before using the mic.
- **Reload JS:** Cmd+R in simulator after Metro changes.

### Android notes

Debug SHA-1 for Google OAuth:

```bash
cd apps/mobile/android
./gradlew signingReport
```

Register package `net.prabhatasamgiita.ai` and the debug SHA-1 on the Android OAuth client.

---

## 4. Run everything locally (typical day)

```bash
# Terminal 1 — database (once)
docker compose up -d db

# Terminal 2 — API + web
npm run dev

# Terminal 3 — mobile (optional)
cd apps/mobile && npx expo start
# Use an already-installed dev build, or: npx expo run:ios
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:8000 |
| Metro | http://localhost:8081 |

---

## 5. Verification

```bash
make lint
make test
npm run test:mobile
make build
```

---

## 6. Troubleshooting

| Issue | What to try |
|-------|-------------|
| Web can’t reach API | Check `NEXT_PUBLIC_API_BASE_URL`, API running on 8000, CORS `API_CORS_ORIGINS` includes `http://localhost:3000` |
| Mobile can’t reach API on device | Use LAN IP in `EXPO_PUBLIC_API_BASE_URL`; same Wi‑Fi; firewall allows port 8000 |
| Google `400 invalid_request` on mobile | Use iOS/Android client IDs in `apps/mobile/.env`, not the web client; rebuild native app after changing URL schemes |
| Google sign-in in Expo Go | Use `npx expo run:ios` / `run:android` — Expo Go cannot use `prabhatai://` redirects |
| Mic / voice search silent | Pause playback; on simulator enable Mac microphone; use dev build (not Expo Go) |
| Stale mobile UI | `npx expo start --clear`, delete app from simulator, `npx expo run:ios` again |
| Port 8081 in use | `lsof -ti:8081 \| xargs kill -9` then restart Metro |

---

## Related docs

- [README.md](../README.md) — catalog status and Azure deploy
- [apps/mobile/README.md](../apps/mobile/README.md) — EAS builds and CI
- [deployment-azure.md](./deployment-azure.md) — production hosting
- [offline-distribution.md](./offline-distribution.md) — install without app stores
