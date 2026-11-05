import { describe, expect, it } from "vitest"

import { indexRows } from "@/lib/fixtures/learn"

describe("raga and tala index", () => {
  it("has no invented rows in a real build", () => {
    expect(indexRows("raga", false)).toEqual([])
    expect(indexRows("tala", false)).toEqual([])
    expect(indexRows("raga")).toEqual([]) // tests run without the demo flag
  })

  it("keeps the prototype rows in the demo preview", () => {
    expect(indexRows("raga", true).length).toBeGreaterThan(0)
    expect(indexRows("tala", true).length).toBeGreaterThan(0)
  })
})
