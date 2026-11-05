import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const bh = vi.hoisted(() => {
  const listeners: Array<() => boolean | null | undefined> = []
  return {
    listeners,
    /** Same contract as React Native: newest listener first, stop at the first that returns true. */
    press() {
      for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i]!()) return true
      return false
    },
    add: (_event: string, fn: () => boolean | null | undefined) => {
      listeners.push(fn)
      return { remove: () => listeners.splice(listeners.indexOf(fn), 1) }
    },
  }
})

vi.mock("react-native", () => ({ BackHandler: { addEventListener: bh.add } }))

import { registerSheetBack } from "@/lib/sheetBack"

describe("registerSheetBack", () => {
  beforeEach(() => {
    bh.listeners.length = 0
  })

  it("closes the sheet and swallows the Back press", () => {
    const close = vi.fn()
    registerSheetBack(close)
    expect(bh.press()).toBe(true)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it("closes the newest sheet first, then the next one, then lets the screen go", () => {
    const screen = vi.fn(() => false)
    bh.add("hardwareBackPress", screen)
    const first = vi.fn()
    const second = vi.fn()
    const removeFirst = registerSheetBack(first)
    const removeSecond = registerSheetBack(second)

    bh.press()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    removeSecond()

    bh.press()
    expect(first).toHaveBeenCalledTimes(1)
    removeFirst()

    bh.press()
    expect(screen).toHaveBeenCalledTimes(1)
  })

  it("stops listening once removed", () => {
    const close = vi.fn()
    const remove = registerSheetBack(close)
    remove()
    expect(bh.press()).toBe(false)
    expect(close).not.toHaveBeenCalled()
  })
})

describe("every bottom sheet uses the central hook", () => {
  const root = path.resolve(__dirname, "..")
  for (const file of [
    "components/player-v2/Sheet.tsx",
    "components/profile-v2/ConfirmSheet.tsx",
    "components/learn-v2/ReviewStyleSheet.tsx",
  ]) {
    it(file, () => {
      expect(readFileSync(path.join(root, file), "utf8")).toContain("useSheetBackHandler(")
    })
  }
})
