import type { ReviewedBroadcast, ReviewState, ReviewWhich } from "./types"

/** A hide or a removal needs a reason the author reads: 3 to 500 characters, as the API. */
export const REASON_MIN = 3
export const REASON_MAX = 500

export const reasonOk = (raw: string): boolean => raw.trim().replace(/\s+/g, " ").length >= REASON_MIN

export type ReviewAction = "keep" | "hide" | "remove"

/** What the team can do with a broadcast on each list: keep or hide or remove from the queue; look again at a hidden or removed one. */
export function actionsFor(which: ReviewWhich, item: Pick<ReviewedBroadcast, "state">): readonly ReviewAction[] {
  if (which === "removed") return []
  if (which === "hidden") return ["keep", "remove"]
  return item.state === "hidden" ? ["keep", "remove"] : ["keep", "hide", "remove"]
}

/** The state as a word the card shows next to the title (a sentence in locales/broadcasts.ts, `bc.rv.state.*`). */
export const stateKey = (state: ReviewState): `bc.rv.state.${ReviewState}` => `bc.rv.state.${state}`

/** The number of people who reported, for the card: the ones not judged yet. */
export const peopleReporting = (item: Pick<ReviewedBroadcast, "reports">): number => item.reports.open

/** Reports that came after a Keep, beyond the ones already judged: shown so the team sees what is new. */
export const newSinceKeep = (item: Pick<ReviewedBroadcast, "reports" | "reviewedAt">): number => (item.reviewedAt ? item.reports.open : 0)

/** The reasons the reports gave, biggest first, as `[reason, count]`. */
export function reasonsSorted(byReason: Record<string, number>): [string, number][] {
  return Object.entries(byReason)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
