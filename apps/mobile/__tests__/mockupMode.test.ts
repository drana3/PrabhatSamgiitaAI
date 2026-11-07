import { describe, expect, it } from "vitest"

import { mockupEnabled } from "@/lib/mockupMode"

describe("mockup data switch", () => {
  it("is off without the flag", () => {
    expect(mockupEnabled(undefined, "web", true)).toBe(false)
    expect(mockupEnabled("0", "ios", true)).toBe(false)
  })
  it("is on in the web preview and in development builds", () => {
    expect(mockupEnabled("1", "web", false)).toBe(true)
    expect(mockupEnabled("1", "ios", true)).toBe(true)
  })
  it("is off in a native release build even when the flag was left set", () => {
    expect(mockupEnabled("1", "ios", false)).toBe(false)
    expect(mockupEnabled("1", "android", false)).toBe(false)
  })
})
