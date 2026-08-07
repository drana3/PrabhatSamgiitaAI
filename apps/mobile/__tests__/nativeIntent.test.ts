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
    expect(rewriteNativeSystemPath("/(tabs)/index")).toBe("/(tabs)/index")
    expect(rewriteNativeSystemPath("/song/ps-1")).toBe("/song/ps-1")
    expect(rewriteNativeSystemPath("prabhatai:///song/ps-1")).toBe("/song/ps-1")
  })

  it("maps quiz event deep links to the event screen", () => {
    expect(rewriteNativeSystemPath("prabhatai://quiz/event/abc123")).toBe("/quiz/event/abc123")
  })
})
