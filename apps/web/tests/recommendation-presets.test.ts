import { describe, expect, it } from "vitest"

import { getAutoRecommendationPreset, getUpcomingObservances, quickRecommendationPresets } from "@/lib/recommendation-presets"
import { specialCollectionCount, specialCollectionGroups, exploreSearchKind, isCollectionSearchQuery } from "@/lib/special-collections"
import canonicalCollections from "../../../data/generated/theme_collections.json"

describe("reviewed discovery collections", () => {
  it("publishes every canonical special collection in organized groups", () => {
    expect(specialCollectionCount).toBe(69)
    expect(specialCollectionGroups.map((group) => group.title)).toContain("Languages")
    expect(specialCollectionGroups.flatMap((group) => group.collections).map((item) => item.label)).toEqual(
      expect.arrayContaining(["Hindi", "Urdu", "Maithili", "Shiva", "Tree planting", "Turkish tune"]),
    )
  })

  it("keeps every displayed collection count aligned with the canonical source manifest", () => {
    const expected = new Map(canonicalCollections.map((item) => [item.label, item.count]))
    const displayed = specialCollectionGroups.flatMap((group) => group.collections)

    expect(displayed).toHaveLength(69)
    for (const collection of displayed) {
      const curatedCounts: Record<string, number> = {
        "All Birthday Songs": 6,
      }
      const expectedCount = curatedCounts[collection.query] ?? expected.get(collection.query)
      expect(expectedCount, collection.query).toBe(collection.count)
    }
  })

  it("shows canonical Hindi and Urdu totals instead of splitting Hindustani overlap", () => {
    const languages = specialCollectionGroups.find((group) => group.title === "Languages")?.collections ?? []
    expect(languages.find((item) => item.label === "Hindi")).toMatchObject({ count: 12, query: "Hindi Songs" })
    expect(languages.find((item) => item.label === "Urdu")).toMatchObject({ count: 16, query: "Urdu Songs" })
  })

  it("includes an observance occurring today", () => {
    const events = getUpcomingObservances(new Date(2026, 7, 28, 18, 0), 1)

    expect(events[0]).toMatchObject({ title: "Shrávanii Purnimá", daysUntil: 0 })
    expect(events[0].query).toContain("Shravanii Purnima Day")
  })

  it("prioritizes exact-day observances with canonical collection metadata", () => {
    expect(getAutoRecommendationPreset(new Date(2026, 4, 1, 8, 0))).toMatchObject({
      title: "Ánanda Purnimá",
      festival: "Bábá Birthday",
    })
    expect(getAutoRecommendationPreset(new Date(2026, 5, 5, 8, 0))).toMatchObject({
      title: "PROUT Day",
      theme: "PROUT",
    })
  })

  it("uses only verified service collections for the Service preset", () => {
    const service = quickRecommendationPresets().find((item) => item.id === "service")

    expect(service?.preset.theme).toContain("AMURT")
    expect(service?.preset.theme).toContain("PROUT")
    expect(service?.preset.season).toBeUndefined()
    expect(service?.preset.language).toBeUndefined()
    expect(service?.preset.difficulty).toBeUndefined()
  })

  it("does not present an upcoming festival as today's selection", () => {
    const preset = getAutoRecommendationPreset(new Date(2026, 7, 20, 8, 0))

    expect(preset.title).toBe("Today’s devotional mood")
    expect(preset.festival).toBeUndefined()
  })

  it("does not guess lunar observances beyond the reviewed calendar year", () => {
    const events = getUpcomingObservances(new Date(2026, 11, 31, 12, 0), 1)

    expect(events).toEqual([])
  })

  it("routes collection prompts to catalog search and free text to semantic search", () => {
    expect(isCollectionSearchQuery("Search Prabhat Samgiita for Hindi Songs")).toBe(true)
    expect(exploreSearchKind("Search Prabhat Samgiita for Hindi Songs")).toBe("catalog")
    expect(exploreSearchKind("song about rain")).toBe("semantic")
    expect(exploreSearchKind("morning meditation", "semantic")).toBe("semantic")
  })
})
