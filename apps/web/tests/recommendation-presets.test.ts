import { describe, expect, it } from "vitest"

import { getUpcomingObservances } from "@/lib/recommendation-presets"
import { specialCollectionCount, specialCollectionGroups } from "@/lib/special-collections"

describe("reviewed discovery collections", () => {
  it("publishes every canonical special collection in organized groups", () => {
    expect(specialCollectionCount).toBe(69)
    expect(specialCollectionGroups.map((group) => group.title)).toContain("Languages")
    expect(specialCollectionGroups.flatMap((group) => group.collections).map((item) => item.label)).toEqual(
      expect.arrayContaining(["Hindi", "Maithili", "Shiva", "Tree planting", "Turkish tune"]),
    )
  })

  it("includes an observance occurring today", () => {
    const events = getUpcomingObservances(new Date(2026, 7, 28, 18, 0), 1)

    expect(events[0]).toMatchObject({ title: "Shrávanii Purnimá", daysUntil: 0 })
  })

  it("rolls upcoming observances into the next calendar year", () => {
    const events = getUpcomingObservances(new Date(2026, 11, 31, 12, 0), 1)

    expect(events[0]).toMatchObject({ title: "R.U. Day", daysUntil: 25 })
  })
})
