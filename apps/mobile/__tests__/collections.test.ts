import { describe, expect, it } from "vitest"

import { allCollections, collectionCount } from "@/data/collections"

describe("collections", () => {
  it("includes Hindi, Urdu, and the 68 collections used on Songs", () => {
    expect(collectionCount).toBe(68)
    expect(allCollections.some((item) => item.label === "Bengali Dialect Songs")).toBe(false)
    expect(allCollections.some((item) => item.label === "Hindi Songs")).toBe(true)
    expect(allCollections.some((item) => item.label === "Urdu Songs")).toBe(true)
    for (const label of ["Hindi Songs", "Urdu Songs", "English Songs", "Sanskrit Songs"]) {
      const row = allCollections.find((item) => item.label === label)
      expect(row?.songNumbers.length).toBeGreaterThan(0)
    }
  })
})
