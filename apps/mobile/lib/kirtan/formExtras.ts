import { FORM_INSTRUMENTS, FORM_NOTES_KEY, formChordKey } from "@/lib/kirtan/uploadChords"
import { usePianoNotesPendingStore } from "@/stores/pianoNotesPendingStore"
import { useRecordingChordsPendingStore } from "@/stores/recordingChordsPendingStore"

/**
 * The chords and the piano notes typed on the Add Recording form itself (components/kirtan/add/ChordsSection.tsx) go to the recording
 * of the FIRST file once it is published. Kept in one small module so the queue store has two calls to make and tests can replace both.
 * Never throws, never changes the upload's result.
 */
export function flushFormExtras(recordingId: string, title: string): void {
  for (const instrument of FORM_INSTRUMENTS) void useRecordingChordsPendingStore.getState().flush(formChordKey(instrument), recordingId, title)
  void usePianoNotesPendingStore.getState().flush(FORM_NOTES_KEY, recordingId, title)
}

/** A new form, a new batch or a reset: what was typed on the form (and its "sent" lines) is dropped. */
export function forgetFormExtras(): void {
  for (const instrument of FORM_INSTRUMENTS) useRecordingChordsPendingStore.getState().forget(formChordKey(instrument))
  usePianoNotesPendingStore.getState().forget(FORM_NOTES_KEY)
}
