import { NAME_MAX, NAME_MIN, SLUG_MAX, SLUG_MIN } from "@/lib/authors/constants"

/**
 * The address rules, the same as the server's (apps/api/app/services/author_rules.py), so the form can say
 * "too short" before it asks. The server stays the judge: it also knows what is taken, reserved or protected.
 */

/** What the person typed, made into an address: lowercase ASCII, words joined by single hyphens. */
export function normalizeSlug(raw: string | null | undefined): string {
  const folded = (raw ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
  return folded
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * The address as it is being typed: like `normalizeSlug`, but a hyphen at the end stays, so "priya" + "-" + "devi"
 * gives "priya-devi" and not "priyadevi". The field settles to `normalizeSlug` on blur and when the form is sent.
 */
export function typingSlug(raw: string | null | undefined): string {
  const folded = (raw ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
  return folded
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
}

export type SlugProblem = "too_short" | "too_long" | "characters" | "needs_letter"

/** The problems that need no server: length, characters, at least one letter. */
export function localSlugProblem(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return "too_short"
  if (slug.length > SLUG_MAX) return "too_long"
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "characters"
  if (!/[a-z]/.test(slug)) return "needs_letter"
  return null
}

/** A first guess at an address from a display name ("Madhu Vrata" gives "madhu-vrata"). */
export function suggestSlug(displayName: string): string {
  return normalizeSlug(displayName).slice(0, SLUG_MAX).replace(/-+$/, "")
}

export function nameProblem(name: string): "too_short" | "too_long" | null {
  const n = name.trim().replace(/\s+/g, " ")
  if (n.length < NAME_MIN) return "too_short"
  if (n.length > NAME_MAX) return "too_long"
  return null
}

/** The sentence key for a server error code or a slug problem. Unknown codes fall back to a generic line. */
export function problemKey(code: string | null | undefined): string {
  const known = new Set([
    "too_short",
    "too_long",
    "characters",
    "needs_letter",
    "reserved",
    "taken",
    "quarantined",
    "cooldown",
    "protected",
  ])
  if (code && known.has(code)) return `authors.slug.${code}`
  return "authors.slug.unknown"
}

const ERROR_KEYS: Record<string, string> = {
  slug_too_short: "authors.slug.too_short",
  slug_too_long: "authors.slug.too_long",
  slug_characters: "authors.slug.characters",
  slug_needs_letter: "authors.slug.needs_letter",
  slug_reserved: "authors.slug.reserved",
  slug_taken: "authors.slug.taken",
  slug_quarantined: "authors.slug.quarantined",
  slug_cooldown: "authors.error.slug_cooldown",
  name_too_short: "authors.error.name_too_short",
  text_has_link: "authors.error.text_has_link",
  language_unknown: "authors.error.language_unknown",
  already_exists: "authors.error.already_exists",
  suspended: "authors.error.suspended",
  photo_empty: "authors.error.photo_empty",
  photo_too_big: "authors.error.photo_too_big",
  photo_type: "authors.error.photo_type",
  link_scheme: "authors.error.link_scheme",
  link_url: "authors.error.link_url",
  link_host: "authors.error.link_host",
  link_count: "authors.error.link_count",
  link_repeat: "authors.error.link_repeat",
  no_profile: "authors.error.no_profile",
  rate_limited: "authors.error.rate_limited",
  bad_id: "authors.error.generic",
  alias_invalid: "authors.error.alias_invalid",
  alias_not_allowed: "authors.error.alias_not_allowed",
  alias_taken: "authors.error.alias_taken",
  alias_limit: "authors.error.alias_limit",
  alias_not_found: "authors.error.generic",
  claims_waiting: "authors.error.claims_waiting",
  claim_not_found: "authors.error.claim_gone",
  claim_closed: "authors.error.claim_gone",
  page_suspended: "authors.error.suspended",
}

/** The sentence key for an API error: its `code`, a status, or "no network". */
export function errorKey(error: { code?: string | null; status?: number; network?: boolean }): string {
  if (error.network) return "authors.error.network"
  if (error.code) {
    if (ERROR_KEYS[error.code]) return ERROR_KEYS[error.code]
    if (error.code.startsWith("link_")) return "authors.error.link_url"
  }
  if (error.status === 429) return "authors.error.rate_limited"
  if (error.status === 401 || error.status === 403) return "authors.error.signin"
  return "authors.error.generic"
}
