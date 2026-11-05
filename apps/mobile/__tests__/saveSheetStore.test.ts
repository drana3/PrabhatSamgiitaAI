import { afterEach, describe, expect, it, vi } from "vitest"

import { openSaveSheet, useSaveSheetStore } from "@/stores/saveSheetStore"

afterEach(() => {
  useSaveSheetStore.setState({ item: null, toast: null, hosts: [] })
  vi.useRealTimers()
})

describe("saveSheetStore", () => {
  it("opens and closes for an item", () => {
    openSaveSheet({ kind: "song", number: 5 })
    expect(useSaveSheetStore.getState().item).toEqual({ kind: "song", number: 5 })
    useSaveSheetStore.getState().close()
    expect(useSaveSheetStore.getState().item).toBeNull()
  })

  it("the host that mounted last draws, and the earlier one takes over when it leaves", () => {
    const { registerHost } = useSaveSheetStore.getState()
    const offRoot = registerHost("root")
    const offPlayer = registerHost("player")
    expect(useSaveSheetStore.getState().hosts.at(-1)).toBe("player")
    offPlayer()
    expect(useSaveSheetStore.getState().hosts.at(-1)).toBe("root")
    offRoot()
    expect(useSaveSheetStore.getState().hosts).toEqual([])
  })

  it("registering twice does not duplicate a host", () => {
    const { registerHost } = useSaveSheetStore.getState()
    registerHost("a")
    registerHost("a")
    expect(useSaveSheetStore.getState().hosts).toEqual(["a"])
  })

  it("a toast shows its message and clears itself after 1.8 s; a new one restarts the clock", () => {
    vi.useFakeTimers()
    const { showToast } = useSaveSheetStore.getState()
    showToast("Added to Mine")
    const first = useSaveSheetStore.getState().toast
    expect(first?.message).toBe("Added to Mine")
    vi.advanceTimersByTime(1000)
    showToast("Removed from Mine")
    const second = useSaveSheetStore.getState().toast
    expect(second?.message).toBe("Removed from Mine")
    expect(second?.id).not.toBe(first?.id)
    vi.advanceTimersByTime(1000)
    expect(useSaveSheetStore.getState().toast).not.toBeNull()
    vi.advanceTimersByTime(900)
    expect(useSaveSheetStore.getState().toast).toBeNull()
  })
})
