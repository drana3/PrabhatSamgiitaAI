import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }))
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined },
}))

import { MAX_MESSAGES_PER_THREAD, MAX_THREADS_PER_ACCOUNT, createDebouncedStorage, trimHistory } from "@/lib/chatStorage"

describe("assistant history storage", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("writes once after a burst of updates, with the last value", async () => {
    const set = vi.fn(async () => undefined)
    const storage = createDebouncedStorage({ getItem: async () => null, setItem: set, removeItem: async () => undefined }, 500)
    for (let i = 0; i < 40; i += 1) storage.setItem("k", `v${i}`)
    expect(set).not.toHaveBeenCalled()
    expect(await storage.getItem("k")).toBe("v39")
    await vi.advanceTimersByTimeAsync(600)
    expect(set).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith("k", "v39")
  })

  it("flush writes at once", async () => {
    const set = vi.fn(async () => undefined)
    const storage = createDebouncedStorage({ getItem: async () => null, setItem: set, removeItem: async () => undefined }, 500)
    storage.setItem("k", "x")
    await storage.flush()
    expect(set).toHaveBeenCalledWith("k", "x")
  })

  it("a removal drops a write that was still waiting", async () => {
    const set = vi.fn(async () => undefined)
    const remove = vi.fn(async () => undefined)
    const storage = createDebouncedStorage({ getItem: async () => null, setItem: set, removeItem: remove }, 500)
    storage.setItem("k", "x")
    await storage.removeItem("k")
    await vi.advanceTimersByTimeAsync(600)
    expect(set).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith("k")
  })

  it("keeps the newest threads and messages", () => {
    const threads = Array.from({ length: MAX_THREADS_PER_ACCOUNT + 5 }, (_, i) => ({
      id: String(i),
      updatedAt: i,
      messages: Array.from({ length: i === MAX_THREADS_PER_ACCOUNT + 4 ? MAX_MESSAGES_PER_THREAD + 30 : 2 }, (_, j) => j),
    }))
    const kept = trimHistory(threads)
    expect(kept).toHaveLength(MAX_THREADS_PER_ACCOUNT)
    expect(kept[0]!.id).toBe(String(MAX_THREADS_PER_ACCOUNT + 4))
    expect(kept[0]!.messages).toHaveLength(MAX_MESSAGES_PER_THREAD)
    expect(kept[0]!.messages[0]).toBe(30)
  })
})
