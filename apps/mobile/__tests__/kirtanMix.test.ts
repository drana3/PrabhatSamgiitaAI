import { describe, expect, it } from "vitest"

import { KIRTAN_FIXTURES, MIX_FIXTURES } from "@/lib/fixtures/kirtan"
import { filterKirtans, formatKirtanLength, kirtanSubline, newestFirst, typesInUse } from "@/lib/kirtan/list"
import { handoffAfter, handoffPrompt, itemKey, mixCaption, playableItems, runFrom, type MixItem } from "@/lib/kirtan/mix"
import { nextAfter, playNext, positionLabel, previousBefore } from "@/lib/kirtan/queue"
import { isVideoId } from "@/lib/kirtan/youtube"

const ps = (number: number): MixItem => ({ kind: "ps", number })
const k = (id: string): MixItem => ({ kind: "kirtan", id })

describe("fixtures", () => {
  it("have valid ids, unique ids, and mixes that point at known kirtans", () => {
    expect(KIRTAN_FIXTURES.every((x) => isVideoId(x.videoId))).toBe(true)
    expect(new Set(KIRTAN_FIXTURES.map((x) => x.id)).size).toBe(KIRTAN_FIXTURES.length)
    const known = new Set(KIRTAN_FIXTURES.map((x) => x.id))
    for (const mix of MIX_FIXTURES) {
      for (const item of mix.items) if (item.kind === "kirtan") expect(known.has(item.id)).toBe(true)
    }
  })

  it("has the four system mixes with the promised makeup", () => {
    expect(MIX_FIXTURES.map((m) => m.title)).toEqual(["Morning", "Dipavali", "Evening meditation", "Kirtan only: Baba Nam Kevalam"])
    expect(mixCaption(MIX_FIXTURES[0].items)).toBe("3 songs + 2 kirtans")
    expect(MIX_FIXTURES[3].items.every((i) => i.kind === "kirtan")).toBe(true)
  })
})

describe("kirtan list", () => {
  it("formats length and subline", () => {
    expect(formatKirtanLength(760)).toBe("12:40")
    expect(formatKirtanLength(3725)).toBe("1:02:05")
    expect(kirtanSubline({ durationSec: 760, addedBy: "Priya" })).toBe("YouTube · 12:40 · added by Priya")
    expect(kirtanSubline({ durationSec: null, addedBy: "" })).toBe("YouTube")
  })

  it("filters by type and sorts newest first", () => {
    expect(filterKirtans(KIRTAN_FIXTURES, "all")).toHaveLength(KIRTAN_FIXTURES.length)
    expect(filterKirtans(KIRTAN_FIXTURES, "lila").every((x) => x.type === "lila")).toBe(true)
    const sorted = newestFirst(KIRTAN_FIXTURES)
    expect(sorted[0].addedAt).toBeGreaterThanOrEqual(sorted[1].addedAt)
    expect(typesInUse(KIRTAN_FIXTURES)).toEqual(["all", "bnk", "lila", "festival", "other"])
  })
})

describe("mix ordering", () => {
  const items = [ps(2), ps(3), k("a"), ps(1), k("b")]

  it("captions with singular and plural", () => {
    expect(mixCaption(items)).toBe("3 songs + 2 kirtans")
    expect(mixCaption([ps(1)])).toBe("1 song")
    expect(mixCaption([k("a"), k("b")])).toBe("2 kirtans")
    expect(mixCaption([])).toBe("Empty")
  })

  it("keys items so a song and a kirtan never collide", () => {
    expect(itemKey(ps(3))).toBe("ps-3")
    expect(itemKey(k("3"))).toBe("k-3")
  })

  it("drops kirtans that are not approved, keeping the order", () => {
    const status = new Map([
      ["a", { status: "approved" as const }],
      ["b", { status: "pending" as const }],
    ])
    expect(playableItems(items, status)).toEqual([ps(2), ps(3), k("a"), ps(1)])
  })

  it("groups the run of one kind that starts at an index", () => {
    expect(runFrom(items, 0)).toMatchObject({ kind: "ps", start: 0, end: 1 })
    expect(runFrom(items, 0)?.items).toEqual([ps(2), ps(3)])
    expect(runFrom(items, 2)).toMatchObject({ kind: "kirtan", start: 2, end: 2 })
    expect(runFrom(items, 9)).toBeNull()
  })

  it("continues in the same player and switches when the kind changes", () => {
    expect(handoffAfter(items, 0)).toEqual({ action: "continue", index: 1, item: ps(3) })
    expect(handoffAfter(items, 1)).toEqual({ action: "switch", index: 2, item: k("a"), to: "kirtan-player" })
    expect(handoffAfter(items, 2)).toEqual({ action: "switch", index: 3, item: ps(1), to: "song-player" })
    expect(handoffAfter(items, 4)).toEqual({ action: "done" })
    expect(handoffAfter([], 0)).toEqual({ action: "done" })
  })

  it("words the prompt", () => {
    expect(handoffPrompt("Baba Nam Kevalam", "kirtan-player")).toBe("Next: Baba Nam Kevalam (opens kirtan player)")
    expect(handoffPrompt("Bandhu He", "song-player")).toBe("Next: Bandhu He (opens song player)")
  })
})

describe("kirtan queue", () => {
  const state = { context: ["a", "b", "c"], queued: [] as string[] }

  it("plays next in front, without duplicates", () => {
    expect(playNext(["x", "y"], "z")).toEqual(["z", "x", "y"])
    expect(playNext(["x", "y"], "y")).toEqual(["y", "x"])
  })

  it("goes through the list and takes the queue first", () => {
    expect(nextAfter(state, "a")).toEqual({ id: "b", fromQueue: false })
    expect(nextAfter(state, "c")).toBeNull()
    expect(nextAfter({ ...state, queued: ["q"] }, "a")).toEqual({ id: "q", fromQueue: true })
    expect(nextAfter(state, null)).toEqual({ id: "a", fromQueue: false })
    expect(previousBefore(state, "b")).toBe("a")
    expect(previousBefore(state, "a")).toBeNull()
    expect(positionLabel(state.context, "b")).toBe("2 of 3")
    expect(positionLabel(state.context, "zz")).toBe("")
  })
})
