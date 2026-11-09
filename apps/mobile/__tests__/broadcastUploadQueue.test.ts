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
    },
  }
})

const runUpload = vi.fn()
vi.mock("@/lib/kirtan/uploadRunner", () => ({
  runUpload: (...args: unknown[]) => runUpload(...args),
  cancelSimilar: async () => undefined,
}))
vi.mock("@/stores/recordingChordsPendingStore", () => ({
  useRecordingChordsPendingStore: { getState: () => ({ flush: async () => undefined, forget: () => undefined }) },
}))

import { useKirtanStore } from "@/stores/kirtanStore"
import { useUploadQueueStore } from "@/stores/uploadQueueStore"

/** The queue remembers which broadcast the file is for, and sends it with the file (docs/broadcasts.md, "Recordings"). */
const queue = () => useUploadQueueStore.getState()

beforeEach(() => {
  runUpload.mockReset()
  useKirtanStore.getState().reset()
  queue().reset()
  queue().setDraft({ performer: "Priya Devi", style: "bengali", recordingType: "studio", performance: "solo" })
})

describe("the queue and a broadcast", () => {
  it("sets it, clears it, and resets with the queue", () => {
    expect(queue().forBroadcast).toBeNull()
    queue().setBroadcast({ id: "b-1", title: "Friday satsang" })
    expect(queue().forBroadcast).toEqual({ id: "b-1", title: "Friday satsang" })
    queue().setBroadcast(null)
    expect(queue().forBroadcast).toBeNull()
    queue().setBroadcast({ id: "b-2", title: "T" })
    queue().reset()
    expect(queue().forBroadcast).toBeNull()
  })

  it("does not change it while an upload runs", () => {
    queue().setBroadcast({ id: "b-1", title: "T" })
    useUploadQueueStore.setState({ running: true })
    queue().setBroadcast({ id: "b-2", title: "Other" })
    expect(queue().forBroadcast).toEqual({ id: "b-1", title: "T" })
    useUploadQueueStore.setState({ running: false })
  })

  it("stores the file with the broadcast it is for, and with none otherwise", async () => {
    runUpload.mockResolvedValue({ status: "published" })
    queue().setBroadcast({ id: "b-1", title: "Friday satsang" })
    queue().addFiles([{ name: "satsang.mp3", uri: "blob:a", size: 1000, type: "audio/mpeg" }])
    await queue().start()
    expect(useKirtanStore.getState().submissions[0]).toMatchObject({ broadcastId: "b-1" })
    queue().reset()
    queue().setDraft({ performer: "Priya Devi", style: "bengali", recordingType: "studio", performance: "solo" })
    useKirtanStore.getState().reset()
    queue().addFiles([{ name: "other.mp3", uri: "blob:b", size: 1000, type: "audio/mpeg" }])
    await queue().start()
    expect(useKirtanStore.getState().submissions[0]).not.toHaveProperty("broadcastId")
  })
})
