/**
 * The team's review desk (apps/api: recording chord sheets `/review/*`, song and recording comments `/review` + `/keep` +
 * `/restore`, video links `/review` + `/keep` + `/restore`). One screen, three tabs; every item can be approved,
 * removed or restored. Only the team sees any of it: the server decides (a refusal is "denied"), the app stores nothing.
 */
export type ReviewTab = "sheets" | "comments" | "videos"

/** `open`: what waits for a decision (waiting chord sheets, reported comments, reported links). `removed`: what the team took down, to restore a mistake. */
export type ReviewList = "open" | "removed"

export const REVIEW_TABS: readonly ReviewTab[] = ["sheets", "comments", "videos"]

/** What an item hangs on: a song number or a recording id. */
export type ReviewPlace = { kind: "song"; number: number } | { kind: "recording"; id: string }

/** Which API an item belongs to (they have different addresses). */
export type ReviewSource = "recordingSheet" | "songComment" | "recordingComment" | "video"

export type ReviewItem = {
  /** unique across sources: `${source}:${id}` */
  key: string
  id: string
  source: ReviewSource
  tab: ReviewTab
  place: ReviewPlace
  /** the text to judge: a comment, the first lines of a chord sheet, the address of a link */
  text: string
  /** a chord sheet: the instrument; a video: its title; else null */
  heading: string | null
  /** the team sees the author even when the item is anonymous */
  authorName: string
  isAnonymous: boolean
  reportsCount: number
  createdAt: string
  /** a reply to another comment */
  isReply: boolean
  /** the reason shown to the author of a rejected chord sheet, or the reason of a removal */
  reason: string | null
  list: ReviewList
}

export type ReviewPage = { items: ReviewItem[]; total: number }

export type ReviewAction = "approve" | "remove" | "restore"

export type ReviewFailure = "denied" | "network" | "gone" | "conflict" | "reasonNeeded" | "server"

export type Counts = Record<ReviewTab, number>

export interface TeamReviewBackend {
  list(tab: ReviewTab, list: ReviewList): Promise<ReviewPage>
  /** how many items wait in each tab (the badges) */
  counts(): Promise<Counts>
  /** approve (the item stays and leaves the queue), remove (with a reason; required for a chord sheet), restore */
  act(item: ReviewItem, action: ReviewAction, reason?: string): Promise<void>
}
