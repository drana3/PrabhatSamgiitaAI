import { webGoogleOAuthConfigured } from "@/lib/web-oauth"

/** Production web sign-in uses Google PKCE only (no SWA /.auth/login/google). */
export function webGoogleUsesDirectOAuth() {
  return webGoogleOAuthConfigured()
}

/** SWA Easy Auth Google is allowed only in local/dev when PKCE is not configured. */
export function webGoogleEasyAuthFallbackEnabled() {
  return !webGoogleOAuthConfigured() && process.env.NODE_ENV !== "production"
}

/** Microsoft web sign-in is opt-in (SWA AAD is fragile on standalone Next). */
export function webMicrosoftSignInEnabled() {
  return process.env.NEXT_PUBLIC_WEB_MICROSOFT_SIGNIN_ENABLED === "true"
}

/** @deprecated Use webMicrosoftSignInEnabled() */
export function webMicrosoftUsesSwaEasyAuth() {
  return webMicrosoftSignInEnabled()
}

/** Dev-only polling; production uses AuthSessionRecovery one-shot instead. */
export function webEasyAuthBackgroundSyncEnabled() {
  return process.env.NODE_ENV !== "production"
}
