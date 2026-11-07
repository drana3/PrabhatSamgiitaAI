import { beforeEach, describe, expect, it, vi } from "vitest"

const memory = vi.hoisted(() => new Map<string, string>())

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

import { CHORD_NOTICE_PREFIX, RETIRED_KEYS, withoutChordNotices } from "@/lib/songChords/retireTestData"
import { useChordDraftStore } from "@/stores/chordDraftStore"
import { useChordNoticeStore } from "@/stores/chordNoticeStore"

beforeEach(() => memory.clear())

describe("retiring the chord test data of the preview", () => {
  it("keeps every notice that is not about a chord chart", () => {
    const items = [{ id: "chords:a:published" }, { id: "recording:3" }, { id: "chords:b:rejected" }, { id: "news:1" }]
    expect(withoutChordNotices(items).map((i) => i.id)).toEqual(["recording:3", "news:1"])
    expect(withoutChordNotices([])).toEqual([])
    expect(CHORD_NOTICE_PREFIX).toBe("chords:")
  })

  it("the stores moved to a new key, so the old keys hold nothing the app still reads", () => {
    const draftKey = useChordDraftStore.persist.getOptions().name
    const noticeKey = useChordNoticeStore.persist.getOptions().name
    expect(draftKey).toBe("prabhat-chord-draft-v2")
    expect(noticeKey).toBe("prabhat-chord-notices-v2")
    expect(RETIRED_KEYS).toEqual(["prabhat-chord-draft-v1", "prabhat-chord-notices-v1"])
    for (const key of [draftKey, noticeKey]) expect(RETIRED_KEYS).not.toContain(key)
  })

  it("an old draft under the retired key is not loaded into the new store", async () => {
    memory.set("prabhat-chord-draft-v1", JSON.stringify({ state: { drafts: { "song:1:guitar": { key: "song:1:guitar" } } }, version: 2 }))
    await useChordDraftStore.persist.rehydrate()
    expect(Object.keys(useChordDraftStore.getState().drafts)).toEqual([])
  })

  it("removes the old keys once, and the chord notices of the old tests with them", async () => {
    vi.resetModules()
    memory.set("prabhat-chord-draft-v1", "{}")
    memory.set("prabhat-chord-notices-v1", "{}")
    memory.set("something-else", "kept")
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    await useNotificationsStore.persist.rehydrate()
    useNotificationsStore.setState({ items: [{ id: "chords:x:published" }, { id: "recording:1" }] as never })
    const { retireTestData } = await import("@/lib/songChords/retireTestData")
    await retireTestData()
    expect(memory.has("prabhat-chord-draft-v1")).toBe(false)
    expect(memory.has("prabhat-chord-notices-v1")).toBe(false)
    expect(memory.get("something-else")).toBe("kept")
    expect(useNotificationsStore.getState().items.map((i) => i.id)).toEqual(["recording:1"])
  })

  it("does nothing when there is nothing old to remove", async () => {
    vi.resetModules()
    memory.set("something-else", "kept")
    const { useNotificationsStore } = await import("@/stores/notificationsStore")
    useNotificationsStore.setState({ items: [{ id: "chords:x:published" }] as never })
    const { retireTestData } = await import("@/lib/songChords/retireTestData")
    await retireTestData()
    expect(useNotificationsStore.getState().items).toHaveLength(1)
  })
})
