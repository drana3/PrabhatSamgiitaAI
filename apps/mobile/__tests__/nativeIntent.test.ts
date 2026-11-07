import { describe, expect, it } from "vitest"

import { rewriteNativeSystemPath } from "@/lib/nativeIntent"

describe("rewriteNativeSystemPath", () => {
  it("maps bare scheme launches to home", () => {
    expect(rewriteNativeSystemPath("prabhatai:///")).toBe("/")
    expect(rewriteNativeSystemPath("prabhatai://")).toBe("/")
    expect(rewriteNativeSystemPath("")).toBe("/")
  })

  it("maps Microsoft auth return URLs to /auth", () => {
    expect(rewriteNativeSystemPath("prabhatai://auth")).toBe("/auth")
    expect(rewriteNativeSystemPath("prabhatai:///auth")).toBe("/auth")
    expect(rewriteNativeSystemPath("prabhatai://auth?code=abc")).toBe("/auth?code=abc")
  })

  it("preserves normal in-app paths", () => {
    expect(rewriteNativeSystemPath("/song-v2/ps-1")).toBe("/song-v2/ps-1")
    expect(rewriteNativeSystemPath("/player-v2")).toBe("/player-v2")
  })

  it("sends old (v1) addresses to the redesigned screens", () => {
    expect(rewriteNativeSystemPath("/(tabs)/index")).toBe("/v2/today")
    expect(rewriteNativeSystemPath("/song/ps-1")).toBe("/song-v2/ps-1")
    expect(rewriteNativeSystemPath("prabhatai:///song/ps-1")).toBe("/song-v2/ps-1")
    expect(rewriteNativeSystemPath("/songs/7")).toBe("/song-v2/ps-7")
  })

  it("keeps the Radio screen's old address /drive as it is (QA-005)", () => {
    expect(rewriteNativeSystemPath("prabhatai://drive")).toBe("/drive")
    expect(rewriteNativeSystemPath("prabhatai:///drive")).toBe("/drive")
    expect(rewriteNativeSystemPath("/drive")).toBe("/drive")
  })

  it("maps quiz event deep links to the event screen", () => {
    expect(rewriteNativeSystemPath("prabhatai://quiz/event/abc123")).toBe("/quiz/event/abc123")
  })

  it("maps website song URLs to the song screen", () => {
    expect(rewriteNativeSystemPath("https://www.prabhatasamgiita.org/songs/42")).toBe("/song-v2/ps-42")
  })
})
