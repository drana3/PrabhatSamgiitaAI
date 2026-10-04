import { webGoogleOAuthConfigured } from "@/lib/web-oauth"

/** Production web sign-in uses Google PKCE only (no SWA /.auth/login/google). */
export function webGoogleUsesDirectOAuth() {
  return webGoogleOAuthConfigured()
}

/** SWA Easy Auth Google is allowed only in local/dev when PKCE is not configured. */
export function webGoogleEasyAuthFallbackEnabled() {
  return !webGoogleOAuthConfigured() && process.env.NODE_ENV !== "production"
}

/** Microsoft on web uses SWA AAD, completed on the server with a browser fallback page. */
export function webMicrosoftUsesSwaEasyAuth() {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === "true"
}

/** Dev-only polling; production uses AuthSessionRecovery one-shot instead. */
export function webEasyAuthBackgroundSyncEnabled() {
  return process.env.NODE_ENV !== "production"
}
