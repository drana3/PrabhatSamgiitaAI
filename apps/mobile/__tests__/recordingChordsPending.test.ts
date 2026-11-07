import { beforeEach, describe, expect, it, vi } from "vitest"

const offer = vi.fn()
vi.mock("@/lib/recordingChords/backend", () => ({
  sheetsBackend: () => ({ offer }),
  sheetFailure: (error: unknown) => (error instanceof Error && error.message === "net" ? "network" : "server"),
}))

import { useRecordingChordsPendingStore } from "@/stores/recordingChordsPendingStore"
import { newSheetDraft } from "@/lib/recordingChords/rules"

const good = { ...newSheetDraft("guitar"), body: "Am   G\nBaba Nam Kevalam", playedIt: true }
const store = () => useRecordingChordsPendingStore.getState()

beforeEach(() => {
  offer.mockReset()
  useRecordingChordsPendingStore.setState({ drafts: {}, results: {} })
})

describe("chords waiting for a recording", () => {
  it("keeps a draft per row and drops a blank one", () => {
    store().setDraft("a", good)
    expect(Object.keys(store().drafts)).toEqual(["a"])
    store().setDraft("a", newSheetDraft("guitar"))
    expect(store().drafts).toEqual({})
  })

  it("sends the draft once the row is published and forgets the text", async () => {
    offer.mockResolvedValue({ id: "s1" })
    store().setDraft("a", good)
    await store().flush("a", "rec-1", "Baba Nam Kevalam")
    expect(offer).toHaveBeenCalledWith("rec-1", good)
    expect(store().drafts).toEqual({})
    expect(store().results.a?.status).toBe("sent")
  })

  it("does nothing for a row without chords", async () => {
    await store().flush("none", "rec-1", "x")
    expect(offer).not.toHaveBeenCalled()
    expect(store().results).toEqual({})
  })

  it("never sends the same chords twice", async () => {
    offer.mockResolvedValue({ id: "s1" })
    store().setDraft("a", good)
    await store().flush("a", "rec-1", "t")
    store().setDraft("a", good)
    store().setDraft("a", good)
    await store().flush("a", "rec-1", "t")
    await store().flush("a", "rec-1", "t")
    expect(offer).toHaveBeenCalledTimes(2)
  })

  it("keeps the text after a failure and says what happened, then retries", async () => {
    offer.mockRejectedValueOnce(new Error("net"))
    store().setDraft("a", good)
    await store().flush("a", "rec-1", "t")
    expect(store().drafts.a).toEqual(good)
    expect(store().results.a).toMatchObject({ status: "failed", failure: "network", recordingId: "rec-1" })
    offer.mockResolvedValueOnce({ id: "s1" })
    await store().retry("a")
    expect(store().results.a?.status).toBe("sent")
    expect(store().drafts).toEqual({})
  })

  it("does not send a draft the rules refuse, and does not ask the server", async () => {
    store().setDraft("a", { ...good, playedIt: false })
    await store().flush("a", "rec-1", "t")
    expect(offer).not.toHaveBeenCalled()
    expect(store().results.a).toMatchObject({ status: "failed", failure: "invalid" })
    expect(store().drafts.a).toBeDefined()
  })

  it("an edit after a failure clears the old failure line", async () => {
    offer.mockRejectedValue(new Error("x"))
    store().setDraft("a", good)
    await store().flush("a", "rec-1", "t")
    expect(store().results.a?.status).toBe("failed")
    store().setDraft("a", { ...good, note: "capo 2" })
    expect(store().results.a).toBeUndefined()
  })
})
