import type { ClaimCandidate, TeamReason } from "@/lib/authors/types"

/** Small pure helpers of the "claim my recordings" screens (no React, so the tests can reach them). */

/** "21:04" from seconds; empty when the length is not known. */
export function clock(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return ""
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

/** A recording can be chosen for a request unless a request of this page is already waiting, approved or refused. */
export function canPick(item: ClaimCandidate): boolean {
  return item.claim_status === null || item.claim_status === "withdrawn"
}

/**
 * The sentence key for why a request goes to the team. One code ends in "_other", which the dictionaries read as a plural
 * form, so that sentence is stored as "taken".
 */
export function reasonKey(reason: TeamReason): string {
  return `authors.claims.reason.${reason === "taken_by_other" ? "taken" : reason}`
}
