import { describe, expect, it } from "vitest"

import { equalPowerCurves } from "@/lib/loudness/crossfade"
import {
  createWebAudioEngine,
  type AudioContextLike,
  type AudioElementLike,
  type AudioParamLike,
  type GainNodeLike,
} from "@/lib/loudness/webAudioEngine"
import type { CatalogTrack } from "@/lib/playback/catalogTrack"

type Call = { kind: "set" | "curve" | "cancel" | "target"; value?: number; values?: Float32Array; at: number; duration?: number }

function fakeParam(): AudioParamLike & { calls: Call[] } {
  const calls: Call[] = []
  const param = {
    value: 1,
    calls,
    setValueAtTime(value: number, at: number) {
      calls.push({ kind: "set", value, at })
      param.value = value
    },
    setValueCurveAtTime(values: Float32Array, at: number, duration: number) {
      calls.push({ kind: "curve", values, at, duration })
    },
    cancelScheduledValues(at: number) {
      calls.push({ kind: "cancel", at })
    },
    setTargetAtTime(value: number, at: number) {
      calls.push({ kind: "target", value, at })
    },
  }
  return param
}

function setup(opts: { isEnabled?: () => boolean; crossfade?: () => boolean } = {}) {
  const gains: Array<GainNodeLike & { gain: ReturnType<typeof fakeParam> }> = []
  let time = 0
  const ctx = {
    get currentTime() {
      return time
    },
    state: "running",
    destination: { name: "destination" },
    createGain() {
      const node = { gain: fakeParam(), connect: () => undefined }
      gains.push(node)
      return node
    },
    createMediaElementSource: () => ({ connect: () => undefined }),
  } as unknown as AudioContextLike
  const elements: Array<AudioElementLike & { plays: number; pauses: number }> = []
  const createElement = () => {
    const el = {
      src: "",
      currentTime: 0,
      duration: Number.NaN,
      paused: true,
      ended: false,
      plays: 0,
      pauses: 0,
      play() {
        el.plays += 1
        el.paused = false
      },
      pause() {
        el.pauses += 1
        el.paused = true
      },
      addEventListener: () => undefined,
    }
    elements.push(el)
    return el
  }
  const engine = createWebAudioEngine({ createContext: () => ctx, createElement, setInterval: () => 1, clearInterval: () => undefined }, opts)
  return { engine, gains, elements, advance: (s: number) => (time += s), time: () => time }
}

const track = (id: string, lufs: number | undefined, extra: Partial<CatalogTrack> = {}): CatalogTrack => ({
  id,
  url: `https://example.com/${id}.mp3`,
  title: id,
  duration: 240,
  loudnessClass: "music",
  ...(lufs === undefined ? {} : { loudnessLufs: lufs, truePeakDb: -9 }),
  ...extra,
})

// gains[0] master, then per deck: fade, level (deck A: 1,2; deck B: 3,4)
const deckA = (g: ReturnType<typeof setup>["gains"]) => ({ fade: g[1]!.gain, level: g[2]!.gain })
const deckB = (g: ReturnType<typeof setup>["gains"]) => ({ fade: g[3]!.gain, level: g[4]!.gain })
const lastSet = (p: ReturnType<typeof fakeParam>) => [...p.calls].reverse().find((c) => c.kind === "set")?.value

describe("web audio engine: levelling", () => {
  it("can boost: a quiet track with room under the peak is raised before it is heard", async () => {
    const t = setup()
    await t.engine.play(track("a", -20)) // -20 -> -14 : +6 dB
    expect(lastSet(deckA(t.gains).level)).toBeCloseTo(10 ** (6 / 20), 6)
    expect(lastSet(deckA(t.gains).level)!).toBeGreaterThan(1)
    expect(t.engine.state().activeGainDb).toBe(6)
  })
  it("does not boost past the peak room", async () => {
    const t = setup()
    await t.engine.play(track("a", -20, { truePeakDb: -2 })) // wants +6, room 1
    expect(t.engine.state().activeGainDb).toBe(1)
  })
  it("turns a loud track down", async () => {
    const t = setup()
    await t.engine.play(track("a", -8))
    expect(t.engine.state().activeGainDb).toBe(-6)
  })
  it("plays an unmeasured track as it is, and everything as it is when leveling is off", async () => {
    const t = setup()
    await t.engine.play(track("a", undefined))
    expect(t.engine.state().activeGainDb).toBe(0)
    let on = false
    const off = setup({ isEnabled: () => on })
    await off.engine.play(track("a", -8))
    expect(off.engine.state().activeGainDb).toBe(0)
  })
  it("a switch flipped while playing glides instead of jumping", async () => {
    let on = false
    const t = setup({ isEnabled: () => on })
    await t.engine.play(track("a", -8))
    on = true
    t.engine.refresh()
    expect([...deckA(t.gains).level.calls].reverse().find((c) => c.kind === "target" || c.kind === "set")?.kind).toBe("target")
    expect(t.engine.state().activeGainDb).toBe(-6)
  })
  it("the listener's volume is the master gain", async () => {
    const t = setup()
    await t.engine.play(track("a", -14))
    t.engine.setVolume(0.4)
    expect(lastSet(t.gains[0]!.gain)).toBe(0.4)
    t.engine.setVolume(5)
    expect(lastSet(t.gains[0]!.gain)).toBe(1)
  })
})

describe("web audio engine: preload and crossfade", () => {
  it("preloads the next track 25 s before the end, into the other deck, levelled before it is heard", async () => {
    const t = setup()
    await t.engine.play(track("a", -14), track("b", -8))
    t.elements[0]!.duration = 240
    t.elements[0]!.currentTime = 100
    t.engine.tick()
    expect(t.elements[1]!.src).toBe("")
    t.elements[0]!.currentTime = 216
    t.engine.tick()
    expect(t.elements[1]!.src).toBe("https://example.com/b.mp3")
    expect(t.elements[1]!.plays).toBe(0) // loaded, not playing
    expect(lastSet(deckB(t.gains).level)).toBeCloseTo(10 ** (-6 / 20), 6)
  })

  it("starts an equal-power crossfade a fade-length before the end, on both decks, with the same curves", async () => {
    const t = setup()
    await t.engine.play(track("a", -14), track("b", -14))
    t.elements[0]!.duration = 240
    t.elements[0]!.currentTime = 216
    t.engine.tick() // preload
    t.elements[1]!.duration = 240
    t.elements[0]!.currentTime = 237.9
    t.engine.tick()
    expect(t.engine.state().fading).toBe(false)
    t.elements[0]!.currentTime = 238
    t.advance(10)
    t.engine.tick()
    expect(t.engine.state().fading).toBe(true)
    expect(t.elements[1]!.plays).toBe(1)
    const out = deckA(t.gains).fade.calls.find((c) => c.kind === "curve")!
    const into = deckB(t.gains).fade.calls.find((c) => c.kind === "curve")!
    expect(out.duration).toBe(2)
    expect(into.duration).toBe(2)
    expect(out.at).toBe(10)
    expect(into.at).toBe(10)
    const ref = equalPowerCurves(64)
    expect([...out.values!]).toEqual([...ref.out])
    expect([...into.values!]).toEqual([...ref.in])
    // the sum of powers is level at every sample of the two curves
    for (let i = 0; i < 64; i += 1) expect(out.values![i]! ** 2 + into.values![i]! ** 2).toBeCloseTo(1, 5)
  })

  it("tells the listener which track is on, then stops the leaving deck only after the tail", async () => {
    const t = setup()
    const heard: string[] = []
    t.engine.onTrackChange((tr) => heard.push(tr.id))
    await t.engine.play(track("a", -14), track("b", -14))
    t.elements[0]!.duration = 240
    t.elements[0]!.currentTime = 216
    t.engine.tick()
    t.elements[1]!.duration = 240
    t.elements[0]!.currentTime = 238.2
    t.engine.tick()
    expect(heard).toEqual(["b"])
    expect(t.engine.state().active).toBe("b")
    expect(t.elements[0]!.pauses).toBe(0)
    t.advance(1)
    t.engine.tick()
    expect(t.elements[0]!.pauses).toBe(0) // fade still running
    t.advance(2)
    t.engine.tick()
    expect(t.elements[0]!.pauses).toBe(1)
    expect(t.engine.state().fading).toBe(false)
  })

  it("does not overlap a discourse after music: waits for the end, then starts it with no gap", async () => {
    const t = setup()
    await t.engine.play(track("a", -14), track("talk", -16, { loudnessClass: "speech" }))
    t.elements[0]!.duration = 240
    t.elements[0]!.currentTime = 216
    t.engine.tick()
    t.elements[1]!.duration = 600
    t.elements[0]!.currentTime = 239
    t.engine.tick()
    expect(t.engine.state().plan).toEqual({ mode: "gapless", reason: "class-change" })
    expect(t.elements[1]!.plays).toBe(0)
    t.elements[0]!.currentTime = 239.97
    t.engine.tick()
    expect(t.elements[1]!.plays).toBe(1)
    expect(t.engine.state().fading).toBe(false)
    expect(t.engine.state().active).toBe("talk")
    expect(t.elements[0]!.pauses).toBe(1)
  })

  it("does not crossfade when the crossfade switch is off (gapless instead)", async () => {
    const t = setup({ crossfade: () => false })
    await t.engine.play(track("a", -14), track("b", -14))
    t.elements[0]!.duration = 240
    t.elements[0]!.currentTime = 216
    t.engine.tick()
    t.elements[1]!.duration = 240
    t.elements[0]!.currentTime = 238.5
    t.engine.tick()
    expect(t.engine.state().plan).toEqual({ mode: "gapless", reason: "disabled" })
    expect(t.elements[1]!.plays).toBe(0)
  })

  it("does not overlap two tracks whose levelled loudness differs by more than 4 dB", async () => {
    const t = setup()
    // -30 is raised only by its peak room (+8 dB with a peak at -9), so it stays 8 dB below -14
    await t.engine.play(track("a", -14), track("b", -30, { truePeakDb: -9 }))
    t.elements[0]!.duration = 240
    t.elements[0]!.currentTime = 216
    t.engine.tick()
    t.elements[1]!.duration = 240
    t.elements[0]!.currentTime = 238.5
    t.engine.tick()
    expect(t.engine.state().plan).toEqual({ mode: "gapless", reason: "level-gap" })
  })

  it("a new play() while a fade runs stops the leaving deck at once", async () => {
    const t = setup()
    await t.engine.play(track("a", -14), track("b", -14))
    t.elements[0]!.duration = 240
    t.elements[0]!.currentTime = 216
    t.engine.tick()
    t.elements[1]!.duration = 240
    t.elements[0]!.currentTime = 238
    t.engine.tick()
    expect(t.engine.state().fading).toBe(true)
    await t.engine.play(track("c", -14))
    expect(t.engine.state().fading).toBe(false)
    expect(t.engine.state().active).toBe("c")
  })

  it("pause stops what is playing and the scheduler does nothing while paused", async () => {
    const t = setup()
    await t.engine.play(track("a", -14), track("b", -14))
    t.engine.pause()
    expect(t.elements[0]!.paused).toBe(true)
    t.elements[0]!.duration = 240
    t.elements[0]!.currentTime = 238
    t.engine.tick()
    expect(t.elements[1]!.plays).toBe(0)
  })
})
