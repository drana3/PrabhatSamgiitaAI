import { create } from "zustand"

import { sheetFailure, sheetsBackend } from "@/lib/recordingChords/backend"
import { draftProblem, isBlankDraft } from "@/lib/recordingChords/rules"
import type { SheetDraft, SheetFailure } from "@/lib/recordingChords/types"

/**
 * Chords typed at upload time (docs/recording-extras.md). A recording does not exist on the server until its file is
 * up, so the chords wait here, keyed by the queue row or the set track, and are sent once that row is published.
 * Sending the chords NEVER decides the fate of the upload: a failure only leaves an honest line on the row with
 * "Send the chords again". Kept in memory only: if the app is closed between the recording going up and the chords
 * being sent, the chords are gone and the person can add them from the recording page. The draft stays until it is
 * sent, so a failure never throws the text away.
 */
export type PendingResult = { status: "sent" | "failed"; failure?: SheetFailure; recordingId: string; title: string }

type State = {
  drafts: Record<string, SheetDraft>
  results: Record<string, PendingResult>
  /** null (or a blank draft) removes it */
  setDraft: (rowKey: string, draft: SheetDraft | null) => void
  /** the row was published as `recordingId`: send its chords, if it has any. Never throws. */
  flush: (rowKey: string, recordingId: string, title: string) => Promise<void>
  /** try again after a failure */
  retry: (rowKey: string) => Promise<void>
  forget: (rowKey: string) => void
}

function withoutKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _gone, ...rest } = map
  return rest
}

export const useRecordingChordsPendingStore = create<State>()((set, get) => ({
  drafts: {},
  results: {},
  setDraft: (rowKey, draft) =>
    set((state) => ({
      drafts: draft && !isBlankDraft(draft) ? { ...state.drafts, [rowKey]: draft } : withoutKey(state.drafts, rowKey),
      // a changed draft is a new attempt: an old "not sent" line no longer describes it
      results: withoutKey(state.results, rowKey),
    })),
  flush: async (rowKey, recordingId, title) => {
    const draft = get().drafts[rowKey]
    if (!draft || get().results[rowKey]?.status === "sent") return
    const problem = draftProblem(draft)
    if (problem) {
      const failure: SheetFailure = problem === "notPlayed" || problem === "badKey" || problem === "noteTooLong" ? "invalid" : problem
      set((state) => ({ results: { ...state.results, [rowKey]: { status: "failed", failure, recordingId, title } } }))
      return
    }
    try {
      await sheetsBackend().offer(recordingId, draft)
      set((state) => ({ drafts: withoutKey(state.drafts, rowKey), results: { ...state.results, [rowKey]: { status: "sent", recordingId, title } } }))
    } catch (error) {
      set((state) => ({ results: { ...state.results, [rowKey]: { status: "failed", failure: sheetFailure(error), recordingId, title } } }))
    }
  },
  retry: async (rowKey) => {
    const last = get().results[rowKey]
    if (!last) return
    await get().flush(rowKey, last.recordingId, last.title)
  },
  forget: (rowKey) => set((state) => ({ drafts: withoutKey(state.drafts, rowKey), results: withoutKey(state.results, rowKey) })),
}))
