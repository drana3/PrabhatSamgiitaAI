# Web authentication

Mobile apps authenticate directly with the member API. **This document is web only.**

## Model

1. **One session cookie:** `ps_member_principal` (httpOnly). Set only by server routes under `/api/auth/*`.
2. **Member API:** `/api/member/*` forwards the principal to FastAPI unchanged.

## Providers

| Provider | Flow |
|----------|------|
| **Google** | PKCE: `GET /api/auth/google/begin` (sets cookie + redirect) → Google → `/auth/callback/google` → `POST /api/auth/google/finish?redirect=1` → cookie → redirect. |
| **Microsoft** | SWA: `/.auth/login/aad` → `GET /api/auth/microsoft/complete` → cookie → redirect. If SWA headers are missing, `/auth/callback/microsoft?browser=1` reads `/.auth/me` and `POST /api/auth/principal`. |
| **Facebook** | Browser OAuth → `POST /api/auth/principal` (when configured). |
| **Email** | `POST /api/auth/login` → cookie via API proxy. |

Production does **not** use SWA `/.auth/login/google`. Configure `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and server-side Google client credentials.

## Local development

Without Google client ID, dev may use SWA Google Easy Auth. Microsoft still requires SWA or the browser fallback page.
