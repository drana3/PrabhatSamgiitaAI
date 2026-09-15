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

  it("keeps every official recording and prefers direct streams over legacy proxy for Best", () => {
    const recordings = listSongAudio([
      {
        kind: "audio",
        provider: "official",
        title: "Archive",
        url: "https://prabhatai-api.example.test/api/v1/media/stream?url=https%3A%2F%2Fprabhatasamgiita.net%2F2084.mp3",
        verification_status: "verified",
      },
      {
        kind: "audio",
        provider: "official",
        title: "Archive (current)",
        url: "https://prabhatasamgiita.net/2000-2999/2084.mp3",
        verification_status: "verified",
      },
      {
        kind: "audio",
        provider: "official",
        title: "Archive (old version)",
        url: "https://prabhatasamgiita.net/2000-2999/2084%20old.mp3",
        verification_status: "verified",
        is_older: true,
      },
    ])
    expect(recordings).toHaveLength(3)
    expect(recordings[0]?.url).toContain("prabhatasamgiita.net/2000-2999/2084.mp3")
    expect(recordings[0]?.isLatest).toBe(true)
  })
})
