import { beforeEach, describe, expect, it, vi } from "vitest"

describe("audioFocus yieldSongPlayback", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("pauses the song when exclusive audio is requested", async () => {
    const yieldFn = vi.fn(async () => undefined)
    const { setSongPlayingGuard, setSongPlaybackYield, yieldSongPlayback, isSongPlaybackActive } =
      await import("@/lib/audioFocus")

    setSongPlayingGuard(() => true)
    setSongPlaybackYield(yieldFn)
    expect(isSongPlaybackActive()).toBe(true)

    await yieldSongPlayback()
    expect(yieldFn).toHaveBeenCalledTimes(1)
  })

  it("is a no-op when the song is not playing", async () => {
    const yieldFn = vi.fn(async () => undefined)
    const { setSongPlayingGuard, setSongPlaybackYield, yieldSongPlayback } = await import(
      "@/lib/audioFocus"
    )

    setSongPlayingGuard(() => false)
    setSongPlaybackYield(yieldFn)
    await yieldSongPlayback()
    expect(yieldFn).not.toHaveBeenCalled()
  })

  it("stops listen audio and the main song before capture play", async () => {
    const yieldFn = vi.fn(async () => undefined)
    const cleanup = vi.fn()
    const {
      registerExtraAudioCleanup,
      setSongPlayingGuard,
      setSongPlaybackYield,
      stopCompetingPlaybackForCapture,
    } = await import("@/lib/audioFocus")

    setSongPlayingGuard(() => true)
    setSongPlaybackYield(yieldFn)
    const unregister = registerExtraAudioCleanup(cleanup)
    await stopCompetingPlaybackForCapture()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(yieldFn).toHaveBeenCalledTimes(1)
    unregister()
  })

  it("holds downloads for the song that is starting or playing", async () => {
    const {
      setPlaybackIntent,
      downloadWouldClashWithPlayback,
      subscribePlaybackIntent,
    } = await import("@/lib/audioFocus")

    const listener = vi.fn()
    const unsub = subscribePlaybackIntent(listener)
    expect(downloadWouldClashWithPlayback(12)).toBe(false)
    setPlaybackIntent(12)
    expect(downloadWouldClashWithPlayback(12)).toBe(true)
    expect(downloadWouldClashWithPlayback(3)).toBe(false)
    expect(listener).toHaveBeenCalled()
    setPlaybackIntent(null)
    expect(downloadWouldClashWithPlayback(12)).toBe(false)
    unsub()
  })
})
