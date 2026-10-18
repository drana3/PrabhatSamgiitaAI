import { afterEach, describe, expect, it, vi } from "vitest"

import { createHarmoniumKeyVoiceGate, HARMONIUM_MIN_NOTE_MS } from "./harmonium-key-voices"

describe("harmonium key voices", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps a fast tap sounding for the minimum hold", () => {
    vi.useFakeTimers()
    const gate = createHarmoniumKeyVoiceGate()
    const stop = vi.fn()
    gate.press(3).attach(stop)
    gate.release(3)
    expect(stop).not.toHaveBeenCalled()
    vi.advanceTimersByTime(HARMONIUM_MIN_NOTE_MS - 1)
    expect(stop).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it("retriggers the same key immediately on a second tap", () => {
    vi.useFakeTimers()
    const gate = createHarmoniumKeyVoiceGate()
    const first = vi.fn()
    const second = vi.fn()
    gate.press(1).attach(first)
    gate.release(1)
    gate.press(1).attach(second)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    gate.release(1)
    vi.advanceTimersByTime(HARMONIUM_MIN_NOTE_MS)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)
  })

  it("still sounds when release arrives before audio attaches", () => {
    vi.useFakeTimers()
    const gate = createHarmoniumKeyVoiceGate()
    const stop = vi.fn()
    const { attach } = gate.press(0)
    gate.release(0)
    attach(stop)
    expect(stop).not.toHaveBeenCalled()
    vi.advanceTimersByTime(HARMONIUM_MIN_NOTE_MS)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it("drops a superseded attach so a late start cannot kill the new note", () => {
    const gate = createHarmoniumKeyVoiceGate()
    const stale = vi.fn()
    const fresh = vi.fn()
    const first = gate.press(4)
    gate.press(4).attach(fresh)
    first.attach(stale)
    expect(stale).toHaveBeenCalledTimes(1)
    expect(fresh).not.toHaveBeenCalled()
    gate.release(4)
  })
})
