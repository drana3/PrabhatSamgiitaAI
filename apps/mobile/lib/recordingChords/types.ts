import type { CyclePayload } from "./cycle"

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

/** One line of a chart (a Bhajan or a Spiritual song): the words it holds and the chords over them, by word number. */
export type SheetChartLine = { text: string; placements: Array<{ word: number; chord: string }> }

/** "Based on a chart by <name>": `name` is null when that chart was anonymous, `id` is null once the original is gone. */
export type SheetCredit = { id: string | null; name: string | null }

/** One tune of a Kiirtan recording: a ring of chords, the slot it starts on, its key and how many rounds (both optional). */
export type SheetCycleTune = { number: number; name: string | null; key: string | null; chords: string[]; start: number; times: number | null }

/** The chord cycle of a Kiirtan (docs/kiirtan-cycle.md): one ring per tune. A number missing from `tunes` has no chords yet. */
export type SheetCycle = { tuneCount: number; tunes: SheetCycleTune[] }

/** A tune while it is being entered: empty slots are null, the number of rounds is what was typed, `skipped` = no chords yet. */
export type SheetCycleTuneDraft = { name: string; slots: Array<string | null>; start: number; times: string; key: string; skipped: boolean }

export type RecordingSheet = {
  id: string
  recordingId: string
  instrument: SheetInstrument
  /** the key the chords are written in, or null when the player did not say */
  chartKey: string | null
  body: string
  chordsCount: number
  /**
   * A chart of a Bhajan or a Spiritual song: the lines of the pasted text with their chords (the chords are as they
   * SOUND, in `chartKey`; a guitar capo is a hint). Null or missing for a plain-text sheet, which `body` carries.
   */
  lines?: SheetChartLine[] | null
  /** The chord cycle of a Kiirtan (rings of chords, one per tune). Null or missing for a plain-text sheet and for a chart. */
  cycle?: SheetCycle | null
  capo?: number
  strum?: string | null
  /** set when the chords were copied from another member's chart ("Start from this chart") */
  basedOn?: SheetCredit | null
  /** the author's own view only: a newer version went live and took this chart's place */
  archived?: boolean
  replacedBy?: string | null
  /** the author's own view only: the live chart this waiting chart will replace once it is accepted */
  replaces?: string | null
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

/** What the member sends for a chart: SOUNDING chords in `baseKey` (Sa for a harmonium), the text of every line beside them. */
export type SheetChartPayload = {
  instrument: SheetInstrument
  baseKey: string
  capo: number
  strum: string | null
  lines: SheetChartLine[]
  playedIt: boolean
  note: string | null
  isAnonymous: boolean
  /** a new version of the author's own LIVE chart: when it goes live the old one is replaced (archived) */
  replacesId?: string | null
  /** "Start from this chart": somebody else's published chart whose chords were copied (credited) */
  basedOnId?: string | null
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
  /** a chart over pasted text (Bhajan, Spiritual song): offered, or fixed and sent again (same recording and instrument) */
  offerChart(recordingId: string, chart: SheetChartPayload): Promise<RecordingSheet>
  updateChart(sheetId: string, chart: SheetChartPayload): Promise<RecordingSheet>
  /** the chord cycle of a Kiirtan: offered, or fixed and sent again (same recording and instrument) */
  offerCycle(recordingId: string, cycle: CyclePayload): Promise<RecordingSheet>
  updateCycle(sheetId: string, cycle: CyclePayload): Promise<RecordingSheet>
  remove(sheetId: string): Promise<void>
  report(sheetId: string, reason: SheetReportReason): Promise<{ status: "received" | "already_reported" }>
}
