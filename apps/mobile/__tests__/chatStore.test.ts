import { beforeEach, describe, expect, it, vi } from "vitest"

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

import { useChatStore } from "@/stores/chatStore"

describe("chatStore song scoping", () => {
  beforeEach(() => {
    useChatStore.setState({ byAccount: {} })
  })

  it("keeps separate active threads per song number", () => {
    const accountId = "member:test@example.com"
    const store = useChatStore.getState()

    store.ensureScopeThread(accountId, 12)
    const assistantId = store.beginExchange(accountId, "What is song 12 about?")
    expect(assistantId).toBeTruthy()
    store.updateAssistantMessage(accountId, assistantId!, "Song 12 is about devotion.")

    store.ensureScopeThread(accountId, 99)
    expect(store.getActiveThread(accountId)?.songNumber).toBe(99)
    expect(store.getActiveThread(accountId)?.messages).toHaveLength(0)

    store.ensureScopeThread(accountId, 12)
    const song12 = store.getActiveThread(accountId)
    expect(song12?.songNumber).toBe(12)
    expect(song12?.messages.some((m) => m.text.includes("song 12"))).toBe(true)
  })

  it("does not switch away from a matching new chat in the same song scope", () => {
    const accountId = "guest"
    const store = useChatStore.getState()
    store.ensureScopeThread(accountId, 5)
    const firstId = store.getActiveThread(accountId)?.id
    const secondId = store.startNewThread(accountId, 5)
    expect(secondId).not.toBe(firstId)
    store.ensureScopeThread(accountId, 5)
    expect(store.getActiveThread(accountId)?.id).toBe(secondId)
  })
})
