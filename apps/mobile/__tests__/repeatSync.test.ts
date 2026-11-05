import { describe, expect, it, vi } from "vitest"

import { createRepeatSync } from "@/lib/playerV2/repeatSync"
import type { RepeatMode } from "@/lib/playerV2/controller"

function setup(mode: RepeatMode, loop: boolean) {
  const state = { mode, loop }
  const toggle = vi.fn(() => {
    state.loop = !state.loop
  })
  const sync = createRepeatSync({
    getRepeatMode: () => state.mode,
    getEngineLoop: () => state.loop,
    toggleEngineLoop: toggle,
  })
  return { state, toggle, sync }
}

describe("repeat single source of truth", () => {
  it("turns a stray engine loop off when the screen says repeat off or all", () => {
    for (const mode of ["off", "all"] as const) {
      const { sync, toggle, state } = setup(mode, true)
      sync()
      expect(toggle).toHaveBeenCalledTimes(1)
      expect(state.loop).toBe(false)
    }
  })
  it("turns the engine loop on only for repeat one", () => {
    const { sync, state } = setup("one", false)
    sync()
    expect(state.loop).toBe(true)
  })
  it("does nothing when they already agree, however often it runs", () => {
    const { sync, toggle } = setup("one", true)
    sync()
    sync()
    expect(toggle).not.toHaveBeenCalled()
  })
})
