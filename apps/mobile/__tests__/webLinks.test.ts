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

import { privacyUrl, songShareMessage, songShareUrl, takedownUrl, termsUrl, webBaseUrl } from "@/lib/webLinks"

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
    expect(songShareUrl(1)).toBe("https://example.test/songs/1?open=app")
    expect(songShareMessage(1, "BANDHU HE NIYE CALO")).toContain("PS 1 · BANDHU HE NIYE CALO")
    expect(songShareMessage(1, "BANDHU HE NIYE CALO")).toContain("https://example.test/songs/1")
    expect(songShareMessage(1, "BANDHU HE NIYE CALO")).not.toContain("apps.apple.com")
  })

  it("omits a singer line when it only repeats the title", () => {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL
    const message = songShareMessage(111, "VEŃUKÁR VAN KII KATHÁ KAY", {
      performer: "VEN'UKA'R VAN KII KATHA' KAY",
    })
    expect(message).not.toContain("Singer ·")
  })

  it("links the legal pages of the website", () => {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL
    expect(termsUrl()).toBe("https://example.test/terms")
    expect(privacyUrl()).toBe("https://example.test/privacy")
    expect(takedownUrl()).toBe("https://example.test/takedown")
  })
})
