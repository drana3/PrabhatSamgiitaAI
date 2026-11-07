import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const playQueue = vi.hoisted(() => vi.fn(() => ""))
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined), removeItem: vi.fn(async () => undefined) },
}))
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { webBaseUrl: "https://example.test" } } } }))
vi.mock("@/lib/kirtan/mixPlayback", () => ({ playQueue }))

import { allKirtans } from "@/lib/kirtan/catalog"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { fromRemote } from "@/lib/kirtan/submissions"
import { playHistoryEntry } from "@/lib/listening/playAgain"
import { createRadioPicker } from "@/lib/radio/picker"
import { lastPickStillAllowed, liveSource, radioPicker } from "@/lib/radio/live"
import { initialTopState, topReducer, visibleTop } from "@/lib/topPlayed/model"
import { playTopItem } from "@/lib/topPlayed/play"
import type { TopItem, TopPage } from "@/lib/topPlayed/types"
import { useKirtanStore } from "@/stores/kirtanStore"
import { useRadioSelectionStore } from "@/stores/radioSelectionStore"

const remote = (id: string, authorId: string | null, author = `Author ${id}`): RemoteRecording =>
  ({
    id, kind: "kiirtan", type: "other", title: `Rec ${id}`, author, added_by: author, author_id: authorId, by_author: false,
    status: "published", duration_sec: 300, plays: 0, audio_url: `https://a.test/${id}.mp3`, thumbnail_url: null,
    published_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z",
  }) as RemoteRecording

const topItem = (rank: number, rec: RemoteRecording | null, over: Partial<TopItem> = {}): TopItem =>
  rec
    ? { rank, ref: "rec", id: rec.id, kind: "kiirtan", title: rec.title, author: rec.author, plays: 50 - rank, songNumber: null, recording: rec, ...over }
    : { rank, ref: "ps", id: String(rank), kind: "prabhat_samgiita", title: `Song ${rank}`, author: "", plays: 50 - rank, songNumber: rank, recording: null, ...over }

const GOOD = remote("good", "u-good")
const BAD = remote("bad", "u-bad")

beforeEach(() => {
  playQueue.mockClear()
  useKirtanStore.setState({ catalog: [GOOD, BAD].map((r) => fromRemote(r)), submissions: [], blockedAuthorIds: [], blockedNames: {} })
})
afterEach(() => useKirtanStore.getState().reset())

describe("Top Played list and a blocked author", () => {
  const items = [topItem(1, null), topItem(2, BAD), topItem(3, GOOD), topItem(4, null)]

  it("hides the blocked author's recordings, renumbers the ranks and lowers the total", () => {
    const state = { items, total: 10 }
    expect(visibleTop(state, []).items).toHaveLength(4)
    const v = visibleTop(state, ["u-bad"])
    expect(v.items.map((i) => i.id)).toEqual(["1", "good", "4"])
    expect(v.items.map((i) => i.rank)).toEqual([1, 2, 3])
    expect(v.total).toBe(9)
  })

  it("unblocking brings the recording back (the loaded rows are kept)", () => {
    const s = topReducer(initialTopState(), { type: "loaded", seq: 1, append: false, page: { period: "all", kinds: [], items, total: 4, hasMore: false, since: null, minPlays: 5 } as TopPage })
    expect(visibleTop(s, ["u-bad"]).items).toHaveLength(3)
    expect(visibleTop(s, []).items).toHaveLength(4)
  })

  it("a name-blocked author (no account id) is hidden too", () => {
    const named = topItem(2, remote("n", null, "Some Band"))
    expect(visibleTop({ items: [named], total: 1 }, ["name:some band"]).items).toHaveLength(0)
  })
})

describe("playing from Top Played", () => {
  it("does not play a blocked author's recording and does not add it to the library", () => {
    useKirtanStore.setState({ catalog: [], blockedAuthorIds: ["u-bad"] })
    const message = playTopItem([topItem(1, BAD)], 0)
    expect(message).toBeTruthy()
    expect(playQueue).not.toHaveBeenCalled()
    expect(useKirtanStore.getState().catalog).toHaveLength(0)
  })

  it("skips a blocked recording lower in the queue but plays the rest", () => {
    useKirtanStore.setState({ blockedAuthorIds: ["u-bad"] })
    expect(playTopItem([topItem(1, GOOD), topItem(2, BAD), topItem(3, null)], 0)).toBeFalsy()
    const numbers = (playQueue.mock.calls[0] as unknown as [number[]])[0]
    expect(numbers).toHaveLength(2)
    expect(numbers[1]).toBe(3)
  })

  it("plays it again once the author is unblocked", () => {
    useKirtanStore.setState({ catalog: [], blockedAuthorIds: ["u-bad"] })
    playTopItem([topItem(1, BAD)], 0)
    useKirtanStore.getState().unblockAuthor("u-bad")
    expect(playTopItem([topItem(1, BAD)], 0)).toBeFalsy()
    expect(playQueue).toHaveBeenCalledTimes(1)
  })
})

describe("Radio pool and a blocked author", () => {
  const recordingIds = () => liveSource().recordings.map((k) => k.serverId ?? k.id)

  it("never offers a blocked author's recording, and offers it again when unblocked", () => {
    expect(recordingIds()).toEqual(expect.arrayContaining(["good", "bad"]))
    useKirtanStore.getState().blockAuthor("u-bad", "Author bad")
    expect(recordingIds()).toContain("good")
    expect(recordingIds()).not.toContain("bad")
    useKirtanStore.getState().unblockAuthor("u-bad")
    expect(recordingIds()).toContain("bad")
  })

  it("the mix never picks it: 300 picks from a Kiirtan-only choice", () => {
    useKirtanStore.getState().blockAuthor("u-bad", "Author bad")
    const bad = allKirtans().find((k) => k.id.includes("bad"))
    expect(bad).toBeUndefined()
    const picker = createRadioPicker(
      { selected: () => ["kiirtan"], source: liveSource, history: () => [], now: () => 1_000_000, recordingNumber: (id) => id.length },
      7,
    )
    const keys = new Set<string>()
    for (let i = 0; i < 300; i += 1) {
      picker.next(0)
      const last = picker.lastPick()
      if (last) keys.add(last.key)
    }
    expect([...keys].some((k) => k.includes("bad"))).toBe(false)
    expect([...keys].some((k) => k.includes("good"))).toBe(true)
  })

  it("a recording picked as the queued next track stops being allowed once its author is blocked", () => {
    useKirtanStore.setState({ catalog: [BAD].map((r) => fromRemote(r)) })
    useRadioSelectionStore.setState({ selected: ["kiirtan"] })
    radioPicker().reset(3)
    expect(radioPicker().next(0)).not.toBeNull()
    expect(radioPicker().lastPick()?.key).toContain("bad")
    expect(lastPickStillAllowed()).toBe(true)
    useKirtanStore.getState().blockAuthor("u-bad")
    expect(lastPickStillAllowed()).toBe(false)
    useKirtanStore.getState().unblockAuthor("u-bad")
    expect(lastPickStillAllowed()).toBe(true)
  })
})

describe("listening history replay and a blocked author", () => {
  const entry = (id: string) => ({ itemKey: `rec:${id}`, ref: "rec", itemId: id, at: 1 }) as unknown as Parameters<typeof playHistoryEntry>[0]

  it("does not replay a blocked author's recording; replays after unblocking", () => {
    const k = fromRemote(BAD)
    useKirtanStore.setState({ catalog: [k] })
    useKirtanStore.setState({ blockedAuthorIds: ["u-bad"] })
    expect(playHistoryEntry(entry(k.id))).toBeTruthy()
    expect(playQueue).not.toHaveBeenCalled()
    useKirtanStore.getState().unblockAuthor("u-bad")
    playHistoryEntry(entry(k.id))
    expect(playQueue).toHaveBeenCalledTimes(1)
  })
})
