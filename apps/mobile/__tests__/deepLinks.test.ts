import { describe, expect, it } from "vitest"

import { songAppDeepLink, webUrlToAppPath } from "@/lib/deepLinks"

describe("webUrlToAppPath", () => {
  it("maps public song URLs to in-app song routes", () => {
    expect(webUrlToAppPath("https://www.prabhatasamgiita.org/songs/662")).toBe("/song-v2/ps-662")
    expect(webUrlToAppPath("https://www.prabhatasamgiita.org/songs/662?lang=en")).toBe(
      "/song-v2/ps-662?lang=en",
    )
  })

  it("maps bare /songs paths", () => {
    expect(webUrlToAppPath("/songs/12")).toBe("/song-v2/ps-12")
  })
})

describe("songAppDeepLink", () => {
  it("uses the prabhatai scheme", () => {
    expect(songAppDeepLink(5)).toBe("prabhatai:///song/ps-5")
  })
})
