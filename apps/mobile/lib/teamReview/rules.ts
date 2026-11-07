import type { ReviewAction, ReviewItem, ReviewTab } from "./types"

/** A chord sheet that is turned down needs a reason its author reads (3 to 500 characters, as the API). */
export const SHEET_REASON_MIN = 3
export const REASON_MAX = 500

export function reasonProblem(item: Pick<ReviewItem, "source">, raw: string): "short" | null {
  if (item.source === "recordingSheet" && raw.trim().length < SHEET_REASON_MIN) return "short"
  return null
}

/** What can be done with an item: an open one is approved or removed; a removed one is restored. */
export function actionsFor(item: Pick<ReviewItem, "list">): readonly ReviewAction[] {
  return item.list === "open" ? ["approve", "remove"] : ["restore"]
}

/** The first lines of a chord sheet for the card (the whole chart is on the recording page). */
export function sheetPreview(body: string, lines = 4): string {
  return body
    .split("\n")
    .slice(0, lines)
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
}

/** The tab's badge: nothing for zero, "99+" past 99. */
export function badgeLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null
  return count > 99 ? "99+" : String(Math.floor(count))
}

export function tabTotal(counts: Record<ReviewTab, number>): number {
  return counts.sheets + counts.comments + counts.videos
}
