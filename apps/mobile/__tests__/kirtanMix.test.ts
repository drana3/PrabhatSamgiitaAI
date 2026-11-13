import { describe, expect, it } from "vitest"

import { KIRTAN_FIXTURES, MIX_FIXTURES } from "@/lib/fixtures/kirtan"
import { filterKirtans, formatKirtanLength, kirtanSubline, newestFirst, typesInUse } from "@/lib/kirtan/list"
import { itemKey, mixCaption, playableItems, type MixItem } from "@/lib/kirtan/mix"

const ps = (number: number): MixItem => ({ kind: "ps", number })
const k = (id: string): MixItem => ({ kind: "kirtan", id })

describe("fixtures", () => {
  it("have valid ids, unique ids, and mixes that point at known kirtans", () => {
    expect(KIRTAN_FIXTURES.every((x) => x.title.trim() && (x.author.trim() || x.kind === "bhajan") && x.addedBy.trim())).toBe(true)
    expect(new Set(KIRTAN_FIXTURES.map((x) => x.id)).size).toBe(KIRTAN_FIXTURES.length)
    const known = new Set(KIRTAN_FIXTURES.map((x) => x.id))
    for (const mix of MIX_FIXTURES) {
      for (const item of mix.items) if (item.kind === "kirtan") expect(known.has(item.id)).toBe(true)
    }
  })

  it("has the four system mixes with the promised makeup", () => {
    expect(MIX_FIXTURES.map((m) => m.title)).toEqual(["Morning", "Dipavali", "Evening meditation", "Kiirtan only: Baba Nam Kevalam"])
    expect(mixCaption(MIX_FIXTURES[0].items)).toBe("3 songs + 2 kiirtans")
    expect(MIX_FIXTURES[3].items.every((i) => i.kind === "kirtan")).toBe(true)
  })
})

describe("kirtan list", () => {
  it("formats length and subline", () => {
    expect(formatKirtanLength(760)).toBe("12:40")
    expect(formatKirtanLength(3725)).toBe("1:02:05")
    expect(kirtanSubline({ durationSec: 760, addedBy: "Priya" })).toBe("12:40 · added by Priya")
    expect(kirtanSubline({ durationSec: null, addedBy: "" })).toBe("")
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
    expect(mixCaption(items)).toBe("3 songs + 2 kiirtans")
    expect(mixCaption([ps(1)])).toBe("1 song")
    expect(mixCaption([k("a"), k("b")])).toBe("2 kiirtans")
    expect(mixCaption([])).toBe("Empty")
  })

  it("keys items so a song and a kirtan never collide", () => {
    expect(itemKey(ps(3))).toBe("ps-3")
    expect(itemKey(k("3"))).toBe("k-3")
  })

  it("drops kirtans that are not published, keeping the order", () => {
    const status = new Map([
      ["a", { status: "published" as const }],
      ["b", { status: "failed" as const }],
    ])
    expect(playableItems(items, status)).toEqual([ps(2), ps(3), k("a"), ps(1)])
  })
})


describe("counted captions follow the language", () => {
  it("uses Russian plural forms", async () => {
    const { translatorFor } = await import("@/lib/i18n")
    const ru = translatorFor("ru")
    expect(mixCaption([ps(1), ps(2), ps(3), ps(4), ps(5)], ru)).toBe("5 песен")
    expect(mixCaption([ps(1), k("a")], ru)).toBe(`${ru("songs.count", { count: 1 })} + ${ru("kind.kiirtan.count", { count: 1 })}`)
    expect(mixCaption([], ru)).toBe("Пусто")
  })
})
