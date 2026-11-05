import { describe, expect, it, vi } from "vitest"

describe("learn gate", () => {
  it("serves no words in a real build until the list is verified", async () => {
    vi.resetModules()
    vi.doMock("@/lib/mockupMode", () => ({ MOCKUP_DATA: false }))
    const mod = await import("@/lib/learn/verified")
    expect(mod.LEARN_WORDS_VERIFIED).toBe(false)
    expect(mod.learnWordsAvailable()).toBe(false)
    expect(mod.learnWordList()).toHaveLength(0)
    vi.doUnmock("@/lib/mockupMode")
  })

  it("serves the prototype words in the preview", async () => {
    vi.resetModules()
    vi.doMock("@/lib/mockupMode", () => ({ MOCKUP_DATA: true }))
    const mod = await import("@/lib/learn/verified")
    expect(mod.learnWordsAvailable()).toBe(true)
    expect(mod.learnWordList().length).toBeGreaterThan(0)
    vi.doUnmock("@/lib/mockupMode")
  })
})
