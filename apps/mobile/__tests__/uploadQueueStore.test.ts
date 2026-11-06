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
const cancelSimilar = vi.fn(async () => undefined)
vi.mock("@/lib/kirtan/uploadRunner", () => ({
  runUpload: (...args: unknown[]) => runUpload(...args),
  cancelSimilar: (...args: unknown[]) => cancelSimilar(...(args as [])),
}))

import { useKirtanStore } from "@/stores/kirtanStore"
import { EMPTY_DRAFT, useUploadQueueStore, yearOf } from "@/stores/uploadQueueStore"

const queue = () => useUploadQueueStore.getState()
const pick = (...names: string[]) => queue().addFiles(names.map((name) => ({ name, uri: `blob:${name}`, size: 1000, type: "audio/mpeg" })))
const statuses = () => queue().items.map((i) => i.status)

beforeEach(() => {
  runUpload.mockReset()
  cancelSimilar.mockClear()
  useKirtanStore.getState().reset()
  queue().reset()
  queue().setDraft({ performer: "Priya Devi" })
})

describe("the form of the queue", () => {
  it("reads the year as four digits or nothing", () => {
    expect(yearOf("2019")).toBe(2019)
    expect(yearOf(" 2019 ")).toBe(2019)
    expect(yearOf("")).toBeNull()
    expect(yearOf("19")).toBeNull()
    expect(yearOf("20190")).toBeNull()
  })

  it("starts empty: Kiirtan, no song, nothing ticked", () => {
    expect(EMPTY_DRAFT).toMatchObject({ kind: "kiirtan", psSong: null, byAuthor: false, language: null })
  })
})

describe("uploading the queue", () => {
  it("sends every row with the shared choices and its own title, one after another", async () => {
    queue().setDraft({ kind: "bhajan", language: "hindi", credits: "Words by X", year: "2001", notes: "live", byAuthor: true })
    pick("Morning_round.mp3", "Evening.mp3")
    queue().setTitle(queue().items[1]!.id, "Evening bhajan")
    const order: string[] = []
    runUpload.mockImplementation(async (id: string) => {
      order.push(useKirtanStore.getState().submissions.find((k) => k.id === id)!.title)
      return { status: "published" }
    })
    await queue().start()
    expect(order).toEqual(["Morning round", "Evening bhajan"])
    expect(statuses()).toEqual(["done", "done"])
    const stored = useKirtanStore.getState().submissions
    expect(stored).toHaveLength(2)
    expect(stored[0]).toMatchObject({ kind: "bhajan", author: "Priya Devi", language: "hindi", credits: "Words by X", year: 2001, notes: "live", byAuthor: true })
    expect(queue().running).toBe(false)
  })

  it("a Prabhat Samgiita recording carries its song number", async () => {
    queue().setDraft({ kind: "prabhat_samgiita", psSong: { number: 1234, title: "Some song" } })
    pick("take1.mp3")
    runUpload.mockResolvedValue({ status: "published" })
    await queue().start()
    expect(useKirtanStore.getState().submissions[0]).toMatchObject({ kind: "prabhat_samgiita", psSong: 1234 })
  })

  it("a Prabhat Samgiita recording without a song is refused before it is stored", async () => {
    queue().setDraft({ kind: "prabhat_samgiita", psSong: null })
    pick("take1.mp3")
    runUpload.mockResolvedValue({ status: "published" })
    await queue().start()
    expect(runUpload).not.toHaveBeenCalled()
    expect(useKirtanStore.getState().submissions).toHaveLength(0)
    expect(statuses()).toEqual(["failed"])
  })

  it("a failed row stays in the queue with Try again and does not stay in the person's list", async () => {
    pick("a.mp3", "b.mp3")
    runUpload.mockResolvedValueOnce({ status: "failed", failure: { code: "network" } }).mockResolvedValueOnce({ status: "published" })
    await queue().start()
    expect(statuses()).toEqual(["failed", "done"])
    expect(useKirtanStore.getState().submissions).toHaveLength(1)
    runUpload.mockResolvedValueOnce({ status: "published" })
    await queue().retry(queue().items[0]!.id)
    expect(statuses()).toEqual(["done", "done"])
    expect(useKirtanStore.getState().submissions).toHaveLength(2)
  })

  it("a duplicate does not block the rest, and a similar row waits for its own answer", async () => {
    pick("a.mp3", "b.mp3", "c.mp3")
    runUpload
      .mockResolvedValueOnce({ status: "failed", failure: { code: "duplicate", original: { id: "r0", title: "Old", author: "B", audioUrl: "u" } } })
      .mockResolvedValueOnce({ status: "similar", key: "k2", similar: [] })
      .mockResolvedValueOnce({ status: "published" })
    await queue().start()
    expect(statuses()).toEqual(["duplicate", "similar", "done"])
    expect(queue().items[0]!.original).toMatchObject({ id: "r0" })
    expect(queue().stopped).toBeNull()
    // "Yes, it is a different performance": the stored file is confirmed, nothing is sent twice
    runUpload.mockResolvedValueOnce({ status: "published" })
    await queue().decideSimilar(queue().items[1]!.id, true)
    expect(runUpload).toHaveBeenLastCalledWith(expect.any(String), { confirmDifferent: true, key: "k2" })
    expect(statuses()).toEqual(["duplicate", "done", "done"])
  })

  it("answering No to a similar row deletes the file on the server and takes the row away", async () => {
    pick("a.mp3")
    runUpload.mockResolvedValueOnce({ status: "similar", key: "k1", similar: [] })
    await queue().start()
    expect(useKirtanStore.getState().submissions).toHaveLength(1)
    await queue().decideSimilar(queue().items[0]!.id, false)
    expect(cancelSimilar).toHaveBeenCalledWith("k1")
    expect(queue().items).toHaveLength(0)
    expect(useKirtanStore.getState().submissions).toHaveLength(0)
  })

  it("the daily limit keeps the rest for tomorrow; starting again continues from there", async () => {
    pick("a.mp3", "b.mp3", "c.mp3")
    runUpload.mockResolvedValueOnce({ status: "published" }).mockResolvedValueOnce({ status: "failed", failure: { code: "dailyLimit" } })
    await queue().start()
    expect(queue().stopped).toBe("dailyLimit")
    expect(statuses()).toEqual(["done", "limit", "waiting"])
    runUpload.mockResolvedValue({ status: "published" })
    await queue().start()
    expect(statuses()).toEqual(["done", "done", "done"])
    expect(queue().stopped).toBeNull()
  })

  it("does not start a second run while one is going", async () => {
    pick("a.mp3")
    let release: (value: unknown) => void = () => undefined
    runUpload.mockImplementation(() => new Promise((resolve) => (release = resolve)))
    const first = queue().start()
    expect(queue().running).toBe(true)
    await queue().start()
    expect(runUpload).toHaveBeenCalledTimes(1)
    release({ status: "published" })
    await first
    expect(queue().running).toBe(false)
  })

  it("keeps its rows and choices when the screen is left, and clearFinished drops only the finished ones", async () => {
    pick("a.mp3", "b.mp3")
    runUpload.mockResolvedValueOnce({ status: "published" }).mockResolvedValueOnce({ status: "failed", failure: { code: "network" } })
    await queue().start()
    queue().clearFinished()
    expect(queue().items.map((i) => i.fileName)).toEqual(["b.mp3"])
    expect(queue().draft.performer).toBe("Priya Devi")
  })
})
