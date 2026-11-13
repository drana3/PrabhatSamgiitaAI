import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {}, multiRemove: async () => {}, getAllKeys: async () => [] },
}))

// the mark's fetch reaches the network layer and the app's config, which this test does not load
vi.mock("@/lib/kirtan/api", () => ({ remoteConfig: () => ({}), canUseServer: () => false }))
vi.mock("@/lib/mockupMode", () => ({ MOCKUP_DATA: false }))

import { BROADCAST_NOTICE_KINDS, broadcastItem, broadcastItems, syncBroadcastNotices } from "@/lib/broadcasts/notices"
import { createBroadcastReviewMock } from "@/lib/broadcastReview/mock"
import { broadcastReviewRemote, reviewFailureFromError, reviewedFromWire, summaryFromWire, type WireReviewed } from "@/lib/broadcastReview/remote"
import { actionsFor, newSinceKeep, reasonOk, reasonsSorted, stateKey } from "@/lib/broadcastReview/rules"
import { NetworkError, RemoteError, type RemoteConfig, type RemoteNotice } from "@/lib/kirtan/remote"
import { setActiveLanguage } from "@/lib/i18n"
import { fromBroadcastOf } from "@/lib/broadcasts/fromBroadcast"

/** The team's desk for broadcasts: rules, the wire, the preview backend, and what the author reads afterwards. */

describe("what the team can do", () => {
  const item = (state: "reported" | "auto_hidden" | "hidden" | "removed" | "kept") => ({ state })

  it("offers Keep, Hide and Remove on the queue, and no Hide on one that is hidden already", () => {
    expect(actionsFor("queue", item("reported"))).toEqual(["keep", "hide", "remove"])
    expect(actionsFor("queue", item("kept"))).toEqual(["keep", "hide", "remove"])
    expect(actionsFor("queue", item("hidden"))).toEqual(["keep", "remove"])
    expect(actionsFor("hidden", item("hidden"))).toEqual(["keep", "remove"])
    expect(actionsFor("removed", item("removed"))).toEqual([])
  })

  it("wants a reason of at least three characters, spaces not counted twice", () => {
    expect(reasonOk("")).toBe(false)
    expect(reasonOk("  ab ")).toBe(false)
    expect(reasonOk("an ad")).toBe(true)
    expect(reasonOk("abc")).toBe(true)
  })

  it("counts only the reports that came after a Keep", () => {
    const reports = { counted: 1, open: 2, anonymous: 0, cleared: 3, byReason: {}, notes: [] }
    expect(newSinceKeep({ reports, reviewedAt: "2026-11-09T10:00:00Z" })).toBe(2)
    expect(newSinceKeep({ reports, reviewedAt: null })).toBe(0)
  })

  it("sorts the reasons, biggest first, and drops the empty ones", () => {
    expect(reasonsSorted({ spam: 1, broken: 3, offensive: 0, zeta: 1 })).toEqual([["broken", 3], ["spam", 1], ["zeta", 1]])
    expect(stateKey("auto_hidden")).toBe("bc.rv.state.auto_hidden")
  })
})

describe("the wire of the desk", () => {
  const base = {
    id: "b1", provider: "zoom", url: "https://zoom.us/j/1", host: "zoom.us", title: "T", description: null, organizer: null, starts_at: null, timezone: null, ends_at: "2026-11-20T10:00:00Z", phase: "now", archived: false,
    thumbnail_url: null, link_status: "unknown", status: "published", mine: false, can_end: false, can_remove: true, created_at: "2026-11-09T10:00:00Z",
  } as const

  it("reads the summary and refuses nonsense numbers", () => {
    expect(summaryFromWire({ counted: 2, open: 3.9, anonymous: -1, cleared: "x" as never, by_reason: { spam: 2, broken: 0 }, notes: ["ok", " ", 5 as never] })).toEqual({ counted: 2, open: 3, anonymous: 0, cleared: 0, byReason: { spam: 2 }, notes: ["ok"] })
    expect(summaryFromWire(null)).toEqual({ counted: 0, open: 0, anonymous: 0, cleared: 0, byReason: {}, notes: [] })
  })

  it("reads a reviewed broadcast, with the reviewed mark, and treats an unknown state as reported", () => {
    const wire = { ...base, state: "kept", reports: { open: 1, cleared: 2 }, reviewed_at: "2026-11-09T11:00:00Z", reviewed_by: "A", reviewed_reports: 2 } as WireReviewed
    expect(reviewedFromWire(wire)).toMatchObject({ state: "kept", reviewedAt: "2026-11-09T11:00:00Z", reviewedBy: "A", reviewedReports: 2, reports: { open: 1, cleared: 2 } })
    expect(reviewedFromWire({ ...wire, state: "weird" as never }).state).toBe("reported")
  })

  it("calls the right addresses with the right bodies", async () => {
    const calls: string[] = []
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url.replace("https://api.test", "")} ${init?.body ?? ""}`.trim())
      const body = url.includes("/review") ? { items: [{ ...base, state: "reported", reports: { open: 1 } }], total: 1 } : url.includes("/decisions") || url.includes("recording-suggestions?") ? { items: [], total: 0 } : {}
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    const cfg: RemoteConfig = { baseUrl: "https://api.test", headers: () => ({}), fetch: fetch as unknown as typeof globalThis.fetch }
    const api = broadcastReviewRemote(cfg)
    expect((await api.queue("queue")).items[0]).toMatchObject({ id: "b1", state: "reported" })
    await api.decisions()
    await api.suggestions()
    await api.keep("b1")
    await api.hide("b1", "an ad")
    await api.remove("b/2", "spam")
    await api.acceptSuggestion("l1")
    await api.rejectSuggestion("l2")
    expect(calls).toEqual([
      "GET /api/v1/broadcasts/review?which=queue&limit=50",
      "GET /api/v1/broadcasts/decisions?limit=50",
      "GET /api/v1/broadcasts/recording-suggestions?limit=50",
      "POST /api/v1/broadcasts/b1/keep",
      'POST /api/v1/broadcasts/b1/hide {"reason":"an ad"}',
      'POST /api/v1/broadcasts/b%2F2/remove {"reason":"spam"}',
      "POST /api/v1/broadcasts/recording-suggestions/l1/accept",
      "POST /api/v1/broadcasts/recording-suggestions/l2/reject",
    ])
  })

  it("turns an error into one word", () => {
    expect(reviewFailureFromError(new NetworkError("x"))).toBe("network")
    expect(reviewFailureFromError(new RemoteError(403, "no"))).toBe("denied")
    expect(reviewFailureFromError(new RemoteError(401, "no"))).toBe("denied")
    expect(reviewFailureFromError(new RemoteError(404, "no"))).toBe("gone")
    expect(reviewFailureFromError(new RemoteError(409, "no"))).toBe("conflict")
    expect(reviewFailureFromError(new RemoteError(422, "no", { code: "broadcast_reason_needed" }))).toBe("reasonNeeded")
    expect(reviewFailureFromError(new RemoteError(500, "no"))).toBe("server")
    expect(reviewFailureFromError(new Error("x"))).toBe("server")
  })
})

describe("the preview desk follows the API's rules", () => {
  it("is for the team only", async () => {
    const desk = createBroadcastReviewMock({ team: () => false })
    await expect(desk.queue("queue")).rejects.toMatchObject({ status: 403 })
  })

  it("puts the broadcast the reports hid first, and shows anonymous reports that did not count", async () => {
    const desk = createBroadcastReviewMock()
    const { items } = await desk.queue("queue")
    expect(items[0]).toMatchObject({ state: "auto_hidden" })
    expect(items[0]!.reports.anonymous).toBeGreaterThan(0)
    expect(items[0]!.reports.open).toBeGreaterThan(items[0]!.reports.counted)
  })

  it("needs a reason to hide or remove, and writes every verdict to the history", async () => {
    const desk = createBroadcastReviewMock()
    const before = (await desk.decisions()).total
    await expect(desk.hide("mock-review-2", " ")).rejects.toMatchObject({ status: 422, code: "broadcast_reason_needed" })
    await expect(desk.remove("mock-review-2", "")).rejects.toMatchObject({ code: "broadcast_reason_needed" })
    expect((await desk.decisions()).total).toBe(before)
    await desk.hide("mock-review-2", "  not   a broadcast ")
    expect((await desk.queue("hidden")).items.find((b) => b.id === "mock-review-2")).toMatchObject({ hiddenReason: "not a broadcast" })
    await desk.remove("mock-review-1", "advertising")
    expect((await desk.queue("removed")).items.map((b) => b.id)).toContain("mock-review-1")
    const history = await desk.decisions()
    expect(history.total).toBe(before + 2)
    expect(history.items[0]).toMatchObject({ action: "remove", reason: "advertising" })
  })

  it("marks a broadcast as reviewed after Keep, and leaves the queue until somebody else reports", async () => {
    const desk = createBroadcastReviewMock()
    await desk.keep("mock-review-2")
    const kept = [...(await desk.queue("queue")).items, ...(await desk.queue("hidden")).items].find((b) => b.id === "mock-review-2")
    expect(kept).toBeUndefined() // nothing open any more
    const history = (await desk.decisions()).items[0]!
    expect(history).toMatchObject({ action: "keep", broadcastId: "mock-review-2", reason: null, reportsTotal: 2 })
  })

  it("shows the Keep of an auto-hidden broadcast as shown again, with the reports cleared", async () => {
    const desk = createBroadcastReviewMock()
    await desk.keep("mock-review-1")
    expect((await desk.queue("queue")).items.map((b) => b.id)).not.toContain("mock-review-1")
  })

  it("takes a suggested recording off the list when it is judged", async () => {
    const desk = createBroadcastReviewMock()
    expect((await desk.suggestions()).total).toBe(1)
    await desk.acceptSuggestion("s1")
    expect((await desk.suggestions()).total).toBe(0)
    await expect(desk.rejectSuggestion("s1")).rejects.toMatchObject({ status: 404 })
  })
})

describe("what the author reads", () => {
  const notice = (id: string, kind: string, payload: Record<string, unknown>, extra: Partial<RemoteNotice> = {}): RemoteNotice => ({
    id, kind, recording_id: null, title: "x", body: "x", payload, created_at: "2026-11-08T09:00:00Z", read_at: null, ...extra,
  })

  beforeEach(async () => {
    setActiveLanguage("en")
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    useNotificationsStore.getState().reset()
  })

  it("tells the author of a hiding, with the reason, and opens the broadcast", () => {
    const item = broadcastItem(notice("n1", "broadcast_hidden", { broadcast_id: "b1", broadcast_title: "Friday satsang", reason: "The link is a shop." }))
    expect(item).toMatchObject({ id: "broadcast:n1", kind: "upload", target: "/broadcast/b1", title: "Your broadcast is hidden" })
    expect(item?.text).toBe("The team hid “Friday satsang” from the lists. Reason: The link is a shop.")
  })

  it("sends a removal to the author's own list, and a restoring to the broadcast, with no reason", () => {
    expect(broadcastItem(notice("n2", "broadcast_removed", { broadcast_id: "b1", broadcast_title: "T", reason: "Advertising." }))).toMatchObject({ target: "/broadcasts?tab=mine", text: "The team removed “T”. Reason: Advertising." })
    expect(broadcastItem(notice("n3", "broadcast_restored", { broadcast_id: "b1", broadcast_title: "T", reason: "ignored" }))).toMatchObject({ target: "/broadcast/b1", text: "The team looked again: “T” is back on the lists." })
  })

  it("never puts a strange id into a route, and skips what is malformed or of another kind", () => {
    expect(broadcastItem(notice("a", "broadcast_hidden", { broadcast_id: "../x", broadcast_title: "T" }))).toBeNull()
    expect(broadcastItem(notice("b", "broadcast_hidden", { broadcast_id: "b1" }))).toBeNull()
    expect(broadcastItem(notice("c", "broadcast_hidden", { broadcast_id: "b1", broadcast_title: "T" }, { created_at: "nonsense" }))).toBeNull()
    expect(broadcastItem(notice("d", "comment_reply", { broadcast_id: "b1", broadcast_title: "T" }))).toBeNull()
    expect(broadcastItems([notice("e", "comment_reply", {}), notice("f", "broadcast_removed", { broadcast_id: "b1", broadcast_title: "T" })]).map((i) => i.id)).toEqual(["broadcast:f"])
    expect(BROADCAST_NOTICE_KINDS).toHaveLength(3)
  })

  it("speaks the person's language", () => {
    setActiveLanguage("ru")
    expect(broadcastItem(notice("n1", "broadcast_hidden", { broadcast_id: "b1", broadcast_title: "T", reason: "Реклама" }))?.text).toContain("Реклама")
    setActiveLanguage("en")
  })

  it("puts only the broadcast notices in the centre, and marks only those read", async () => {
    const calls: string[] = []
    const recent = { created_at: new Date(Date.now() - 3_600_000).toISOString() }
    const list = [
      notice("n1", "broadcast_hidden", { broadcast_id: "b1", broadcast_title: "T", reason: "x y z" }, recent),
      notice("n2", "comment_reply", { parent_id: "c-1" }, recent),
    ]
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url.replace("http://api.test", "")}`)
      return new Response(JSON.stringify((init?.method ?? "GET") === "GET" ? list : list[0]), { status: 200, headers: { "Content-Type": "application/json" } })
    })
    const cfg: RemoteConfig = { baseUrl: "http://api.test", headers: () => ({}), fetch: fetch as unknown as typeof globalThis.fetch }
    expect(await syncBroadcastNotices(cfg)).toBe(1)
    expect(calls).toEqual(["GET /api/v1/recordings/notices?unread_only=true", "POST /api/v1/recordings/notices/n1/read"])
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(["broadcast:n1"])
  })

  it("never throws when the server is out of reach", async () => {
    const cfg: RemoteConfig = { baseUrl: "http://api.test", headers: () => ({}), fetch: (async () => { throw new Error("offline") }) as unknown as typeof globalThis.fetch }
    await expect(syncBroadcastNotices(cfg)).resolves.toBe(0)
  })
})

describe("the mark on the recording page", () => {
  it("takes a well-formed mark and nothing else", () => {
    expect(fromBroadcastOf({ from_broadcast: { id: "b-1", title: " Friday satsang ", date: "2026-11-09" } })).toEqual({ id: "b-1", title: "Friday satsang", date: "2026-11-09" })
    expect(fromBroadcastOf({ from_broadcast: null })).toBeNull()
    expect(fromBroadcastOf({})).toBeNull()
    expect(fromBroadcastOf(null)).toBeNull()
    expect(fromBroadcastOf({ from_broadcast: { id: "../x", title: "T", date: "d" } })).toBeNull()
    expect(fromBroadcastOf({ from_broadcast: { id: "b1", title: " ", date: "d" } })).toBeNull()
    expect(fromBroadcastOf({ from_broadcast: { id: "b1", title: "T" } })).toBeNull()
  })
})
