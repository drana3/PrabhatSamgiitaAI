import { describe, expect, it } from "vitest"

import { allCollections, collectionCount } from "@/data/collections"

describe("collections", () => {
  it("matches the website curated collection count", () => {
    expect(collectionCount).toBe(68)
    expect(allCollections.some((item) => item.label === "Bengali Dialect Songs")).toBe(false)
  })
})
