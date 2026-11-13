import { beforeEach, describe, expect, it, vi } from "vitest"

import type { MockSong } from "@/data/mock"
import { kiirtanToSong } from "@/lib/kirtan/track"
import { fromRemote } from "@/lib/kirtan/submissions"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { listPlayableAudio } from "@/lib/mediaEmbed"
import { songToTrack } from "@/lib/playback/catalogTrack"
import { LOUDNESS_STORE_VERSION, normalizeLevelingEnabled, useLoudnessStore } from "@/stores/loudnessStore"
import TrackPlayer, { Event, __emitTrackPlayer } from "./setup/fakeTrackPlayer"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => void memory.set(key, value),
      removeItem: async (key: string) => void memory.delete(key),
    },
  }
})
vi.mock("@/lib/offlineAudio", () => ({ toPlayableLocalUri: (u: string) => u }))

const gain = (db: number) => 10 ** (db / 20)
const lastVolume = () => {
  const calls = TrackPlayer.setVolume.mock.calls as unknown as number[][]
  return calls[calls.length - 1]?.[0]
}

describe("loudness numbers travel from the API to the player", () => {
  it("catalog audio keeps the numbers the server measured, per recording", () => {
    const audio = listPlayableAudio([
      { kind: "audio", provider: "direct_audio", title: "A", url: "https://x.test/a.mp3", verification_status: "ok", loudness_lufs: -9.5, true_peak_db: -0.4 },
      { kind: "audio", provider: "direct_audio", title: "B", url: "https://x.test/b.mp3", verification_status: "ok", loudness_lufs: null, true_peak_db: null },
      { kind: "audio", provider: "direct_audio", title: "C", url: "https://x.test/c.mp3", verification_status: "ok" },
    ])
    const byUrl = Object.fromEntries(audio.map((a) => [a.url, a]))
    expect(byUrl["https://x.test/a.mp3"]).toMatchObject({ loudnessLufs: -9.5, truePeakDb: -0.4 })
    expect(byUrl["https://x.test/b.mp3"]).not.toHaveProperty("loudnessLufs")
    expect(byUrl["https://x.test/c.mp3"]).not.toHaveProperty("loudnessLufs")
  })

  it("a catalog song's track carries the numbers of the recording being played, never a sibling's", () => {
    const song = {
      number: 12,
      title: "SONG",
      durationSeconds: 0,
      audioUrl: "https://x.test/a.mp3",
      audioRecordings: [
        { title: "A", url: "https://x.test/a.mp3", provider: "direct_audio", loudnessLufs: -9.5, truePeakDb: -0.4 },
        { title: "B", url: "https://x.test/b.mp3", provider: "direct_audio" },
      ],
      loudness: { lufs: -9.5, truePeakDb: -0.4 },
    } as unknown as MockSong
    expect(songToTrack(song, "https://x.test/a.mp3")).toMatchObject({ loudnessLufs: -9.5, truePeakDb: -0.4, loudnessClass: "music" })
    const other = songToTrack(song, "https://x.test/b.mp3")
    expect(other.loudnessLufs).toBeUndefined()
  })

  it("a Kiirtan from the server carries its numbers, and Baba's discourse is speech", () => {
    const remote = {
      id: "r1", kind: "kiirtan", type: "kiirtan", title: "T", author: "A", added_by: "me", author_id: null, by_author: false,
      status: "published", duration_sec: 120, plays: 0, audio_url: "https://x.test/k.mp3", thumbnail_url: null, published_at: null, created_at: "2026-01-01T00:00:00Z",
      loudness_lufs: -11.2, true_peak_db: -1.1,
    } as unknown as RemoteRecording
    const k = fromRemote(remote)
    expect(k).toMatchObject({ loudnessLufs: -11.2, truePeakDb: -1.1 })
    const song = kiirtanToSong(k)
    expect(song.loudness).toEqual({ lufs: -11.2, truePeakDb: -1.1 })
    expect(songToTrack(song, "https://x.test/k.mp3")).toMatchObject({ loudnessLufs: -11.2, loudnessClass: "music" })
    const talk = fromRemote({ ...remote, id: "r2", kind: "baba_audio" } as unknown as RemoteRecording)
    expect(songToTrack(kiirtanToSong(talk), "https://x.test/k.mp3").loudnessClass).toBe("speech")
  })

  it("an unmeasured recording has no numbers at all", () => {
    const k = fromRemote({ id: "r3", kind: "kiirtan", type: "kiirtan", title: "T", author: "A", added_by: "me", status: "published", audio_url: "u", created_at: "x" } as unknown as RemoteRecording)
    expect(k.loudnessLufs).toBeUndefined()
    expect(kiirtanToSong(k).loudness).toBeUndefined()
  })
})

describe("the switch", () => {
  it("is on by default and only a stored false turns it off", () => {
    expect(useLoudnessStore.getState().enabled).toBe(true)
    expect(normalizeLevelingEnabled(undefined)).toBe(true)
    expect(normalizeLevelingEnabled("nope")).toBe(true)
    expect(normalizeLevelingEnabled(null)).toBe(true)
    expect(normalizeLevelingEnabled(false)).toBe(false)
    expect(LOUDNESS_STORE_VERSION).toBe(1)
  })
})

describe("the native player is levelled", () => {
  beforeEach(async () => {
    // the listeners are attached once per app run (not reset here, as the real player keeps them)
    useLoudnessStore.setState({ enabled: true })
    const { levelReset, levelSetUserVolume } = await import("@/lib/playback/levelingBridge")
    levelReset()
    levelSetUserVolume(1)
    TrackPlayer.setVolume.mockClear()
  })

  const loud = { id: "ps-1", url: "https://x.test/loud.mp3", title: "loud", loudnessLufs: -8, truePeakDb: -1, loudnessClass: "music" as const }
  const soft = { id: "ps-2", url: "https://x.test/soft.mp3", title: "soft", loudnessLufs: -17, truePeakDb: -4, loudnessClass: "music" as const }

  it("a loud track is turned down before it plays; the listener's volume is multiplied in", async () => {
    const player = await import("@/lib/playback/rntpCatalogPlayer")
    await player.playTrackNow(loud)
    expect(lastVolume()).toBeCloseTo(gain(-10), 6)
    await player.nativeSetVolume(0.5)
    expect(lastVolume()).toBeCloseTo(0.5 * gain(-10), 6)
  })

  it("a track without numbers plays at exactly the listener's volume", async () => {
    const player = await import("@/lib/playback/rntpCatalogPlayer")
    await player.playTrackNow({ id: "ps-3", url: "https://x.test/u.mp3", title: "u" })
    await player.nativeSetVolume(0.7)
    expect(lastVolume()).toBeCloseTo(0.7, 9)
  })

  it("at the join the volume follows the next track (radio and lists)", async () => {
    vi.useFakeTimers()
    try {
      const player = await import("@/lib/playback/rntpCatalogPlayer")
      await player.playTrackNow(soft) // -1 dB
      await player.enqueueTrack(loud) // needs -10 dB
      // the last second of the soft track: the volume is already down when the loud one starts
      __emitTrackPlayer(Event.PlaybackProgressUpdated, { position: 239.2, duration: 240 })
      vi.advanceTimersByTime(600)
      expect(lastVolume()).toBeCloseTo(gain(-10), 6)
      __emitTrackPlayer(Event.PlaybackActiveTrackChanged, { track: { id: "ps-1" } })
      vi.advanceTimersByTime(600)
      expect(lastVolume()).toBeCloseTo(gain(-10), 6)
    } finally {
      vi.useRealTimers()
    }
  })

  it("flipping the switch off puts the volume back to the listener's own at once", async () => {
    const player = await import("@/lib/playback/rntpCatalogPlayer")
    await player.playTrackNow(loud)
    expect(lastVolume()).toBeCloseTo(gain(-10), 6)
    useLoudnessStore.getState().setEnabled(false)
    expect(lastVolume()).toBe(1)
    useLoudnessStore.getState().setEnabled(true)
    expect(lastVolume()).toBeCloseTo(gain(-10), 6)
  })

  it("stopping resets the gain", async () => {
    const player = await import("@/lib/playback/rntpCatalogPlayer")
    await player.playTrackNow(loud)
    await player.nativeStop()
    expect(lastVolume()).toBe(1)
  })
})
