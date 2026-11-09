import { validateName } from "@/lib/profile/validate"
import { t } from "@/lib/i18n"

/**
 * Pure rules of the Sign in page: which providers show, how the email steps work, what an error
 * says, and where the person goes afterwards. The sign-in calls themselves stay in lib/session.ts.
 */

export type EmailStep = "email" | "password"
export type EmailMode = "signin" | "signup"

export type ProviderFlags = {
  apple: boolean
  google: boolean
  microsoft: boolean
}

/**
 * Providers shown on the page. Apple and Google follow the app's own config (`appleSignInOffered`,
 * `googleAuthConfigured`); the web preview shows them too, but only as a mock that never calls the
 * real sign-in. Microsoft shows only when configured (not in the preview). There is no Facebook sign-in (removed 2026-11-09).
 */
export function visibleProviders(real: ProviderFlags, preview: boolean): ProviderFlags {
  return {
    apple: real.apple || preview,
    google: real.google || preview,
    microsoft: real.microsoft && !preview,
  }
}

export function isEmailValid(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.trim())
}

export const PASSWORD_MIN = 8

export type EmailForm = {
  mode: EmailMode
  email: string
  password: string
  name: string
}

export type EmailFormCheck = { ok: true } | { ok: false; field: "email" | "password" | "name"; error: string }

/** First thing wrong with the email form, in the order the fields appear. */
export function checkEmailForm(form: EmailForm): EmailFormCheck {
  if (!isEmailValid(form.email)) return { ok: false, field: "email", error: "Enter a valid email address." }
  if (form.mode === "signup") {
    const name = validateName(form.name)
    if (!name.ok) return { ok: false, field: "name", error: name.error }
  }
  if (form.password.length < (form.mode === "signup" ? PASSWORD_MIN : 1)) {
    return {
      ok: false,
      field: "password",
      error: form.mode === "signup" ? t("account.error.passwordShort", { count: PASSWORD_MIN }) : t("account.error.passwordEmpty"),
    }
  }
  return { ok: true }
}

const CANCELLED = /cancel/i
const OFFLINE = /network request failed|failed to fetch|network error|timed out|timeout|offline/i
/** Setup text written for developers (env names, cloud consoles): never shown to a member. */
const SETUP_TEXT = /EXPO_PUBLIC|Google Cloud|OAuth client|SHA-1|Play Console|bundle ID|Azure|not configured/i

/**
 * What the page says for a failed sign-in, or `null` when nothing should show (the person closed the
 * sheet: that is not an error).
 */
export function authErrorMessage(error: unknown): string | null {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : ""
  if (CANCELLED.test(text)) return null
  if (OFFLINE.test(text)) return t("account.error.network")
  if (!text || SETUP_TEXT.test(text)) return t("account.error.signInUnfinished")
  return text
}

export type AfterSignIn =
  | { to: "complete-profile"; path: string }
  | { to: "back" }
  | { to: "tabs" }

/**
 * Where the person goes when sign-in worked: the one-time page for what is still missing (name, mobile
 * number), else back to where they came from. From the welcome screen there is no "back": go to the app.
 */
export function afterSignIn(result: { needsName?: boolean; needsPhone?: boolean }, cameFromWelcome: boolean): AfterSignIn {
  const params = [result.needsName ? "name=1" : null, result.needsPhone ? "phone=1" : null].filter(Boolean)
  if (params.length) return { to: "complete-profile", path: `/complete-profile?${params.join("&")}` }
  return cameFromWelcome ? { to: "tabs" } : { to: "back" }
}
