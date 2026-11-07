import { RemoteError } from "@/lib/kirtan/remote"

import { reasonProblem } from "./rules"
import type { Counts, ReviewAction, ReviewItem, ReviewList, ReviewPage, ReviewTab, TeamReviewBackend } from "./types"

/**
 * The in-memory stand-in for the review desk, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`) and in tests.
 * Nothing reaches a server and nothing survives a reload. The items are sample text for the preview; a real build never
 * shows them. It follows the same rules as the API: approve only for open items, restore only for removed ones, a
 * chord sheet is removed with a reason of at least three characters.
 */
const HOUR = 3_600_000

function seed(now: number): ReviewItem[] {
  const at = (hoursAgo: number): string => new Date(now - hoursAgo * HOUR).toISOString()
  const base = { isReply: false, reason: null, heading: null, isAnonymous: false, reportsCount: 0 }
  return [
    { ...base, key: "recordingSheet:s1", id: "s1", source: "recordingSheet", tab: "sheets", place: { kind: "recording", id: "rec-1" }, text: "Am        F\nSample chord sheet for the preview\nC         G\nSecond line of the sample", heading: "guitar", authorName: "Preview member", createdAt: at(3), list: "open" },
    { ...base, key: "recordingSheet:s2", id: "s2", source: "recordingSheet", tab: "sheets", place: { kind: "recording", id: "rec-2" }, text: "D   A\nAnother sample sheet", heading: "harmonium", authorName: "Sample author", isAnonymous: true, createdAt: at(30), list: "open" },
    { ...base, key: "recordingSheet:s3", id: "s3", source: "recordingSheet", tab: "sheets", place: { kind: "recording", id: "rec-3" }, text: "G   C\nA sheet that was turned down", heading: "guitar", authorName: "Sample author", reason: "The chords do not match the recording.", createdAt: at(80), list: "removed" },
    { ...base, key: "songComment:c1", id: "c1", source: "songComment", tab: "comments", place: { kind: "song", number: 19 }, text: "Sample reported comment for the preview.", authorName: "Preview member", reportsCount: 2, createdAt: at(5), list: "open" },
    { ...base, key: "recordingComment:c2", id: "c2", source: "recordingComment", tab: "comments", place: { kind: "recording", id: "rec-1" }, text: "Sample reported reply for the preview.", authorName: "Sample author", isAnonymous: true, isReply: true, reportsCount: 1, createdAt: at(12), list: "open" },
    { ...base, key: "songComment:c3", id: "c3", source: "songComment", tab: "comments", place: { kind: "song", number: 120 }, text: "Sample comment the team removed.", authorName: "Sample author", reason: "Advertising", createdAt: at(60), list: "removed" },
    { ...base, key: "video:v1", id: "v1", source: "video", tab: "videos", place: { kind: "recording", id: "rec-2" }, text: "https://www.youtube.com/watch?v=sample", heading: "Sample video title", authorName: "Preview member", reportsCount: 3, createdAt: at(8), list: "open" },
    { ...base, key: "video:v2", id: "v2", source: "video", tab: "videos", place: { kind: "song", number: 7 }, text: "https://vimeo.com/123456", heading: null, authorName: "Sample author", reason: "Not about this song", createdAt: at(90), list: "removed" },
  ]
}

export function createTeamReviewMock(options: { team?: () => boolean; now?: () => number } = {}): TeamReviewBackend {
  const team = options.team ?? (() => true)
  let items = seed((options.now ?? Date.now)())
  const guard = (): void => {
    if (!team()) throw new RemoteError(403, "Only the team can see this.")
  }
  const open = (tab: ReviewTab): ReviewItem[] => items.filter((i) => i.tab === tab && i.list === "open")
  return {
    async list(tab, which): Promise<ReviewPage> {
      guard()
      const found = items.filter((i) => i.tab === tab && i.list === which).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return { items: found, total: found.length }
    },
    async counts(): Promise<Counts> {
      guard()
      return { sheets: open("sheets").length, comments: open("comments").length, videos: open("videos").length }
    },
    async act(item, action: ReviewAction, reason) {
      guard()
      const found = items.find((i) => i.key === item.key)
      if (!found) throw new RemoteError(404, "Not found")
      const wanted: ReviewList = action === "restore" ? "removed" : "open"
      if (found.list !== wanted) throw new RemoteError(409, "Already done")
      if (action === "remove" && reasonProblem(found, reason ?? "")) throw new RemoteError(422, "Give a reason")
      items =
        action === "approve"
          ? items.filter((i) => i.key !== found.key)
          : items.map((i) => (i.key === found.key ? { ...i, list: action === "remove" ? "removed" : "open", reason: action === "remove" ? ((reason ?? "").trim() || null) : null, reportsCount: 0 } : i))
    },
  }
}
