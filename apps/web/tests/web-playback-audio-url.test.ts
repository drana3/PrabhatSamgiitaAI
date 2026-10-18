import { afterEach, describe, expect, it, vi } from "vitest"

import { webPlaybackAudioUrl } from "@/lib/web-playback-audio-url"

describe("webPlaybackAudioUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("proxies prabhatasamgiita.net through the API stream", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test")
    const url = webPlaybackAudioUrl("https://prabhatasamgiita.net/1-999/1.mp3")
    expect(url).toBe(
      "https://api.example.test/api/v1/media/stream?url=https%3A%2F%2Fprabhatasamgiita.net%2F1-999%2F1.mp3",
    )
  })

  it("unwraps legacy proxy URLs then re-proxies for playback", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test")
    const legacy =
      "https://api.example.test/api/v1/media/stream?url=https%3A%2F%2Fprabhatasamgiita.net%2F2084.mp3"
    expect(webPlaybackAudioUrl(legacy)).toBe(
      "https://api.example.test/api/v1/media/stream?url=https%3A%2F%2Fprabhatasamgiita.net%2F2084.mp3",
    )
  })

  it("leaves non-archive URLs unchanged", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test")
    expect(webPlaybackAudioUrl("https://cdn.example.test/song.mp3")).toBe("https://cdn.example.test/song.mp3")
  })
})
