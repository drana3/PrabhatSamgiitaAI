/**
 * Chord sheets of recordings (apps/api `/api/v1/recording-chords`, docs/recording-extras.md).
 *
 * A sheet is a plain-text chart the member typed: chords on a line of their own over the words, or `[Am]` inside the
 * words. It carries no timing and no word alignment. `author` is null for an anonymous sheet: the server never sends a
 * name for it, and this app never invents one.
 */
export type SheetInstrument = "guitar" | "harmonium"

export type SheetStatus = "pending" | "published" | "rejected"

export type SheetAuthor = { name: string }

export type RecordingSheet = {
  id: string
  recordingId: string
  instrument: SheetInstrument
  /** the key the chords are written in, or null when the player did not say */
  chartKey: string | null
  body: string
  chordsCount: number
  note: string | null
  playedIt: boolean
  createdAt: string
  isAnonymous: boolean
  author: SheetAuthor | null
  mine: boolean
  status: SheetStatus
  /** only the author and the team ever receive it */
  rejectedReason: string | null
  /** the viewer is on the team */
  canReview: boolean
  /** only in the member's own list: the title of the recording, to name the chart */
  recordingTitle: string | null
}

/** What the member types, before it becomes a request. */
export type SheetDraft = {
  instrument: SheetInstrument
  /** "" when the player did not say */
  key: string
  body: string
  playedIt: boolean
  note: string
  isAnonymous: boolean
}

export type SheetReportReason = "wrong_chords" | "offensive" | "spam" | "other"

/** What a person can be told when something goes wrong. Each has a sentence in locales/recordingExtras.ts. */
export type SheetFailure =
  | "signin" // not signed in (or the session ran out)
  | "dailyLimit" // too many charts today (shared with the song charts)
  | "slowDown" // too many in an hour
  | "duplicate" // exactly this chart was offered already
  | "tooMany" // three live charts of this recording for this instrument
  | "noChords" // the text holds no chord
  | "fewChords" // one lonely plain letter ("A"): also a word, so not yet a chart
  | "tooLong" // too many characters, lines, or a line too long
  | "links" // a web link in a chart
  | "invalid" // the server found the chart unusable, for another reason
  | "forbidden"
  | "network" // no answer (offline)
  | "gone" // the chart or the recording is not there any more
  | "notEditable" // a live chart cannot be changed in place
  | "server"

export type SheetOutcome = { ok: true; sheet: RecordingSheet } | { ok: false; failure: SheetFailure }

/** The things the screens ask of a server (the real one, or the in-memory one of the web preview). */
export interface SheetsBackend {
  /** published sheets, plus the viewer's own waiting ones */
  list(recordingId: string, instrument?: SheetInstrument): Promise<RecordingSheet[]>
  mine(): Promise<RecordingSheet[]>
  offer(recordingId: string, draft: SheetDraft): Promise<RecordingSheet>
  /** the author fixes a waiting or rejected sheet and sends it again (same recording and instrument) */
  update(sheetId: string, draft: SheetDraft): Promise<RecordingSheet>
  remove(sheetId: string): Promise<void>
  report(sheetId: string, reason: SheetReportReason): Promise<{ status: "received" | "already_reported" }>
}
