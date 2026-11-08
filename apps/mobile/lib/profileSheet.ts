import { formatBytes, t } from "@/lib/i18n"
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
  /** the language of the app's own text: app/language.tsx */
  language: "/language",
  /** prototype REVIEW STYLE SHEET: app/review-style.tsx */
  reviewStyle: "/review-style",
  /** SCR-20, another branch */
  downloads: "/storage",
  /** Your library: everything that is the person's own, app/library-v2.tsx */
  library: "/library-v2",
  /** What the person heard on this phone (local only): app/listening-history.tsx */
  listeningHistory: "/listening-history",
  /** the avatar and name block opens this: app/edit-profile.tsx */
  editProfile: "/edit-profile",
  /** the switch for volume leveling: app/volume-leveling.tsx */
  volumeLeveling: "/volume-leveling",
  /** the rules for a Kiirtan or a Bhajan: app/content-rules.tsx */
  contentRules: "/content-rules",
  /** admins only: app/admin/index.tsx (it checks the role again) */
  admin: "/admin",
} as const

export type ProfileRoute = (typeof PROFILE_ROUTES)[keyof typeof PROFILE_ROUTES]

/** Flip to true when the screen lands on this branch's base. */
export const PROFILE_ROUTE_READY: Record<ProfileRoute, boolean> = {
  "/signin": true,
  "/feedback": true,
  "/about": true,
  "/script-translations": true,
  "/review-style": true,
  "/language": true,
  "/storage": true,
  "/library-v2": true,
  "/listening-history": true,
  "/edit-profile": true,
  "/content-rules": true,
  "/volume-leveling": true,
  "/admin": true,
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
    return { initial: "G", title: t("profile.guest.title"), subtitle: t("profile.guest.subtitle"), signedIn: false }
  }
  const email = (input.email || "").trim() || null
  const title = friendlyPersonName(input.displayName, email)
  const initial = title.trim().charAt(0).toUpperCase() || "·"
  return { initial, title, subtitle: email, signedIn: true }
}

/** Sizes for the Storage row; decimal megabytes like the OS settings pages. */
export function formatStorage(bytes: number | null | undefined): string {
  return formatBytes(bytes)
}

export function storageRowValue(bytes: number | null | undefined, fileCount: number): string {
  if (fileCount <= 0) return t("profile.storage.empty")
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
  return t("profile.assistant.perDay", { count: memberQuota ? memberLimit : guestLimit })
}

/** Version line for the About row. */
export function versionLabel(version: string | null | undefined): string {
  return version ? t("profile.version", { version }) : t("profile.version.bare")
}
