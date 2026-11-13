import { describe, expect, it, vi } from "vitest"

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

import { keepSavedState } from "@/lib/persistMigrate"
import { useAssistantStore } from "@/stores/assistantStore"
import { useProfileStore } from "@/stores/profileStore"
import { useResumeStore } from "@/stores/resumeStore"

describe("keepSavedState", () => {
  it("keeps an object as it is", () => {
    const saved = { a: 1 }
    expect(keepSavedState(saved)).toBe(saved)
  })
  it("turns anything else into an empty save", () => {
    expect(keepSavedState(null)).toEqual({})
    expect(keepSavedState("x")).toEqual({})
    expect(keepSavedState([1])).toEqual({})
  })
})

describe("saves made before the stores had a version", () => {
  it("assistant: language and tally survive", async () => {
    memory.set(
      "prabhat-assistant-v2",
      JSON.stringify({ state: { language: "ru", quotaByAccount: { me: { day: "2026-01-01", count: 3 } } } }),
    )
    await useAssistantStore.persist.rehydrate()
    expect(useAssistantStore.getState().language).toBe("ru")
    expect(useAssistantStore.getState().quotaByAccount.me).toEqual({ day: "2026-01-01", count: 3 })
  })

  it("resume: positions survive", async () => {
    const entries = { "7": { position: 42, duration: 300, updatedAt: 1, versionId: null } }
    memory.set("ps.resume", JSON.stringify({ state: { entries, owner: "guest", slots: {} } }))
    await useResumeStore.persist.rehydrate()
    expect(useResumeStore.getState().entries).toEqual(entries)
    expect(useResumeStore.getState().owner).toBe("guest")
  })

  it("profile: name survives", async () => {
    memory.set(
      "prabhat-profile",
      JSON.stringify({ state: { owner: "guest", name: "Asha", photoUri: null, providerPhotoUrl: null } }),
    )
    await useProfileStore.persist.rehydrate()
    expect(useProfileStore.getState().name).toBe("Asha")
  })
})
