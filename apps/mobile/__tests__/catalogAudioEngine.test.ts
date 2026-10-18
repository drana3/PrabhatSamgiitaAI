import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("expo-av", () => ({
  Audio: {
    Sound: { createAsync: vi.fn() },
    setAudioModeAsync: vi.fn(async () => undefined),
    setIsEnabledAsync: vi.fn(async () => undefined),
  },
}))

import {
  beginSkipGeneration,
  getActiveSound,
  getCatalogAudioBag,
  getLoadId,
  setActiveSound,
  stopFully,
} from "@/lib/playback/catalogAudioEngine"

function mockSound() {
  return {
    setOnPlaybackStatusUpdate: vi.fn(),
    stopAsync: vi.fn().mockResolvedValue(undefined),
    pauseAsync: vi.fn().mockResolvedValue(undefined),
    unloadAsync: vi.fn().mockResolvedValue(undefined),
  }
}

describe("catalogAudioEngine", () => {
  beforeEach(() => {
    const bag = getCatalogAudioBag()
    bag.__psAudioChain = Promise.resolve()
    bag.__psAdvancingQueue = false
    bag.__psLoadId = 10
    bag.__psPlayToken = 20
    setActiveSound(null)
  })

  afterEach(() => {
    setActiveSound(null)
  })

  it("stopFully unloads the active sound and clears the handle", async () => {
    const sound = mockSound()
    setActiveSound(sound as never)
    await stopFully()
    expect(getActiveSound()).toBeNull()
    expect(sound.unloadAsync).toHaveBeenCalled()
  })

  it("beginSkipGeneration bumps load id without stopping native audio itself", async () => {
    const sound = mockSound()
    setActiveSound(sound as never)
    const before = getLoadId()
    const id = beginSkipGeneration()
    expect(id).toBe(before + 1)
    expect(getCatalogAudioBag().__psAdvancingQueue).toBe(true)
    expect(getActiveSound()).toBe(sound)
    expect(sound.unloadAsync).not.toHaveBeenCalled()
  })
})
