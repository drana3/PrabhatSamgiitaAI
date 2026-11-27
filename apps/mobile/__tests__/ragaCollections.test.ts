import { describe, expect, it } from "vitest"

import ragaManifest from "../../../data/generated/raga_collections.json"
import { allCollections, collectionGroups } from "@/data/collections"

describe("raga browse collections", () => {
  it("merges raga manifest into mobile collections", () => {
    expect(ragaManifest).toHaveLength(30)
    expect(allCollections.length).toBeGreaterThanOrEqual(30 + 69)
    const ragaGroup = collectionGroups.find((group) => group.id === "raga")
    expect(ragaGroup?.items).toHaveLength(30)
    const yaman = ragaGroup?.items.find((row) => row.label === "Yaman")
    expect(yaman?.songNumbers).toEqual([1565])
  })
})