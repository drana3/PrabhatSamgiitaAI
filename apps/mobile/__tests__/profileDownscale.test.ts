import { describe, expect, it } from "vitest"

import { workingSize } from "@/lib/profile/downscale"

describe("workingSize", () => {
  it("leaves a picture that is small enough alone", () => {
    expect(workingSize(1600, 1200)).toBeNull()
    expect(workingSize(2048, 2048)).toBeNull()
  })

  it("shrinks the longer side to 2048 and keeps the proportions", () => {
    expect(workingSize(8000, 6000)).toEqual({ width: 2048, height: 1536 })
    expect(workingSize(3000, 6000)).toEqual({ width: 1024, height: 2048 })
  })

  it("ignores sizes it cannot use", () => {
    expect(workingSize(0, 100)).toBeNull()
    expect(workingSize(Number.NaN, 100)).toBeNull()
  })
})
