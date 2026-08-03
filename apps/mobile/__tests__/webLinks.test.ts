import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        webBaseUrl: "https://example.test",
      },
    },
  },
}))

import { songShareMessage, songShareUrl, webBaseUrl } from "@/lib/webLinks"

describe("web share links", () => {
  const previous = process.env.EXPO_PUBLIC_WEB_BASE_URL

  afterEach(() => {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_WEB_BASE_URL
    else process.env.EXPO_PUBLIC_WEB_BASE_URL = previous
  })

  it("builds song URLs from the configured web base", () => {
    // Env wins over expo extra — clear it so the mock base is used.
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL
    expect(webBaseUrl()).toBe("https://example.test")
    expect(songShareUrl(1)).toBe("https://example.test/songs/1")
    expect(songShareMessage(1, "BANDHU HE NIYE CALO")).toContain("PS 1 — BANDHU HE NIYE CALO")
    expect(songShareMessage(1, "BANDHU HE NIYE CALO")).toContain("https://example.test/songs/1")
  })
})
