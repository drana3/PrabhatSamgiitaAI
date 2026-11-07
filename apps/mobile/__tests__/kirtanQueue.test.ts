import { describe, expect, it } from "vitest"

import {
  addFiles,
  applyOutcome,
  firstUntitled,
  isRetryable,
  leftForTomorrow,
  makeQueueItem,
  patchItem,
  queueCounts,
  queueProgress,
  queueSummary,
  removeItem,
  requeue,
  requeueAll,
  runQueue,
  setItemTitle,
  titleFromFileName,
  withoutFinished,
  type PickedFile,
  type QueueItem,
  type RowOutcome,
} from "@/lib/kirtan/queue"
import { MAX_UPLOAD_BYTES } from "@/lib/kirtan/rules"

const file = (name: string, size: number | null = 1000, type: string | null = "audio/mpeg"): PickedFile => ({ name, uri: `blob:${name}`, size, type })

let n = 0
const newId = () => `q${(n += 1)}`
const rows = (...names: string[]) => addFiles([], names.map((name) => file(name)), newId).items

/** A queue whose `upload` answers from a script, in the order the rows are sent; returns the rows after the run. */
async function run(items: QueueItem[], answers: Array<RowOutcome | Error>) {
  let state = items
  const sent: string[] = []
  const stop = await runQueue({
    items: () => state,
    patch: (id, patch) => {
      state = patchItem(state, id, patch)
    },
    upload: async (item) => {
      sent.push(item.fileName)
      const answer = answers.shift() ?? { status: "published" as const }
      if (answer instanceof Error) throw answer
      return answer
    },
  })
  return { state, sent, stop }
}

describe("rows", () => {
  it("title from the file name: no extension, underscores read as spaces", () => {
    expect(titleFromFileName("Morning_round_2.mp3")).toBe("Morning round 2")
    expect(titleFromFileName("  Baba   Nam__Kevalam .WAV")).toBe("Baba Nam Kevalam")
    expect(titleFromFileName("no-extension")).toBe("no-extension")
  })

  it("a good file waits with its title; a file the server could never take fails at once with the reason", () => {
    expect(makeQueueItem(file("A_b.mp3"), "x")).toMatchObject({ title: "A b", status: "waiting" })
    expect(makeQueueItem(file("notes.txt", 10, "text/plain"), "x")).toMatchObject({ status: "failed", failure: { code: "format" } })
    expect(makeQueueItem(file("big.mp3", MAX_UPLOAD_BYTES + 1), "x")).toMatchObject({ status: "failed", failure: { code: "size" } })
  })

  it("the same file (name and size) is added once", () => {
    const first = addFiles([], [file("a.mp3"), file("b.mp3")], newId)
    expect(first).toMatchObject({ added: 2, skipped: 0 })
    const again = addFiles(first.items, [file("a.mp3"), file("c.mp3"), file("c.mp3")], newId)
    expect(again).toMatchObject({ added: 1, skipped: 2 })
    expect(again.items.map((i) => i.fileName)).toEqual(["a.mp3", "b.mp3", "c.mp3"])
    // same name, other size: a different file
    expect(addFiles(first.items, [file("a.mp3", 2000)], newId).added).toBe(1)
  })

  it("edits one title, and finds the first waiting row without one", () => {
    const list = rows("a.mp3", "b.mp3")
    const emptied = setItemTitle(list, list[1]!.id, "  ")
    expect(firstUntitled(emptied)?.fileName).toBe("b.mp3")
    expect(firstUntitled(list)).toBeNull()
  })

  it("a row that is being sent cannot be removed; any other can", () => {
    const list = patchItem(rows("a.mp3", "b.mp3"), "none", {})
    const busy = patchItem(list, list[0]!.id, { status: "uploading" })
    expect(removeItem(busy, busy[0]!.id)).toHaveLength(2)
    expect(removeItem(busy, busy[1]!.id).map((i) => i.fileName)).toEqual(["a.mp3"])
  })

  it("only a row that can be sent again goes back in line", () => {
    const base = rows("a.mp3", "b.mp3", "c.mp3")
    const mixed = [
      { ...base[0]!, status: "failed" as const, failure: { code: "network" as const } },
      { ...base[1]!, status: "failed" as const, failure: { code: "format" as const } },
      { ...base[2]!, status: "limit" as const, failure: { code: "dailyLimit" as const } },
    ]
    expect(mixed.map(isRetryable)).toEqual([true, false, true])
    const back = requeueAll(mixed)
    expect(back.map((i) => i.status)).toEqual(["waiting", "failed", "waiting"])
    expect(back[0]).not.toHaveProperty("failure")
    expect(requeue(mixed, mixed[1]!.id)[1]!.status).toBe("failed")
  })

  it("finished rows leave on Add more; the ones that still need the person stay", () => {
    const base = rows("a.mp3", "b.mp3", "c.mp3", "d.mp3")
    const statuses = ["done", "duplicate", "similar", "failed"] as const
    const list = base.map((item, i) => ({ ...item, status: statuses[i]! }))
    expect(withoutFinished(list).map((i) => i.status)).toEqual(["similar", "failed"])
  })
})

describe("what one answer does to one row", () => {
  it("published and local are done", () => {
    expect(applyOutcome({ status: "published", submissionId: "s1" })).toEqual({ patch: { status: "done", failure: undefined, submissionId: "s1" }, stop: null })
    expect(applyOutcome({ status: "local" }).patch.status).toBe("done")
  })

  it("the same file twice, or the person's own copy, is a duplicate and carries the recording that is there", () => {
    const original = { id: "r0", title: "Old", author: "B", audioUrl: "https://x/r0.mp3" }
    expect(applyOutcome({ status: "failed", failure: { code: "duplicate", original } }).patch).toMatchObject({ status: "duplicate", original })
    expect(applyOutcome({ status: "failed", failure: { code: "ownDuplicate" } }).patch.status).toBe("duplicate")
  })

  it("sounds like a library recording: the row waits for the answer, nothing stops", () => {
    const out = applyOutcome({ status: "similar", key: "k1", similar: [{ id: "r0", kind: "kiirtan", title: "Old", author: "B", audio_url: "u" }], submissionId: "s1" })
    expect(out.patch).toMatchObject({ status: "similar", similar: { key: "k1", submissionId: "s1" } })
    expect(out.stop).toBeNull()
  })

  it("the daily limit stops the queue; no sign-in stops it; any other failure does not", () => {
    expect(applyOutcome({ status: "failed", failure: { code: "dailyLimit" } })).toMatchObject({ patch: { status: "limit" }, stop: "dailyLimit" })
    expect(applyOutcome({ status: "failed", failure: { code: "signin" } })).toMatchObject({ patch: { status: "failed" }, stop: "signin" })
    expect(applyOutcome({ status: "failed", failure: { code: "network" } })).toMatchObject({ patch: { status: "failed" }, stop: null })
  })
})

describe("the loop", () => {
  it("sends the rows one after another, in order, whatever each answer is", async () => {
    const list = rows("a.mp3", "b.mp3", "c.mp3", "d.mp3", "e.mp3")
    const { state, sent, stop } = await run(list, [
      { status: "published", submissionId: "s1" },
      { status: "failed", failure: { code: "duplicate" } },
      { status: "similar", key: "k", similar: [], submissionId: "s3" },
      { status: "failed", failure: { code: "network" } },
      { status: "published", submissionId: "s5" },
    ])
    expect(stop).toBeNull()
    expect(sent).toEqual(["a.mp3", "b.mp3", "c.mp3", "d.mp3", "e.mp3"])
    expect(state.map((i) => i.status)).toEqual(["done", "duplicate", "similar", "failed", "done"])
    expect(queueSummary(state)).toEqual({ uploaded: 2, duplicates: 1, needDecision: 1, failed: 1, left: 0 })
    expect(queueProgress(state)).toBe(1)
  })

  it("a thrown error is a failed row, and the others still go", async () => {
    const { state, sent } = await run(rows("a.mp3", "b.mp3"), [new Error("boom"), { status: "published" }])
    expect(sent).toHaveLength(2)
    expect(state.map((i) => i.status)).toEqual(["failed", "done"])
    expect(state[0]!.failure).toMatchObject({ code: "server", message: "boom" })
  })

  it("the daily limit stops after the row it hit; the rest stay waiting for tomorrow and nothing is lost", async () => {
    const list = rows("a.mp3", "b.mp3", "c.mp3", "d.mp3")
    const { state, sent, stop } = await run(list, [{ status: "published" }, { status: "failed", failure: { code: "dailyLimit" } }])
    expect(stop).toBe("dailyLimit")
    expect(sent).toEqual(["a.mp3", "b.mp3"])
    expect(state.map((i) => i.status)).toEqual(["done", "limit", "waiting", "waiting"])
    expect(leftForTomorrow(state)).toBe(3)
    expect(queueSummary(state).left).toBe(3)
    // tomorrow: the rows that stayed go back in line and the run continues from them
    const tomorrow = await run(requeueAll(state), [])
    expect(tomorrow.sent).toEqual(["b.mp3", "c.mp3", "d.mp3"])
    expect(tomorrow.state.every((i) => i.status === "done")).toBe(true)
  })

  it("a run that cannot sign in stops at once", async () => {
    const { stop, sent } = await run(rows("a.mp3", "b.mp3"), [{ status: "failed", failure: { code: "signin" } }])
    expect(stop).toBe("signin")
    expect(sent).toEqual(["a.mp3"])
  })

  it("picks up rows added while it runs and skips rows that are not waiting", async () => {
    let state = rows("a.mp3")
    const sent: string[] = []
    await runQueue({
      items: () => state,
      patch: (id, patch) => {
        state = patchItem(state, id, patch)
      },
      upload: async (item) => {
        sent.push(item.fileName)
        if (item.fileName === "a.mp3") state = [...state, ...rows("late.mp3"), { ...rows("done.mp3")[0]!, status: "done" }]
        return { status: "published" }
      },
    })
    expect(sent).toEqual(["a.mp3", "late.mp3"])
  })

  it("an empty queue does nothing", async () => {
    expect(await run([], [])).toMatchObject({ sent: [], stop: null })
    expect(queueCounts([])).toMatchObject({ total: 0, waiting: 0 })
    expect(queueProgress([])).toBe(0)
  })
})
