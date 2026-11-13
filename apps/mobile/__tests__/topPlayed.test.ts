import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RemoteConfig } from "@/lib/kirtan/remote"
import { NetworkError } from "@/lib/kirtan/remote"
import { demoTopPage, createDemoTopPlayedApi } from "@/lib/topPlayed/demo"
import { PAGE_SIZE, formatCount, initialTopState, queryFor, showSince, topReducer, type TopState } from "@/lib/topPlayed/model"
import { loadPopularity, resetPopularityLoad } from "@/lib/topPlayed/popularityLoad"
import { createTopPlayedApi, topPlayedUrl } from "@/lib/topPlayed/remote"
import type { TopItem, TopPage, TopPlayedApi, TopQuery } from "@/lib/topPlayed/types"
import { getPopularity, setPopularity } from "@/lib/radio/popularity"

const item = (rank: number, over: Partial<TopItem> = {}): TopItem => ({
  rank,
  ref: "ps",
  id: String(rank),
  kind: "prabhat_samgiita",
  title: `Song ${rank}`,
  author: "",
  plays: 100 - rank,
  songNumber: rank,
  recording: null,
  ...over,
})
const page = (items: TopItem[], over: Partial<TopPage> = {}): TopPage => ({
  period: "all",
  kinds: [],
  items,
  total: items.length,
  hasMore: false,
  since: "2026-09-01",
  minPlays: 5,
  ...over,
})

describe("top played model", () => {
  it("starts loading on all time, all categories", () => {
    const s = initialTopState()
    expect(s).toMatchObject({ period: "all", kind: "all", status: "loading", items: [] })
    expect(queryFor(s)).toEqual({ period: "all", kinds: [], limit: PAGE_SIZE, offset: 0 })
  })

  it("asks for one kind when a category chip is on", () => {
    const s = topReducer(initialTopState(), { type: "choose", kind: "kiirtan", period: "7d" })
    expect(queryFor(s, 30)).toEqual({ period: "7d", kinds: ["kiirtan"], limit: PAGE_SIZE, offset: 30 })
  })

  it("a new choice resets the list and bumps seq; the same choice changes nothing", () => {
    const s0 = initialTopState()
    const s1 = topReducer(s0, { type: "choose", period: "30d" })
    expect(s1.seq).toBe(s0.seq + 1)
    expect(s1.status).toBe("loading")
    expect(topReducer(s1, { type: "choose", period: "30d" })).toBe(s1)
  })

  it("loaded with rows is ready, loaded with none is empty", () => {
    const s0 = initialTopState()
    const ready = topReducer(s0, { type: "loaded", seq: s0.seq, page: page([item(1), item(2)]), append: false })
    expect(ready.status).toBe("ready")
    expect(ready.items).toHaveLength(2)
    const empty = topReducer(s0, { type: "loaded", seq: s0.seq, page: page([]), append: false })
    expect(empty.status).toBe("empty")
  })

  it("drops an answer that belongs to an older choice", () => {
    const s0 = initialTopState()
    const s1 = topReducer(s0, { type: "choose", kind: "bhajan" })
    const stale = topReducer(s1, { type: "loaded", seq: s0.seq, page: page([item(1)]), append: false })
    expect(stale).toBe(s1)
    expect(topReducer(s1, { type: "failed", seq: s0.seq, append: false })).toBe(s1)
  })

  it("an error shows the error state; retry loads again under a new seq", () => {
    const s0 = initialTopState()
    const failed = topReducer(s0, { type: "failed", seq: s0.seq, append: false })
    expect(failed.status).toBe("error")
    const retry = topReducer(failed, { type: "retry" })
    expect(retry.status).toBe("loading")
    expect(retry.seq).toBe(failed.seq + 1)
  })

  it("paging appends, and a failed page keeps the list", () => {
    let s: TopState = initialTopState()
    s = topReducer(s, { type: "loaded", seq: s.seq, page: page([item(1), item(2)], { hasMore: true }), append: false })
    s = topReducer(s, { type: "more" })
    expect(s.loadingMore).toBe(true)
    expect(topReducer(s, { type: "more" })).toBe(s) // already loading
    const failed = topReducer(s, { type: "failed", seq: s.seq, append: true })
    expect(failed.items).toHaveLength(2)
    expect(failed.moreFailed).toBe(true)
    expect(failed.status).toBe("ready")
    const more = topReducer(s, { type: "loaded", seq: s.seq, page: page([item(3)]), append: true })
    expect(more.items.map((i) => i.rank)).toEqual([1, 2, 3])
    expect(more.hasMore).toBe(false)
    expect(more.loadingMore).toBe(false)
  })

  it("no further page when nothing more is there", () => {
    let s: TopState = initialTopState()
    s = topReducer(s, { type: "loaded", seq: s.seq, page: page([item(1)]), append: false })
    expect(topReducer(s, { type: "more" })).toBe(s)
  })

  it("'counting since' shows on the all-time list (also while it is empty), and on a 7 or 30 day list only while counting is younger than the window", () => {
    const now = Date.parse("2026-11-08T12:00:00Z")
    const ready = { status: "ready" as const, since: "2026-09-01" }
    expect(showSince({ ...ready, period: "all" }, now)).toBe(true)
    expect(showSince({ ...ready, period: "all", since: null }, now)).toBe(false)
    expect(showSince({ status: "empty", since: "2026-09-01", period: "all" }, now)).toBe(true)
    expect(showSince({ status: "loading", since: "2026-09-01", period: "all" }, now)).toBe(false)
    expect(showSince({ status: "error", since: "2026-09-01", period: "all" }, now)).toBe(false)
    // counting began long ago: a full 7 or 30 day window needs no note
    expect(showSince({ ...ready, period: "7d" }, now)).toBe(false)
    expect(showSince({ ...ready, period: "30d" }, now)).toBe(false)
    // counting began 3 days ago: both windows are still thin
    expect(showSince({ ...ready, since: "2026-11-05", period: "7d" }, now)).toBe(true)
    expect(showSince({ ...ready, since: "2026-11-05", period: "30d" }, now)).toBe(true)
    // 20 days ago: the 7 day window is full, the 30 day one is not
    expect(showSince({ ...ready, since: "2026-10-19", period: "7d" }, now)).toBe(false)
    expect(showSince({ ...ready, since: "2026-10-19", period: "30d" }, now)).toBe(true)
  })

  it("groups thousands", () => {
    expect(formatCount(1240)).toBe("1,240")
    expect(formatCount(7)).toBe("7")
  })
})

describe("top played remote", () => {
  it("builds the address with repeated kind parameters", () => {
    expect(topPlayedUrl("https://api.test/", { period: "30d", kinds: ["kiirtan", "bhajan"], limit: 30, offset: 60 })).toBe(
      "https://api.test/api/v1/top-played?period=30d&kind=kiirtan&kind=bhajan&limit=30&offset=60",
    )
    expect(topPlayedUrl("https://api.test", { period: "all", kinds: [], limit: 100, offset: 0 })).toBe(
      "https://api.test/api/v1/top-played?period=all&limit=100&offset=0",
    )
  })

  const cfg = (fetchImpl: typeof fetch): RemoteConfig => ({ baseUrl: "https://api.test", headers: () => ({}), fetch: fetchImpl })
  const query: TopQuery = { period: "all", kinds: [], limit: 30, offset: 0 }

  it("maps the server's page to the phone's", async () => {
    const body = {
      period: "all",
      kinds: [],
      items: [
        { rank: 1, ref: "ps", id: "12", kind: "prabhat_samgiita", title: "Prabhat Samgiita 12", author: "", plays: 40, song_number: 12, recording: null },
        { rank: 2, ref: "rec", id: "uuid-1", kind: "kiirtan", title: "T", author: "A", plays: 9 },
      ],
      total: 2,
      has_more: false,
      since: "2026-09-01",
      min_plays: 5,
    }
    const api = createTopPlayedApi(cfg(vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch))
    const result = await api.fetch(query)
    expect(result.items[0]).toMatchObject({ ref: "ps", songNumber: 12, plays: 40, recording: null })
    expect(result.items[1]).toMatchObject({ ref: "rec", id: "uuid-1", songNumber: null, author: "A" })
    expect(result.hasMore).toBe(false)
    expect(result.minPlays).toBe(5)
    expect(result.since).toBe("2026-09-01")
  })

  it("a network failure is a NetworkError; a 429 or 500 a RemoteError", async () => {
    const down = createTopPlayedApi(cfg((async () => { throw new TypeError("offline") }) as unknown as typeof fetch))
    await expect(down.fetch(query)).rejects.toBeInstanceOf(NetworkError)
    const busy = createTopPlayedApi(cfg((async () => new Response("{}", { status: 429 })) as unknown as typeof fetch))
    await expect(busy.fetch(query)).rejects.toMatchObject({ status: 429, code: "rate_limited" })
    const broken = createTopPlayedApi(cfg((async () => new Response("{}", { status: 500 })) as unknown as typeof fetch))
    await expect(broken.fetch(query)).rejects.toMatchObject({ status: 500 })
  })
})

describe("top played demo", () => {
  it("ranks by plays, with the minimum of five", () => {
    const all = demoTopPage({ period: "all", kinds: [], limit: 100, offset: 0 })
    expect(all.items[0].rank).toBe(1)
    for (let i = 1; i < all.items.length; i += 1) expect(all.items[i - 1].plays).toBeGreaterThanOrEqual(all.items[i].plays)
    expect(all.items.every((i) => i.plays >= 5)).toBe(true)
  })

  it("filters by kind and by period, and pages", () => {
    const kiirtan = demoTopPage({ period: "all", kinds: ["kiirtan"], limit: 100, offset: 0 })
    expect(kiirtan.items.length).toBeGreaterThan(0)
    expect(kiirtan.items.every((i) => i.kind === "kiirtan")).toBe(true)
    const week = demoTopPage({ period: "7d", kinds: [], limit: 100, offset: 0 })
    const all = demoTopPage({ period: "all", kinds: [], limit: 100, offset: 0 })
    expect(week.items.length).toBeLessThanOrEqual(all.items.length)
    expect(week.items[0].plays).toBeLessThan(all.items[0].plays)
    const first = demoTopPage({ period: "all", kinds: [], limit: 10, offset: 0 })
    const second = demoTopPage({ period: "all", kinds: [], limit: 10, offset: 10 })
    expect(first.hasMore).toBe(true)
    expect(second.items[0].rank).toBe(11)
    expect(new Set([...first.items, ...second.items].map((i) => `${i.ref}:${i.id}`)).size).toBe(20)
  })

  it("can answer empty and offline", async () => {
    const api = createDemoTopPlayedApi()
    api.control.setMode("empty")
    expect((await api.fetch({ period: "all", kinds: [], limit: 30, offset: 0 })).items).toEqual([])
    api.control.setMode("error")
    await expect(api.fetch({ period: "all", kinds: [], limit: 30, offset: 0 })).rejects.toBeInstanceOf(NetworkError)
  })
})

describe("popularity load for the radio", () => {
  beforeEach(() => {
    resetPopularityLoad()
    setPopularity(new Map())
  })

  const fake = (pages: TopPage[]): { api: TopPlayedApi; calls: TopQuery[] } => {
    const calls: TopQuery[] = []
    return {
      calls,
      api: {
        fetch: async (q) => {
          calls.push(q)
          return pages[Math.min(calls.length - 1, pages.length - 1)]
        },
      },
    }
  }

  it("reads up to three pages of 100 and fills the map", async () => {
    const f = fake([
      page([item(1, { plays: 50 })], { hasMore: true }),
      page([item(2, { plays: 30 }), item(3, { ref: "rec", id: "uuid-3", plays: 20 })], { hasMore: true }),
      page([item(4, { plays: 10 })], { hasMore: true }),
    ])
    await loadPopularity(f.api, 1_000)
    expect(f.calls.map((c) => c.offset)).toEqual([0, 100, 200])
    expect(f.calls.every((c) => c.limit === 100 && c.period === "all" && c.kinds.length === 0)).toBe(true)
    expect(getPopularity().get("ps:1")).toBe(50)
    expect(getPopularity().get("rec:uuid-3")).toBe(20)
  })

  it("stops when there is no further page, and is not repeated within ten minutes", async () => {
    const f = fake([page([item(1)])])
    await loadPopularity(f.api, 1_000)
    await loadPopularity(f.api, 2_000)
    expect(f.calls).toHaveLength(1)
    await loadPopularity(f.api, 1_000 + 11 * 60_000)
    expect(f.calls).toHaveLength(2)
  })

  it("a failing server leaves the map as it was and does not throw", async () => {
    setPopularity(new Map([["ps:9", 77]]))
    const api: TopPlayedApi = { fetch: async () => { throw new NetworkError("offline") } }
    await expect(loadPopularity(api, 1_000)).resolves.toBeUndefined()
    expect(getPopularity().get("ps:9")).toBe(77)
    // and it can try again at once (nothing was recorded as loaded)
    const f = fake([page([item(1)])])
    await loadPopularity(f.api, 1_500)
    expect(f.calls).toHaveLength(1)
  })
})
