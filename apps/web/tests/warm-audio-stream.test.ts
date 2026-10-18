import { warmArchiveAudioStream } from "@/lib/warm-audio-stream"

describe("warmArchiveAudioStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("prefetches the first bytes with a range request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 206 }))
    vi.stubGlobal("fetch", fetchMock)

    await warmArchiveAudioStream("https://prabhatasamgiita.net/1-999/1.mp3")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://prabhatasamgiita.net/1-999/1.mp3",
      expect.objectContaining({
        method: "GET",
        headers: { Range: "bytes=0-2047" },
      }),
    )
  })

  it("ignores fetch failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")))

    await expect(warmArchiveAudioStream("https://prabhatasamgiita.net/1-999/1.mp3")).resolves.toBeUndefined()
  })
})
