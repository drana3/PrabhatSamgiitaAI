import { describe, expect, it, vi } from "vitest"

vi.mock("@react-native-async-storage/async-storage", () => {
  const memory = new Map<string, string>()
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value)
      },
      removeItem: async (key: string) => {
        memory.delete(key)
      },
      clear: async () => {
        memory.clear()
      },
    },
  }
})

import AsyncStorage from "@react-native-async-storage/async-storage"

import { usePageHintsStore } from "@/stores/pageHintsStore"

const KEY = "prabhat-page-hints"
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe("hints that show once", () => {
  it("start unseen: the dot on the player's i button and the captions under the song page icons", () => {
    const s = usePageHintsStore.getState()
    expect(s.aboutHintSeen).toBe(false)
    expect(s.actionCaptionsSeen).toBe(false)
  })

  it("end for good once seen, and are kept on the phone", async () => {
    usePageHintsStore.getState().markAboutHintSeen()
    usePageHintsStore.getState().markActionCaptionsSeen()
    await tick()
    expect(usePageHintsStore.getState().aboutHintSeen).toBe(true)
    expect(usePageHintsStore.getState().actionCaptionsSeen).toBe(true)
    const saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? "{}") as { state?: Record<string, unknown> }
    expect(saved.state).toEqual({ aboutHintSeen: true, actionCaptionsSeen: true })
  })
})
