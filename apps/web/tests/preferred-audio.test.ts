import { afterEach, describe, expect, it } from "vitest"

import { readPreferredAudio, writePreferredAudio } from "@/lib/preferred-audio"

describe("preferred audio memory", () => {
  afterEach(() => {
    window.localStorage.removeItem("ps.preferred-audio")
  })

  it("stores a non-latest pick per song", () => {
    expect(readPreferredAudio(8)).toBeNull()
    writePreferredAudio(8, "https://example.test/old.mp3")
    expect(readPreferredAudio(8)).toBe("https://example.test/old.mp3")
    writePreferredAudio(8, null)
    expect(readPreferredAudio(8)).toBeNull()
  })
})
