import { describe, expect, it } from "vitest"

import { listSongAudio } from "@/lib/song-audio"

describe("listSongAudio", () => {
  it("puts the current recording first and labels it best", () => {
    const recordings = listSongAudio([
      {
        kind: "audio",
        provider: "official",
        title: "Song 1 (old version)",
        url: "https://example.test/old.mp3",
        verification_status: "verified",
      },
      {
        kind: "audio",
        provider: "official",
        title: "Song 1",
        url: "https://example.test/current.mp3",
        verification_status: "verified",
      },
    ])
    expect(recordings[0]?.url).toBe("https://example.test/current.mp3")
    expect(recordings[0]?.isLatest).toBe(true)
    expect(recordings[1]?.isOlder).toBe(true)
  })
})
