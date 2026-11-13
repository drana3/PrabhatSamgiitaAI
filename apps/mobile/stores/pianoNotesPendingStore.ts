import { create } from "zustand"

import { pianoBackend, pianoFailure } from "@/lib/pianoNotes/backend"
import { isBlankPianoUpload, readPianoUpload, type PianoUploadDraft } from "@/lib/pianoNotes/uploadDraft"
import type { PianoFailure } from "@/lib/pianoNotes/types"

/**
 * Piano notes typed at upload time (the Add Recording form). The recording does not exist on the server until its file is up, so
 * the notes wait here under a key (lib/kirtan/uploadChords.ts FORM_NOTES_KEY) and are sent once the recording is published, the way
 * stores/recordingChordsPendingStore.ts does it for chords. Sending NEVER decides the fate of the upload: a failure only leaves an
 * honest line with "Send again". In memory only; the draft stays until it is sent, so a failure never throws the text away.
 * The server makes the notes of the person who uploaded the recording live at once (apps/api services/piano_sheets.py `goes_live`).
 */
export type PianoPendingResult = { status: "sent" | "failed"; failure?: PianoFailure | "words"; recordingId: string; title: string }

type State = {
  drafts: Record<string, PianoUploadDraft>
  results: Record<string, PianoPendingResult>
  /** null (or blank text) removes it */
  setDraft: (key: string, draft: PianoUploadDraft | null) => void
  /** the row was published as `recordingId`: send its notes, if it has any. Never throws. */
  flush: (key: string, recordingId: string, title: string) => Promise<void>
  retry: (key: string) => Promise<void>
  forget: (key: string) => void
}

function without<T>(map: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _gone, ...rest } = map
  return rest
}

export const usePianoNotesPendingStore = create<State>()((set, get) => ({
  drafts: {},
  results: {},
  // a changed draft is a new attempt: an old "not sent" line no longer describes it; a blank one is no draft
  setDraft: (key, draft) =>
    set((state) => ({
      drafts: draft && !isBlankPianoUpload(draft) ? { ...state.drafts, [key]: draft } : without(state.drafts, key),
      results: without(state.results, key),
    })),
  flush: async (key, recordingId, title) => {
    const draft = get().drafts[key]
    if (!draft || get().results[key]?.status === "sent") return
    const reading = readPianoUpload(draft)
    if (!reading.draft) {
      set((state) => ({ results: { ...state.results, [key]: { status: "failed", failure: reading.problem ?? "invalid", recordingId, title } } }))
      return
    }
    try {
      await pianoBackend().offer({ kind: "recording", id: recordingId }, reading.draft)
      set((state) => ({ drafts: without(state.drafts, key), results: { ...state.results, [key]: { status: "sent", recordingId, title } } }))
    } catch (error) {
      set((state) => ({ results: { ...state.results, [key]: { status: "failed", failure: pianoFailure(error), recordingId, title } } }))
    }
  },
  retry: async (key) => {
    const last = get().results[key]
    if (!last) return
    await get().flush(key, last.recordingId, last.title)
  },
  forget: (key) => set((state) => ({ drafts: without(state.drafts, key), results: without(state.results, key) })),
}))
