# Phase 1 Delivery QA

**Date:** 2026-08-08  
**Branch:** `main` @ `a17358e` (Prefer DB-stored song meanings over AI translation at runtime)  
**QA agent:** Automated CI + structured manual checklist (live journeys blocked without prod credentials)

---

## Executive summary

**Verdict: Conditionally ready for EOD go-live** — all local automated gates pass (lint, 586 unit tests, 60 E2E journeys, backend acceptance 29/29, production build). No P0/P1 code defects were found in this run; **no commits were required**.

**Before flipping production traffic tomorrow EOD**, complete blocked manual journeys (live OAuth sign-in, admin/super-admin on Azure, mobile device quiz QR, YouTube review sync). Bootstrap at least one super-admin via SQL. Confirm `MEMBER_PROXY_KEY` parity between web and API container apps.

---

## Automated test results

| Gate | Status | Details |
|------|--------|---------|
| `npm run lint` | **Pass** | ESLint clean; ruff + mypy (83 files) clean |
| `npm run test` (web) | **Pass** | 209 tests, 41 files |
| `npm run test` (core) | **Pass** | 41 tests |
| `npm run test` (api) | **Pass** | 246 pytest cases |
| `npm run test:mobile` | **Pass** | 86 tests, 26 files |
| `npm run build:e2e` | **Pass** | Next.js 15.5 production build |
| E2E `desktop-chromium` | **Pass** | 30/30 (`premium-journeys.spec.ts`) |
| E2E `mobile-chromium` | **Pass** | 30/30 |
| `validate_backend_acceptance.py` | **Pass** | 29/29 cases |
| Remote GitHub CI | **Not verified** | `gh` not authenticated in QA environment |
| `validate_live_backend.py` (prod) | **Not run** | Requires live Azure API URL + network |

---

## Manual journey checklist

Status key: **Pass** | **Fail** | **Blocked** | **N/A**

### Core guest journeys

| Journey | Status | Evidence / notes |
|---------|--------|------------------|
| Home loads (recommendations, collections, hero search) | **Pass** | E2E + backend today recommendations |
| Explore search (semantic, song number intent) | **Pass** | E2E + search API tests |
| Guest browse → song page | **Pass** | E2E song landing on AI companion |
| Listen (audio player) | **Pass** | E2E song actions; media API smoke |
| Watch (YouTube embed) | **Pass** | Backend acceptance song 1 video |
| Ask AI on song page | **Pass** | E2E companion memory + Romanized Hindi |
| Language switcher / DB meaning priority | **Pass** | `song-meanings`, `ingestion-meaning`, `song-language-switcher` unit tests; commit `a17358e` |
| Harmonium / practice coach | **Pass** | E2E practice coach; harmonium API tests |
| Stories | **Pass** | `stories-inspiration` unit tests |
| 404 / query guardrails | **Pass** | E2E garbage queries + 404 branded page |

### Auth & member

| Journey | Status | Evidence / notes |
|---------|--------|------------------|
| Microsoft sign-in (web) | **Blocked** | E2E checks sign-in page visibility only; needs live Easy Auth |
| Google sign-in (web) | **Blocked** | `sign-in-providers` unit tests; live OAuth not exercised |
| Facebook sign-in (web) | **Blocked** | Same |
| Email sign-in | **Blocked** | Credentials flow exists (`0010_user_credentials`); not live-tested |
| Sign-in redirect / return path | **Pass** | `sign-in-redirect`, `sign-in` unit tests |
| Member session sync (web) | **Pass** | `member-auth-journeys`, `member-source-of-truth` tests |
| Sign in → favorites → sign out → sign in restore | **Blocked** | Favorite button unit tests pass; full OAuth round-trip needs prod |
| Chat memory (companion scope, web) | **Pass** | E2E + `chat.test.ts` + API `test_chat_memory_history` |
| Chat memory clear (member) | **Pass** | API chat archive tests; member routes covered in proxy tests |
| Mobile AI companion history restore | **Pass** (unit) / **Blocked** (device) | `chatStore.test.ts`, `memberSync.test.ts`; Expo device QA pending |
| Mobile vs web chat independence | **Pass** | Separate storage keys / scopes in web `chat.ts` + mobile `chatStore` |

### Admin

| Journey | Status | Evidence / notes |
|---------|--------|------------------|
| `/admin` redirect / gate | **Blocked** | Needs authenticated admin on Azure |
| Admin feedback page | **Pass** (API) / **Blocked** (UI) | `admin-feedback-panel` RTL; deploy smoke hits feedback API |
| Admin members page | **Pass** (API) / **Blocked** (UI) | `test_admin_members.py` |
| Admin YouTube review | **Pass** (API) / **Blocked** (UI) | `test_youtube_sync.py` |
| Admin song ingestion submit | **Pass** (API) / **Blocked** (UI) | `test_admin_workflow.py` |
| Admin live quiz + QR | **Pass** (API) / **Blocked** (UI + QR) | `test_quiz_events.py`; QR scan needs mobile camera |
| Super-admin ingestion approve | **Blocked** | Requires `is_super_admin` account on prod |

### Quiz end-to-end

| Journey | Status | Evidence / notes |
|---------|--------|------------------|
| Member quiz start / submit (API) | **Pass** | `test_quiz.py`, deploy smoke |
| Admin create live quiz event | **Pass** (API) / **Blocked** (live) | `test_quiz_events.py` |
| Mobile scan QR → submit | **Blocked** | Needs physical device + live event |
| Admin verify submissions | **Blocked** | Needs live admin session |
| Home winners display | **Pass** (unit) / **Blocked** (live) | `quiz-events.test.ts`, `quiz-board.test.tsx` |

### YouTube review

| Journey | Status | Evidence / notes |
|---------|--------|------------------|
| Daily watcher workflow (GitHub Action) | **N/A** | `watch-youtube.yml`; not triggered in QA |
| Admin sync unmatched videos | **Pass** (API) / **Blocked** (UI) | `test_youtube_sync.py` |
| Admin approve → catalog commit | **Pass** (API) / **Blocked** (UI) | Same |

---

## Known issues & risks

| ID | Priority | Issue | Mitigation |
|----|----------|-------|------------|
| KI-1 | **P1** | Live OAuth journeys (Microsoft/Google/Facebook/email) not verified in this QA run | Run manual sign-in on production web before EOD; deploy script already smoke-checks Microsoft link |
| KI-2 | **P1** | Super-admin ingestion approval untested on live Azure | Bootstrap super-admin (SQL below); walk through one approve/reject on `/admin/ingest` |
| KI-3 | **P1** | Live quiz QR → mobile submit → winners untested on device | Create test event; scan with Expo build; verify home winners |
| KI-4 | **P2** | `DEFAULT_ADMIN_EMAILS` is set in deploy env but **not wired** in API code — admins are not auto-granted on first sign-in | Grant admin via members UI or `grant-admin` API after first sign-in; or implement wiring post-Phase 1 |
| KI-5 | **P2** | First super-admin requires DB or existing super-admin API | One-time SQL bootstrap (see go-live steps) |
| KI-6 | **P2** | Mobile EAS preview not re-run in this session | `mobile-preview.yml` runs on `apps/mobile/**` pushes; confirm latest build if mobile ships tomorrow |
| KI-7 | **P3** | `apps/mobile` npm audit: 15 vulnerabilities (14 moderate, 1 high) | Schedule dependency upgrades post-Phase 1; not blocking runtime |
| KI-8 | **P3** | Vitest `act(...)` warning in `community-feedback-ticker` test | Cosmetic test hygiene |
| KI-9 | **P3** | 61 / 5,018 songs lack any public media link (documented coverage gap) | Expected; surfaced as explicit gaps, not fabricated |
| KI-10 | **P3** | E2E locally requires non-sandbox permissions (Playwright EPERM in sandbox) | CI and local `all` permissions succeed |

---

## Recommended EOD go-live steps

### 1. Database / schema

Alembic runs automatically on API startup (`initialize_schema` in `apps/api/app/main.py`). Idempotent `ADD COLUMN IF NOT EXISTS` covers `is_admin` and `is_super_admin` on older databases.

**No separate migration job required** for standard deploy — confirm API readiness shows `database_synced: true` after deploy.

Latest revision chain includes quiz events (`0012`) and admin ingestion (`0013`).

### 2. Super-admin bootstrap (one-time)

After the owner signs in once (creates `user_accounts` row):

```sql
UPDATE user_accounts
SET is_admin = true, is_super_admin = true
WHERE email = 'owner@example.com' AND deleted_at IS NULL;
```

Alternatively, an existing super-admin can call:

`POST /api/v1/members/admin/grant-super-admin` with body `{"email": "..."}`.

### 3. Environment variables (production)

**API container app**

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL + pgvector |
| `MEMBER_PROXY_KEY` | Yes | Must match web secret |
| `API_CORS_ORIGINS` | Yes | `https://<web-fqdn>` |
| `AZURE_OPENAI_*` | For full AI | Endpoint, key, chat + embedding deployments |
| `DEFAULT_ADMIN_EMAILS` | Optional | Currently unused in code (KI-4) |
| `PROTECTED_ADMIN_EMAILS` | Recommended | Prevents accidental admin revoke |

**Web container app**

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | API FQDN |
| `NEXT_PUBLIC_AUTH_ENABLED` | Yes | `true` for member features |
| `MEMBER_PROXY_KEY` | Yes | Same as API |
| `API_BASE_URL` | Yes | Server-side proxy to API |

**Mobile (EAS / Expo)**

| Variable | Required | Notes |
|----------|----------|-------|
| `EXPO_PUBLIC_API_BASE_URL` | Yes | Production API |
| `EXPO_PUBLIC_WEB_BASE_URL` | Yes | Share links |
| `EXPO_PUBLIC_MEMBER_PROXY_KEY` | Yes | Same proxy key |
| `EXPO_PUBLIC_AZURE_CLIENT_ID` | For Microsoft mobile auth | Entra app registration |

### 4. Deploy sequence

1. Merge to `main` (triggers `deploy.yml`: lint → test → build → E2E matrix → Azure deploy).
2. Wait for API readiness: 5,018 songs, RAG chunks, embeddings (deploy script polls up to 60 min).
3. Run post-deploy smoke: `python scripts/validate_live_backend.py https://<api-fqdn>`.
4. Manual: sign in, grant admin, super-admin SQL if needed.
5. Mobile: confirm EAS preview build points at production API if distributing tomorrow.

### 5. Git / parallel agent state

Working tree **clean** on `main`, aligned with `origin/main`. No uncommitted parallel-agent work to integrate or stash.

---

## Phase 1 feature inventory (automated coverage snapshot)

| Area | Automated coverage | Manual gap |
|------|-------------------|------------|
| Auth (multi-provider + redirect + session sync) | Unit + partial E2E | Live OAuth |
| AI companion + memory | E2E + 17 web + API chat tests | — |
| Song pages (Ask AI, language, DB meanings) | E2E + unit | — |
| Admin (feedback, members, YouTube, ingest, quiz) | API integration tests | Live admin UI |
| Member (favorites, quiz cert, memory clear) | Unit + API | Live favorites round-trip |
| Core (search, explore, home, stories, player, practice) | E2E + acceptance matrix | — |

---

## Sign-off checklist (for release owner)

- [ ] Production deploy pipeline green on GitHub
- [ ] `validate_live_backend.py` pass against production API
- [ ] Owner super-admin SQL applied
- [ ] Microsoft (minimum) sign-in verified on production web
- [ ] One admin page smoke-tested in browser
- [ ] One ingestion approve/reject (super-admin)
- [ ] Mobile device: companion history + optional quiz QR
- [ ] YouTube review sync clicked once in admin UI
