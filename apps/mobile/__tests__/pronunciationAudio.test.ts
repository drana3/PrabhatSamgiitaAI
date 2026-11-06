import { beforeEach, describe, expect, it, vi } from "vitest"

// The clips are .m4a files that only Metro can require: stand in a small index for them.
vi.mock("@/data/pronunciation/audioIndex", () => ({
  CLIPS: {
    "bn.a.1": { kind: "computer", source: 1 },
    "bn.aa.1": { kind: "native", source: 2 },
  },
}))

const created: Array<{ stopAsync: ReturnType<typeof vi.fn>; unloadAsync: ReturnType<typeof vi.fn>; setOnPlaybackStatusUpdate: ReturnType<typeof vi.fn>; source: unknown }> = []
const setAudioModeAsync = vi.fn(async () => undefined)
let failCreate = false
let gate: Promise<void> | null = null

vi.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: (...args: unknown[]) => setAudioModeAsync(...(args as [])),
    Sound: {
      createAsync: async (source: unknown) => {
        if (gate) await gate
        if (failCreate) throw new Error("no audio device")
        const sound = { source, stopAsync: vi.fn(async () => undefined), unloadAsync: vi.fn(async () => undefined), setOnPlaybackStatusUpdate: vi.fn() }
        created.push(sound)
        return { sound }
      },
    },
  },
}))

import { setSongPlaybackYield, setSongPlayingGuard, releaseExtraAudio } from "@/lib/audioFocus"
import { clipKind, playClip, stopClip } from "@/lib/pronunciation/audio"

beforeEach(async () => {
  created.length = 0
  failCreate = false
  gate = null
  setAudioModeAsync.mockClear()
  setSongPlayingGuard(() => false)
  setSongPlaybackYield(null)
  await stopClip()
})

describe("playing a pronunciation clip", () => {
  it("says which clips are recordings and which are the computer voice", () => {
    expect(clipKind("bn.a.1")).toBe("computer")
    expect(clipKind("bn.aa.1")).toBe("native")
    expect(clipKind("nope")).toBeNull()
  })

  it("reports an id with no clip and plays nothing", async () => {
    expect(await playClip("nope")).toBe("missing")
    expect(created).toHaveLength(0)
  })

  it("plays the clip once on a tap, after setting the audio mode for silent mode", async () => {
    expect(await playClip("bn.a.1")).toBe("played")
    expect(created).toHaveLength(1)
    expect(created[0].source).toBe(1)
    expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentModeIOS: true, allowsRecordingIOS: false }))
  })

  it("pauses a song that is playing before the clip starts", async () => {
    const order: string[] = []
    setSongPlayingGuard(() => true)
    setSongPlaybackYield(async () => {
      order.push("song paused")
    })
    setAudioModeAsync.mockImplementationOnce(async () => {
      order.push("audio mode")
    })
    await playClip("bn.a.1")
    order.push("clip created")
    expect(order).toEqual(["song paused", "audio mode", "clip created"])
  })

  it("plays one clip at a time: a second tap unloads the first", async () => {
    await playClip("bn.a.1")
    await playClip("bn.aa.1")
    expect(created).toHaveLength(2)
    expect(created[0].unloadAsync).toHaveBeenCalled()
    expect(created[1].unloadAsync).not.toHaveBeenCalled()
  })

  it("stops a clip that is tapped again", async () => {
    await playClip("bn.a.1")
    await playClip("bn.a.1")
    expect(created).toHaveLength(1)
    expect(created[0].unloadAsync).toHaveBeenCalled()
  })

  it("drops a slow load when another tap came after it", async () => {
    let release: () => void = () => undefined
    gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const first = playClip("bn.a.1")
    const second = playClip("bn.aa.1")
    release()
    await Promise.all([first, second])
    const alive = created.filter((s) => !s.unloadAsync.mock.calls.length)
    expect(alive).toHaveLength(1)
    expect(alive[0].source).toBe(2)
  })

  it("answers 'error' when the device cannot play, without throwing", async () => {
    failCreate = true
    expect(await playClip("bn.a.1")).toBe("error")
  })

  it("is stopped when a song or the capture screen takes the audio session back", async () => {
    await playClip("bn.a.1")
    await releaseExtraAudio()
    expect(created[0].unloadAsync).toHaveBeenCalled()
  })

  it("never plays by itself: importing the module and asking for a kind starts no sound", () => {
    clipKind("bn.a.1")
    expect(created).toHaveLength(0)
    expect(setAudioModeAsync).not.toHaveBeenCalled()
  })
})
