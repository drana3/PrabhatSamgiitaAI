import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { SEARCH_FROM, chipText, filterRailChips, railLine, showsSearch, type RailChip } from "@/lib/kirtan/tagRail"

const read = (path: string) => readFileSync(join(__dirname, "..", path), "utf8")
const chip = (label: string, over: Partial<RailChip> = {}): RailChip => ({ key: label, label, ...over })
const many = ["Guitar", "Harmonium", "Slow", "Group", "Folk", "Indian classical", "Evening", "Longing", "Morning", "Dhrupad"].map((l) => chip(l))

describe("many tags are one line and a +N (Dada, 9 Nov 2026)", () => {
  it("a few short tags all stay on the line, with no +N", () => {
    const { shown, more } = railLine([chip("Slow"), chip("Group")], 350)
    expect(shown.map((c) => c.label)).toEqual(["Slow", "Group"])
    expect(more).toBe(0)
  })

  it("a long list keeps only the chips that fit whole and counts the rest", () => {
    const { shown, more } = railLine(many, 350)
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(many.length)
    expect(shown.length + more).toBe(many.length)
    // the order is kept: the first tags are the ones shown
    expect(shown.map((c) => c.label)).toEqual(many.slice(0, shown.length).map((c) => c.label))
  })

  it("the chips plus the +N chip never need more than the line", () => {
    for (const width of [200, 260, 320, 350, 400]) {
      const { shown, more } = railLine(many, width)
      const used = shown.reduce((sum, c, i) => sum + c.label.length * 7.6 + 24 + (i ? 8 : 0), 0) + (more ? 8 + 44 : 0)
      if (shown.length > 1) expect(used).toBeLessThanOrEqual(width)
    }
  })

  it("a narrow phone shows fewer chips than a wide one", () => {
    expect(railLine(many, 260).shown.length).toBeLessThanOrEqual(railLine(many, 400).shown.length)
  })

  it("at least one chip is always shown, however narrow", () => {
    expect(railLine(many, 40).shown).toHaveLength(1)
    expect(railLine([], 300)).toEqual({ shown: [], more: 0 })
  })

  it("a count counts toward the width: the same words with numbers take more room", () => {
    const plain = ["Kirtan", "Bhajan", "Mantra", "Sargam", "Raga"].map((l) => chip(l))
    const counted = plain.map((c, i) => ({ ...c, count: 100 + i }))
    expect(railLine(counted, 330).shown.length).toBeLessThanOrEqual(railLine(plain, 330).shown.length)
    expect(chipText({ label: "Folk", count: 12 })).toBe("Folk 12")
    expect(chipText({ label: "Folk" })).toBe("Folk")
  })

  it("the sheet's search ignores case, accents and punctuation, and an empty search lists all", () => {
    const list = [chip("Bhajan"), chip("Dhrupad"), chip("Śiva stuti")]
    expect(filterRailChips(list, "").map((c) => c.label)).toEqual(["Bhajan", "Dhrupad", "Śiva stuti"])
    expect(filterRailChips(list, "DHRU").map((c) => c.label)).toEqual(["Dhrupad"])
    expect(filterRailChips(list, "siva").map((c) => c.label)).toEqual(["Śiva stuti"])
    expect(filterRailChips(list, "zzz")).toEqual([])
  })

  it("the search box appears only when it helps (from seven tags on)", () => {
    expect(showsSearch(SEARCH_FROM - 1)).toBe(false)
    expect(showsSearch(SEARCH_FROM)).toBe(true)
  })
})

describe("the places that had many tags use the one rail", () => {
  it("the recording page's tag row", () => {
    const source = read("components/kirtan/RecordingTags.tsx")
    expect(source).toContain("<TagRail")
    expect(source).not.toContain('flexWrap: "wrap"')
    expect(source).toContain("recording-tag-${tag.id}")
  })
  it("the moods another listener may start voting on", () => {
    expect(read("components/kirtan/MoodBlock.tsx")).toContain("<TagRail")
  })
  it("the Search page's 'Search by' values and the matching collections", () => {
    expect(read("components/search-v2/SearchByBlock.tsx")).toContain("<TagRail")
    expect(read("components/search-v2/SearchBlocks.tsx")).toContain("<TagRail")
  })
  it("the rail is one line, opens the shared sheet with a search box, and keeps taps on picked chips", () => {
    const rail = read("components/kirtan/TagRail.tsx")
    expect(rail).not.toContain('flexWrap: "wrap"')
    expect(rail).toContain("SpringSheet")
    expect(rail).toContain("pickerStyles")
    expect(rail).toContain("showsSearch")
    expect(rail).toContain("onPress")
  })
})
