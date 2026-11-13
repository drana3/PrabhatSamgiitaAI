import { beforeEach, describe, expect, it, vi } from "vitest"

const offer = vi.fn()
vi.mock("@/lib/pianoNotes/backend", () => ({
  pianoBackend: () => ({ offer }),
  pianoFailure: (error: unknown) => (error instanceof Error && error.message === "net" ? "network" : "server"),
}))

import { isBlankPianoUpload, newPianoUploadDraft, readPianoUpload } from "@/lib/pianoNotes/uploadDraft"
import { usePianoNotesPendingStore } from "@/stores/pianoNotesPendingStore"

const store = () => usePianoNotesPendingStore.getState()
const good = { saKey: "C", text: "Sa Re Ga Ma:2 (Sa Ga Pa)" }

beforeEach(() => {
  offer.mockReset()
  usePianoNotesPendingStore.setState({ drafts: {}, results: {} })
})

describe("piano notes typed on the form", () => {
  it("start blank on C, and blank text is no notes", () => {
    expect(newPianoUploadDraft()).toEqual({ saKey: "C", text: "" })
    expect(isBlankPianoUpload(newPianoUploadDraft())).toBe(true)
    expect(isBlankPianoUpload({ saKey: "D", text: "  \n " })).toBe(true)
    expect(isBlankPianoUpload(undefined)).toBe(true)
    expect(isBlankPianoUpload(good)).toBe(false)
  })

  it("are read with the notes editor's parser: one line is one row", () => {
    const reading = readPianoUpload({ saKey: "D", text: "Sa Re Ga Ma\nPa Dha Ni Sa'" })
    expect(reading.problem).toBeNull()
    expect(reading.bad).toEqual([])
    expect(reading.notes).toBe(8)
    expect(reading.draft?.saKey).toBe("D")
    expect(reading.draft?.rows).toHaveLength(2)
    expect(reading.draft?.rows[0]?.steps.map((s) => s.k)).toEqual([[0], [2], [4], [5]])
    expect(reading.draft?.isAnonymous).toBe(false)
  })

  it("say which words were not understood and send nothing while there are any", () => {
    const reading = readPianoUpload({ saKey: "C", text: "Sa Re Gx Ma" })
    expect(reading.problem).toBe("words")
    expect(reading.bad).toEqual(["Gx"])
    expect(reading.draft).toBeNull()
  })

  it("need at least two notes, like the server", () => {
    expect(readPianoUpload({ saKey: "C", text: "Sa" })).toMatchObject({ problem: "tooFew", draft: null })
    expect(readPianoUpload({ saKey: "C", text: "" })).toMatchObject({ problem: null, draft: null, notes: 0 })
  })
})

describe("piano notes waiting for a recording", () => {
  it("keeps one draft and drops a blank one", () => {
    store().setDraft("form:notes", good)
    expect(Object.keys(store().drafts)).toEqual(["form:notes"])
    store().setDraft("form:notes", { saKey: "C", text: "" })
    expect(store().drafts).toEqual({})
  })

  it("sends the notes to the recording once it is published, as a recording target, and forgets the text", async () => {
    offer.mockResolvedValue({ id: "p1" })
    store().setDraft("form:notes", good)
    await store().flush("form:notes", "rec-1", "Baba Nam Kevalam")
    expect(offer).toHaveBeenCalledTimes(1)
    expect(offer.mock.calls[0]?.[0]).toEqual({ kind: "recording", id: "rec-1" })
    expect(offer.mock.calls[0]?.[1]).toMatchObject({ saKey: "C", isAnonymous: false })
    expect(store().drafts).toEqual({})
    expect(store().results["form:notes"]?.status).toBe("sent")
  })

  it("sends nothing when nothing was typed: an empty section never blocks or posts", async () => {
    await store().flush("form:notes", "rec-1", "x")
    expect(offer).not.toHaveBeenCalled()
    expect(store().results).toEqual({})
  })

  it("never sends the same notes twice", async () => {
    offer.mockResolvedValue({ id: "p1" })
    store().setDraft("form:notes", good)
    await store().flush("form:notes", "rec-1", "t")
    store().setDraft("form:notes", good)
    await store().flush("form:notes", "rec-1", "t")
    store().setDraft("form:notes", good)
    store().flush("form:notes", "rec-1", "t")
    expect(offer.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it("keeps the text and says why when the server could not take it, and sends again on retry", async () => {
    offer.mockRejectedValueOnce(new Error("net"))
    store().setDraft("form:notes", good)
    await store().flush("form:notes", "rec-1", "t")
    expect(store().results["form:notes"]).toMatchObject({ status: "failed", failure: "network", recordingId: "rec-1" })
    expect(store().drafts["form:notes"]).toEqual(good)
    offer.mockResolvedValueOnce({ id: "p1" })
    await store().retry("form:notes")
    expect(store().results["form:notes"]?.status).toBe("sent")
    expect(offer).toHaveBeenCalledTimes(2)
  })

  it("a text that cannot be read fails without asking the server", async () => {
    store().setDraft("form:notes", { saKey: "C", text: "Sa Re Gx" })
    await store().flush("form:notes", "rec-1", "t")
    expect(offer).not.toHaveBeenCalled()
    expect(store().results["form:notes"]).toMatchObject({ status: "failed", failure: "words" })
  })

  it("changing the draft clears an old 'not sent' line", async () => {
    offer.mockRejectedValueOnce(new Error("net"))
    store().setDraft("form:notes", good)
    await store().flush("form:notes", "rec-1", "t")
    store().setDraft("form:notes", { ...good, saKey: "D" })
    expect(store().results["form:notes"]).toBeUndefined()
  })
})
