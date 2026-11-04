import { friendlyPersonName } from "@/lib/displayName"
import {
  REVIEW_STYLE_LABELS,
  type ReviewStyle,
} from "@/lib/appearance"

/** Routes the sheet links to. Rows whose screen is not built yet stay visible but inert. */
export const PROFILE_ROUTES = {
  signIn: "/signin",
  feedback: "/feedback",
  about: "/about",
  /** prototype LANGUAGE SHEET: app/script-translations.tsx */
  scriptAndTranslations: "/script-translations",
  /** prototype REVIEW STYLE SHEET: app/review-style.tsx */
  reviewStyle: "/review-style",
  /** SCR-20, another branch */
  downloads: "/storage",
} as const

export type ProfileRoute = (typeof PROFILE_ROUTES)[keyof typeof PROFILE_ROUTES]

/** Flip to true when the screen lands on this branch's base. */
export const PROFILE_ROUTE_READY: Record<ProfileRoute, boolean> = {
  "/signin": true,
  "/feedback": true,
  "/about": true,
  "/script-translations": true,
  "/review-style": true,
  "/storage": true,
}

export type ProfileIdentity = {
  /** first letter for the avatar, never an email character */
  initial: string
  title: string
  /** secondary line; `null` when there is nothing real to say */
  subtitle: string | null
  signedIn: boolean
}

/**
 * Account block shown at the top of the sheet. Never exposes the raw
 * status strings of the old tab ("0 saved · Signed in · synced · apple").
 */
export function buildProfileIdentity(input: {
  mode: "guest" | "signed_in"
  displayName: string | null | undefined
  email: string | null | undefined
}): ProfileIdentity {
  if (input.mode !== "signed_in") {
    return { initial: "G", title: "Guest", subtitle: "Sign in to keep your songs on every device", signedIn: false }
  }
  const email = (input.email || "").trim() || null
  const title = friendlyPersonName(input.displayName, email)
  const initial = title.trim().charAt(0).toUpperCase() || "·"
  return { initial, title, subtitle: email, signedIn: true }
}

/** Sizes for the Storage row; decimal megabytes like the OS settings pages. */
export function formatStorage(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "0 MB"
  const mb = bytes / 1_000_000
  if (mb < 0.1) return "<0.1 MB"
  if (mb < 1000) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
  return `${(mb / 1000).toFixed(1)} GB`
}

export function storageRowValue(bytes: number | null | undefined, fileCount: number): string {
  if (fileCount <= 0) return "Nothing saved"
  return formatStorage(bytes)
}

export function reviewStyleRowValue(style: ReviewStyle): string {
  return REVIEW_STYLE_LABELS[style]
}

export function isRouteReady(route: ProfileRoute): boolean {
  return PROFILE_ROUTE_READY[route]
}

/** Assistant row: the daily limit is fixed by the API; the count used is not tracked on the device. */
export function assistantLimitLabel(memberQuota: boolean, guestLimit: number, memberLimit: number): string {
  return `${memberQuota ? memberLimit : guestLimit} a day`
}

/** Version line for the About row. */
export function versionLabel(version: string | null | undefined): string {
  return version ? `Version ${version}` : "Version"
}
