import { describe, expect, it } from "vitest"

import type { CatalogEntry } from "@/lib/songsV2/entry"
import {
  activeFilterCount,
  applyFilters,
  bucketFor,
  EMPTY_FILTERS,
  filterTokens,
  languageOptions,
  removeToken,
  restrictToNumbers,
  toggleDuration,
  toggleHasAudio,
  toggleLanguage,
  toggleScript,
} from "@/lib/songsV2/filters"

function entry(number: number, extra: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    number,
    title: `t${number}`,
    firstLine: null,
    category: "Other",
    language: null,
    durationSeconds: null,
    hasAudio: null,
    hasDevanagari: null,
    addedRank: null,
    plays: null,
    ...extra,
  }
}

const list = [
  entry(1, { language: "English", hasAudio: true, durationSeconds: 120, hasDevanagari: false }),
  entry(2, { language: "Hindi", hasAudio: false, durationSeconds: 400, hasDevanagari: true }),
  entry(3, { language: "Hindi", hasAudio: true, durationSeconds: 250, hasDevanagari: true }),
  entry(4, {}), // everything unknown
]

describe("filters", () => {
  it("returns everything with no filters", () => {
    expect(applyFilters(list, EMPTY_FILTERS)).toHaveLength(4)
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0)
  })

  it("filters by language but keeps rows with unknown language", () => {
    const out = applyFilters(list, toggleLanguage(EMPTY_FILTERS, "Hindi"))
    expect(out.map((e) => e.number)).toEqual([2, 3, 4])
  })

  it("filters by audio, keeping unknown", () => {
    const out = applyFilters(list, toggleHasAudio(EMPTY_FILTERS))
    expect(out.map((e) => e.number)).toEqual([1, 3, 4])
  })

  it("filters by script", () => {
    const out = applyFilters(list, toggleScript(EMPTY_FILTERS, "devanagari"))
    expect(out.map((e) => e.number)).toEqual([2, 3, 4])
  })

  it("filters by duration bucket", () => {
    expect(bucketFor(120)).toBe("short")
    expect(bucketFor(180)).toBe("medium")
    expect(bucketFor(360)).toBe("long")
    const out = applyFilters(list, toggleDuration(EMPTY_FILTERS, "medium"))
    expect(out.map((e) => e.number)).toEqual([3, 4])
  })

  it("combines filters with AND", () => {
    let state = toggleLanguage(EMPTY_FILTERS, "Hindi")
    state = toggleHasAudio(state)
    expect(applyFilters(list, state).map((e) => e.number)).toEqual([3, 4])
    expect(activeFilterCount(state)).toBe(2)
  })

  it("toggles a value off again", () => {
    const on = toggleLanguage(EMPTY_FILTERS, "Hindi")
    expect(toggleLanguage(on, "Hindi")).toEqual(EMPTY_FILTERS)
  })

  it("lists languages, most common first", () => {
    expect(languageOptions(list)).toEqual([
      { language: "Hindi", count: 2 },
      { language: "English", count: 1 },
    ])
  })

  it("makes removable tokens and removes each kind", () => {
    let state = toggleLanguage(EMPTY_FILTERS, "Hindi")
    state = toggleScript(state, "roman")
    state = toggleHasAudio(state)
    state = toggleDuration(state, "short")
    const tokens = filterTokens(state)
    expect(tokens.map((t) => t.label)).toEqual(["Hindi", "Roman", "Has audio", "Under 3 min"])
    for (const token of tokens) state = removeToken(state, token.id)
    expect(state).toEqual(EMPTY_FILTERS)
  })

  it("ignores an unknown token", () => {
    expect(removeToken(EMPTY_FILTERS, "zzz")).toEqual(EMPTY_FILTERS)
  })

  it("restricts to a number set", () => {
    expect(restrictToNumbers(list, new Set([2, 3])).map((e) => e.number)).toEqual([2, 3])
    expect(restrictToNumbers(list, null)).toHaveLength(4)
  })
})
