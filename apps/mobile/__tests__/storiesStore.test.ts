import { beforeEach, describe, expect, it, vi } from "vitest"

const memory = new Map<string, string>()
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: async (key: string) => {
      memory.delete(key)
    },
  },
}))

import { useStoriesStore } from "@/stores/storiesStore"

describe("storiesStore", () => {
  beforeEach(() => {
    memory.clear()
    useStoriesStore.setState({ read: {} })
  })

  it("marks a story read once and unread again", () => {
    useStoriesStore.getState().markRead("a", 10)
    useStoriesStore.getState().markRead("a", 99)
    expect(useStoriesStore.getState().read).toEqual({ a: 10 })
    useStoriesStore.getState().markUnread("a")
    expect(useStoriesStore.getState().read).toEqual({})
  })

  it("keeps the read map under the key prabhat-stories", async () => {
    useStoriesStore.getState().markRead("b", 5)
    await Promise.resolve()
    const saved = JSON.parse(memory.get("prabhat-stories") ?? "{}")
    expect(saved.state.read).toEqual({ b: 5 })
  })

  it("restores a saved map and drops damaged entries", async () => {
    memory.set("prabhat-stories", JSON.stringify({ state: { read: { c: 7, d: "x" } }, version: 1 }))
    await useStoriesStore.persist.rehydrate()
    expect(useStoriesStore.getState().read).toEqual({ c: 7 })
  })
})
