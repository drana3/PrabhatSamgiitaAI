import { t } from "@/lib/i18n"
/**
 * Pure rules for the profile (name and photo). No React, no storage: the Edit profile page, the
 * complete-profile page and the tests all use these.
 */

export const NAME_MIN = 2
export const NAME_MAX = 40
/** The picture is a square this many pixels on a side, saved as JPEG. */
export const PHOTO_SIZE = 512
export const PHOTO_QUALITY = 0.85

/** Trim and collapse runs of spaces: "  Dada   Maetreya " -> "Dada Maetreya". */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim()
}

export type NameCheck = { ok: true; value: string } | { ok: false; error: string }

/** Display name, 2 to 40 characters after trimming, with at least one letter. */
export function validateName(raw: string | null | undefined): NameCheck {
  const value = normalizeName(raw)
  const length = Array.from(value).length
  if (length === 0) return { ok: false, error: t("account.error.nameEmpty") }
  if (length < NAME_MIN) return { ok: false, error: t("account.error.nameShort", { count: NAME_MIN }) }
  if (length > NAME_MAX) return { ok: false, error: t("account.error.nameLong", { count: NAME_MAX }) }
  if (!/\p{L}/u.test(value)) return { ok: false, error: t("account.error.nameLetters") }
  if (value.includes("@")) return { ok: false, error: t("account.error.nameEmail") }
  return { ok: true, value }
}

/** Letter on the round avatar: the first letter of the name, upper case; a dot when there is none. */
export function initialOf(name: string | null | undefined): string {
  const first = Array.from(normalizeName(name)).find((char) => /\p{L}/u.test(char))
  return first ? first.toLocaleUpperCase() : "·"
}

export type ProfileDraft = { name: string; photoUri: string | null }

/** True when the draft differs from what is saved (names compared after normalising). */
export function isProfileDirty(saved: ProfileDraft, draft: ProfileDraft): boolean {
  return normalizeName(saved.name) !== normalizeName(draft.name) || (saved.photoUri ?? null) !== (draft.photoUri ?? null)
}

/** Largest centred square of a picture of this size: the crop that comes before the resize. */
export function centerSquare(width: number, height: number): { originX: number; originY: number; width: number; height: number } {
  const side = Math.max(1, Math.floor(Math.min(width, height)))
  return {
    originX: Math.max(0, Math.floor((width - side) / 2)),
    originY: Math.max(0, Math.floor((height - side) / 2)),
    width: side,
    height: side,
  }
}

/**
 * Should the app ask for the name once? True when there is none, or only a placeholder
 * ("Apple member", "Friend") or an email address in its place.
 */
export function nameIsMissing(displayName: string | null | undefined, email: string | null | undefined): boolean {
  const name = normalizeName(displayName)
  if (!name) return true
  if (name.includes("@")) return true
  const lower = name.toLowerCase()
  if (PLACEHOLDER_NAMES.has(lower)) return true
  const local = normalizeName(email).split("@")[0] ?? ""
  if (local && lettersOnly(name) === lettersOnly(local)) return true
  return false
}

function lettersOnly(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}]/gu, "")
}

const PLACEHOLDER_NAMES = new Set([
  "apple member",
  "google member",
  "facebook member",
  "microsoft member",
  "prabhat samgiita member",
  "member",
  "friend",
  "guest",
  "your account",
])

/** A data URI of a JPEG made by the photo picker. */
export function isPhotoDataUri(value: string | null | undefined): value is string {
  return typeof value === "string" && /^data:image\/jpeg;base64,/.test(value)
}
