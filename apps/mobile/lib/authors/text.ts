import type { TranslateFn } from "@/lib/i18n/core"

/**
 * `t` for a key that is built at run time (an error code, a slug problem, a kind). The typed `t` only takes keys it can
 * see in the English file; the codes come from the server, so those go through here. A missing key shows as the key
 * itself in development, and the tests (authorsLocales.test.ts) check that every code has its sentence.
 */
export function say(t: TranslateFn, key: string, params?: Record<string, string | number>): string {
  return (t as unknown as (k: string, p?: Record<string, string | number>) => string)(key, params)
}

const REVIEW_REASONS = new Set(["protected_name", "artist_claim", "look_alike_page", "look_alike_artist"])

/** The sentence key for why a page waits for the team (`review_reason` of the API; "reported:<why>" after reports). */
export function reviewKey(reason: string | null | undefined): string {
  if (!reason) return "authors.review.generic"
  if (REVIEW_REASONS.has(reason)) return `authors.review.${reason}`
  if (reason.startsWith("reported:")) return "authors.review.reported"
  return "authors.review.generic"
}
