import { describe, expect, it } from "vitest"

import { todayItemToMockSong } from "@/lib/today"

describe("todayItemToMockSong", () => {
  it("unwraps legacy API proxy audio URLs from recommendations", () => {
    const song = todayItemToMockSong({
      number: 1,
      title: "BANDHU HE NIYE CALO",
      first_line: "Bandhu he niye calo",
      score: 1,
      reasons: ["Daily selection"],
      is_verified: true,
      audio_url:
        "https://prabhatai-api.example.test/api/v1/media/stream?url=https%3A%2F%2Fprabhatasamgiita.net%2F1-999%2F1.mp3",
      video_embed_url: null,
      notation_available: false,
    })
    expect(song.audioUrl).toBe("https://prabhatasamgiita.net/1-999/1.mp3")
  })

  it("keeps direct archive URLs unchanged", () => {
    const direct = "https://prabhatasamgiita.net/1-999/3%20A.mp3"
    const song = todayItemToMockSong({
      number: 3,
      title: "Test",
      first_line: "Line",
      score: 1,
      reasons: ["Daily selection"],
      is_verified: true,
      audio_url: direct,
      video_embed_url: null,
      notation_available: false,
    })
    expect(song.audioUrl).toBe(direct)
  })
})
