import { RemoteError } from "@/lib/kirtan/remote"
import type { Broadcast } from "@/lib/broadcasts/types"

import { reasonOk } from "./rules"
import type { BroadcastReviewBackend, Decision, DecisionAction, ReviewedBroadcast, Suggestion } from "./types"

/**
 * The in-memory stand-in for the team's broadcast desk, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`) and in
 * tests. Nothing reaches a server and nothing survives a reload. The sample data is made up, on example addresses. It follows
 * the API's rules: a hide or a removal needs a reason, a Keep clears the reports and remembers how many people had reported,
 * and every verdict lands in the history.
 */
const HOUR = 3_600_000
const DAY = 24 * HOUR

export function createBroadcastReviewMock(options: { team?: () => boolean; now?: () => number } = {}): BroadcastReviewBackend {
  const team = options.team ?? (() => true)
  const clock = options.now ?? Date.now
  const guard = (): void => {
    if (!team()) throw new RemoteError(403, "Only the team can see this.")
  }
  const at = (hoursAgo: number) => new Date(clock() - hoursAgo * HOUR).toISOString()
  const base = (n: number, title: string, url: string, host: string, provider: Broadcast["provider"]): Broadcast => ({
    id: `mock-review-${n}`,
    provider,
    url,
    host,
    title,
    description: null,
    organizer: null,
    startsAt: at(5),
    timezone: "Europe/Berlin",
    endsAt: new Date(clock() + 9 * DAY).toISOString(),
    endsDeclared: false,
    liveSource: "clock",
    phase: "now",
    archived: false,
    thumbnailUrl: null,
    linkStatus: "unknown",
    status: "published",
    mine: false,
    canEnd: false,
    canRemove: true,
    createdAt: at(5),
    reportsCount: null,
    hidden: null,
    recordings: [],
    recordingAction: null,
  })
  const empty = { counted: 0, open: 0, anonymous: 0, cleared: 0, byReason: {}, notes: [] as string[] }
  const extra = { reviewedAt: null, reviewedBy: null, reviewedReports: 0, hiddenAt: null, hiddenBy: null, hiddenReason: null, removedAt: null, removedBy: null, removedReason: null }
  let items: ReviewedBroadcast[] = [
    { ...base(1, "Free crypto Kiirtan", "https://example.test/watch/free-crypto", "example.test", "other"), ...extra, state: "auto_hidden", hidden: true, hiddenAt: at(2), hiddenBy: "reports", hiddenReason: null, reports: { counted: 3, open: 4, anonymous: 1, cleared: 0, byReason: { spam: 3, not_a_broadcast: 1 }, notes: ["Sample note: an advertisement, not a broadcast."] } },
    { ...base(2, "Evening satsang from the sample centre", "https://us02web.zoom.us/j/81234567890", "us02web.zoom.us", "zoom"), ...extra, state: "reported", reports: { counted: 1, open: 2, anonymous: 1, cleared: 0, byReason: { broken: 2 }, notes: [] } },
    { ...base(3, "Sample class on the meditation lesson", "https://www.youtube.com/watch?v=SampleId003", "youtube.com", "youtube"), ...extra, state: "kept", reviewedAt: at(20), reviewedBy: "Sample team member", reviewedReports: 2, reports: { counted: 1, open: 1, anonymous: 0, cleared: 2, byReason: { offensive: 1 }, notes: [] } },
    { ...base(4, "Old sample stream", "https://example.test/watch/old", "example.test", "other"), ...extra, state: "hidden", hidden: true, hiddenAt: at(50), hiddenBy: "Sample team member", hiddenReason: "The link is a shop, not a broadcast.", reports: { ...empty, cleared: 3 } },
    { ...base(5, "Removed sample stream", "https://example.test/watch/gone", "example.test", "other"), ...extra, status: "removed", state: "removed", removedAt: at(70), removedBy: "Sample team member", removedReason: "Advertising.", reports: { ...empty, cleared: 2 } },
  ]
  let decisions: Decision[] = [
    { id: "d1", broadcastId: "mock-review-4", broadcastTitle: "Old sample stream", action: "hide", reason: "The link is a shop, not a broadcast.", decidedBy: "Sample team member", reportsTotal: 3, reportsCounted: 3, createdAt: at(50) },
    { id: "d2", broadcastId: "mock-review-5", broadcastTitle: "Removed sample stream", action: "remove", reason: "Advertising.", decidedBy: "Sample team member", reportsTotal: 2, reportsCounted: 2, createdAt: at(70) },
    { id: "d3", broadcastId: "mock-review-3", broadcastTitle: "Sample class on the meditation lesson", action: "keep", reason: null, decidedBy: "Sample team member", reportsTotal: 2, reportsCounted: 1, createdAt: at(20) },
  ]
  let suggestions: Suggestion[] = [
    {
      id: "s1",
      broadcastId: "mock-broadcast-2",
      broadcastTitle: "Sunday satsang, last week",
      recording: { id: "s1", kind: "link", provider: "zoom", url: "https://us02web.zoom.us/rec/share/SampleRecording", host: "us02web.zoom.us", recordingId: null, recordingTitle: null, status: "pending", source: "member", mine: false, createdAt: at(6) },
    },
  ]
  const find = (id: string): ReviewedBroadcast => {
    const found = items.find((b) => b.id === id)
    if (!found) throw new RemoteError(404, "Broadcast not found")
    return found
  }
  const decide = (b: ReviewedBroadcast, action: DecisionAction, reason: string | null) => {
    decisions = [{ id: `d-${decisions.length + 1}`, broadcastId: b.id, broadcastTitle: b.title, action, reason, decidedBy: "You", reportsTotal: b.reports.open + b.reports.cleared, reportsCounted: b.reports.counted, createdAt: new Date(clock()).toISOString() }, ...decisions]
  }
  const reasonOrThrow = (raw: string): string => {
    if (!reasonOk(raw)) throw new RemoteError(422, "Write the reason: the author will read it.", { code: "broadcast_reason_needed" })
    return raw.trim().replace(/\s+/g, " ")
  }
  return {
    async queue(which) {
      guard()
      const found = items.filter((b) => (which === "removed" ? b.state === "removed" : which === "hidden" ? b.state === "hidden" : b.state !== "removed" && b.state !== "hidden" && b.reports.open > 0))
      // the ones the reports hid come first
      found.sort((a, b) => Number(b.state === "auto_hidden") - Number(a.state === "auto_hidden") || b.reports.open - a.reports.open)
      return { items: found, total: found.length }
    },
    async decisions() {
      guard()
      return { items: decisions, total: decisions.length }
    },
    async suggestions() {
      guard()
      return { items: suggestions, total: suggestions.length }
    },
    async keep(id) {
      guard()
      const b = find(id)
      if (b.status !== "published") throw new RemoteError(409, "Only a live broadcast can be kept.")
      decide(b, "keep", null)
      Object.assign(b, { state: "kept", hidden: null, hiddenAt: null, hiddenBy: null, hiddenReason: null, reviewedAt: new Date(clock()).toISOString(), reviewedBy: "You", reviewedReports: b.reports.open + b.reports.cleared, reports: { ...b.reports, cleared: b.reports.cleared + b.reports.open, counted: 0, open: 0 } })
    },
    async hide(id, reason) {
      guard()
      const text = reasonOrThrow(reason)
      const b = find(id)
      decide(b, "hide", text)
      Object.assign(b, { state: "hidden", hidden: true, hiddenAt: new Date(clock()).toISOString(), hiddenBy: "You", hiddenReason: text, reports: { ...b.reports, cleared: b.reports.cleared + b.reports.open, counted: 0, open: 0 } })
    },
    async remove(id, reason) {
      guard()
      const text = reasonOrThrow(reason)
      const b = find(id)
      decide(b, "remove", text)
      Object.assign(b, { state: "removed", status: "removed", removedAt: new Date(clock()).toISOString(), removedBy: "You", removedReason: text, reports: { ...b.reports, cleared: b.reports.cleared + b.reports.open, counted: 0, open: 0 } })
    },
    async acceptSuggestion(id) {
      guard()
      if (!suggestions.some((s) => s.id === id)) throw new RemoteError(404, "Recording not found")
      suggestions = suggestions.filter((s) => s.id !== id)
    },
    async rejectSuggestion(id) {
      guard()
      if (!suggestions.some((s) => s.id === id)) throw new RemoteError(404, "Recording not found")
      suggestions = suggestions.filter((s) => s.id !== id)
    },
  }
}
