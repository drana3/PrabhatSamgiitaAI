import { describe, expect, it } from "vitest"

import { scenicHeroFor, scenicThumbFor } from "@/lib/scenicArt"

describe("scenicArt", () => {
  it("uses smaller thumb URLs than heroes", () => {
    const hero = scenicHeroFor(1)
    const thumb = scenicThumbFor(1)
    expect(hero).toContain("w=720")
    expect(thumb).toContain("w=280")
    expect(hero).not.toContain("w=1200")
  })

  it("keeps the same photo family for a song number", () => {
    const hero = scenicHeroFor(419)
    const thumb = scenicThumbFor(419)
    expect(hero.split("?")[0]).toBe(thumb.split("?")[0])
  })
})
