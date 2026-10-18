import { beforeEach, describe, expect, it, vi } from "vitest"

const setStringAsync = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock("expo-clipboard", () => ({
  setStringAsync,
}))

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
}))

import { copyTextToClipboard } from "@/lib/clipboard"

describe("copyTextToClipboard", () => {
  beforeEach(() => {
    setStringAsync.mockClear()
  })

  it("writes trimmed text to the clipboard", async () => {
    const ok = await copyTextToClipboard("  Bandhu he niye calo  ", "Lyrics copied")
    expect(ok).toBe(true)
    expect(setStringAsync).toHaveBeenCalledWith("Bandhu he niye calo")
  })

  it("returns false for empty text", async () => {
    const ok = await copyTextToClipboard("   ")
    expect(ok).toBe(false)
    expect(setStringAsync).not.toHaveBeenCalled()
  })
})
