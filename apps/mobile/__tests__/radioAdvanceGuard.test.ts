import { beforeEach, describe, expect, it, vi } from "vitest"

/** The next song is put in the native queue once, however many events ask for it (checkup P4). */

const native = vi.hoisted(() => ({
  queued: 0,
  enqueueTrack: vi.fn(async () => {
    native.queued += 1
  }),
}))

vi.mock("@/lib/client", () => ({
  api: {
    fetchSong: vi.fn(async (n: number) => ({
      number: n,
      title: `PS ${n}`,
      first_line: `Line ${n}`,
      media: [{ kind: "audio", url: `https://example.com/${n}.mp3`, provider: "direct_audio", title: "Recording" }],
    })),
  },
}))
vi.mock("@/lib/offlineAudio", () => ({
  resolvePlaybackUri: vi.fn(async (_n: number, url?: string | null) => (url ? { uri: url, local: false } : null)),
}))
vi.mock("@/lib/playback/trackPlayerBridge", () => ({
  isTrackPlayerLinked: () => true,
  getTrackPlayer: () => ({ getActiveTrack: vi.fn(async () => ({ id: "ps-1" })) }),
}))
vi.mock("@/lib/playback/nativeCatalogPlayer", () => ({
  enqueueTrack: native.enqueueTrack,
  nativeQueueLengthPastIndex: vi.fn(async () => {
    await new Promise((r) => setTimeout(r, 5))
    return native.queued
  }),
  nativeRemoveUpcomingTracks: vi.fn(async () => undefined),
  songToTrack: (song: { number: number }, url: string) => ({ id: `ps-${song.number}`, url }),
  trackIdToSongNumber: (id: string | null) => (id ? Number(id.replace("ps-", "")) : null),
  getActiveCatalogTrackNumber: () => 1,
}))

import playable from "@/assets/playable-audio-numbers.json"
import { ensureUpcomingRadioTrack, resetRadioAdvance } from "@/lib/playback/radioAdvance"
import { resetRadioSession, setRadioSession } from "@/lib/playback/radioSession"
import { setTrackEndHook } from "@/lib/playback/trackEndHook"

const [A, B] = (playable as number[]).slice(0, 2) as [number, number]

describe("ensureUpcomingRadioTrack", () => {
  beforeEach(() => {
    native.queued = 0
    native.enqueueTrack.mockClear()
    resetRadioAdvance()
    resetRadioSession()
    setRadioSession({
      kind: "playlist",
      currentNumber: A,
      playlistBounds: [A, B],
      driveRepeat: false,
      repeat: false,
    } as never)
  })

  it("two events at once add one next song", async () => {
    await Promise.all([ensureUpcomingRadioTrack(), ensureUpcomingRadioTrack(), ensureUpcomingRadioTrack()])
    expect(native.enqueueTrack).toHaveBeenCalledTimes(1)
  })

  it("adds nothing when a next song is already waiting", async () => {
    native.queued = 1
    await ensureUpcomingRadioTrack()
    expect(native.enqueueTrack).not.toHaveBeenCalled()
  })

  it("can run again after the first run finished", async () => {
    await ensureUpcomingRadioTrack()
    native.queued = 0
    await ensureUpcomingRadioTrack()
    expect(native.enqueueTrack).toHaveBeenCalledTimes(2)
  })
})

describe("a plain list on a locked phone (checkup P10)", () => {
  beforeEach(() => {
    native.queued = 0
    native.enqueueTrack.mockClear()
    resetRadioAdvance()
    resetRadioSession()
    setRadioSession({ kind: "casual", currentNumber: A, playlistBounds: null, driveRepeat: false, repeat: false } as never)
  })

  it("lines the next song up natively when the player screen names one", async () => {
    setTrackEndHook({ shouldHoldUpcoming: () => false, onTrackEnded: () => false, upcomingSong: () => B })
    await ensureUpcomingRadioTrack()
    expect(native.enqueueTrack).toHaveBeenCalledTimes(1)
    expect(native.enqueueTrack).toHaveBeenCalledWith(expect.objectContaining({ id: `ps-${B}` }))
  })

  it("adds nothing when nothing follows (single song, repeat one, versions still to play)", async () => {
    setTrackEndHook({ shouldHoldUpcoming: () => false, onTrackEnded: () => false, upcomingSong: () => null })
    await ensureUpcomingRadioTrack()
    expect(native.enqueueTrack).not.toHaveBeenCalled()
  })

  it("adds nothing without a hook, as before", async () => {
    setTrackEndHook(null)
    await ensureUpcomingRadioTrack()
    expect(native.enqueueTrack).not.toHaveBeenCalled()
  })

  it("holds back while the sleep timer or all-versions mode asks the engine to wait", async () => {
    setTrackEndHook({ shouldHoldUpcoming: () => true, onTrackEnded: () => false, upcomingSong: () => B })
    await ensureUpcomingRadioTrack()
    expect(native.enqueueTrack).not.toHaveBeenCalled()
  })
})

