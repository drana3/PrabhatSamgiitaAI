/**
 * Piano notes (apps/api `/api/v1/piano-notes`, docs/piano-notation.md).
 *
 * A sheet is NOT a staff and NOT a file: rows of steps. A step is the keys pressed together (`k`, semitones above Sa,
 * so one sheet fits any key; an empty list is a rest) and how long they last in beats (`b`, quarters). The reader picks
 * Sa and the keyboard lights the keys. `saKey` is where Sa sat when the author wrote the notes.
 */
export type PianoHand = "right" | "left"
export type PianoLevel = "one_finger" | "two_hands"
export type PianoStatus = "pending" | "published" | "rejected"

export type PianoStep = { k: number[]; b: number }
export type PianoRow = { label: string | null; repeat: number; hand: PianoHand; steps: PianoStep[] }

/** What a sheet belongs to: a recording of the library or a Prabhat Samgiita song (by its number). */
export type PianoTarget = { kind: "recording"; id: string } | { kind: "song"; number: number }

export type PianoSheet = {
  id: string
  target: PianoTarget
  /** Where Sa sat when the author wrote it, as a note name (C, C#, D ...). */
  saKey: string
  level: PianoLevel
  rows: PianoRow[]
  stepsCount: number
  /** A link to notes kept elsewhere. Only a link: the app stores no file. */
  linkUrl: string | null
  note: string | null
  createdAt: string
  isAnonymous: boolean
  /** Null for an anonymous sheet and for the booklet: this app never invents a name. */
  author: { name: string } | null
  /** Live at once because its author is the author of the recording. */
  byRecordingAuthor: boolean
  basedOn: { id: string | null; name: string | null } | null
  archived: boolean
  replacedBy: string | null
  replaces: string | null
  mine: boolean
  status: PianoStatus
  rejectedReason: string | null
  canReview: boolean
  recordingTitle: string | null
  /** The notes that ship in the app (the booklet of Prabhat Samgiita): not from a member, never reviewed. */
  fromBooklet?: boolean
  /**
   * The notes read from the printed collection "50 PS" by a program: not from a member, not checked by the team yet.
   * `doubts` counts the places the program marked as uncertain; `saUncertain` says the Sa itself is a guess.
   */
  fromCollection?: { doubts: number; saUncertain: boolean }
}

/** What the member types, before it becomes a request. */
export type PianoDraft = {
  saKey: string
  rows: PianoRow[]
  linkUrl: string
  note: string
  isAnonymous: boolean
  /** A newer version of the member's own live sheet. */
  replacesId?: string | null
  /** "Start from this sheet": the credit goes to its author. */
  basedOnId?: string | null
}

export type PianoReportReason = "wrong_notes" | "offensive" | "spam" | "other"

export type PianoFailure =
  | "network"
  | "signin"
  | "forbidden"
  | "gone"
  | "dailyLimit"
  | "duplicate"
  | "tooMany"
  | "notEditable"
  | "tooFew"
  | "tooLong"
  | "links"
  | "badLink"
  | "slowDown"
  | "invalid"
  | "server"

export type PianoReviewFilter = "pending" | "reported" | "published" | "rejected"

/** A sheet in the team's queue: the member who wrote it is named, even when the sheet is anonymous (team only). */
export type PianoReviewItem = PianoSheet & { authorName: string; reportsCount: number }

export interface PianoBackend {
  list(target: PianoTarget): Promise<PianoSheet[]>
  mine(): Promise<PianoSheet[]>
  offer(target: PianoTarget, draft: PianoDraft): Promise<PianoSheet>
  update(sheetId: string, draft: PianoDraft): Promise<PianoSheet>
  remove(sheetId: string): Promise<void>
  report(sheetId: string, reason: PianoReportReason): Promise<{ status: "received" | "already_reported" }>
  /** Ids of the recordings that have live notes: feeds the shelf "Kiirtan for piano". */
  recordingIds(): Promise<string[]>
  reviewQueue(filter: PianoReviewFilter): Promise<PianoReviewItem[]>
  approve(sheetId: string): Promise<PianoReviewItem>
  reject(sheetId: string, reason: string): Promise<PianoReviewItem>
  restore(sheetId: string): Promise<PianoReviewItem>
}
