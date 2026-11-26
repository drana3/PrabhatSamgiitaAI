import { describe, expect, it } from "vitest"

import { allCollections, collectionCount } from "@/data/collections"

describe("collections", () => {
  it("includes Hindi, Urdu, Magahi, and the catalog collections used on Songs", () => {
    expect(collectionCount).toBe(69)
    expect(allCollections.some((item) => item.label === "Bengali Dialect Songs")).toBe(false)
    expect(allCollections.some((item) => item.label === "Hindi Songs")).toBe(true)
    expect(allCollections.some((item) => item.label === "Urdu Songs")).toBe(true)
    expect(allCollections.some((item) => item.label === "Magahi Songs")).toBe(true)
    const hindi = allCollections.find((item) => item.label === "Hindi Songs")
    const urdu = allCollections.find((item) => item.label === "Urdu Songs")
    expect(hindi?.count).toBe(6)
    expect(hindi?.songNumbers).toEqual([4062, 4070, 4195, 4512, 4733, 4979])
    expect(urdu?.count).toBe(14)
    expect(urdu?.songNumbers).toHaveLength(14)
    for (const label of ["Hindi Songs", "Urdu Songs", "Magahi Songs", "English Songs", "Sanskrit Songs"]) {
      const row = allCollections.find((item) => item.label === label)
      expect(row?.songNumbers.length).toBeGreaterThan(0)
    }
  })
})
