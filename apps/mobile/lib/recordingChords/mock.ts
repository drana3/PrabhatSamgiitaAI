import { cleanDraft } from "@/lib/songComments/rules"

import { OPEN_PER_RECORDING_INSTRUMENT, cleanSheet, draftProblem } from "./rules"
import type { RecordingSheet, SheetDraft, SheetFailure, SheetReportReason, SheetsBackend } from "./types"

/**
 * The in-memory stand-in for the recording chord sheets API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`).
 * Nothing here reaches a server and nothing survives a reload. It follows the real rules (cleaned text, three live
 * sheets per recording and instrument, "the same chart" is refused, an anonymous sheet carries no author, a new sheet
 * waits for the team). The seed is made-up sample text for the preview; a real build never shows it.
 */
export class SheetMockFailure extends Error {
  readonly failure: SheetFailure
  constructor(failure: SheetFailure) {
    super(failure)
    this.name = "SheetMockFailure"
    this.failure = failure
  }
}

export function sheetMockFailure(error: unknown): SheetFailure | null {
  return error instanceof SheetMockFailure ? error.failure : null
}

const SAMPLE = ["        Em           C", "Baba Nam Kevalam", "        Am           D", "Prema Mayi Dhyana", "", "   G         Em", "Ananda Marga Jaya"].join("\n")

function sameKey(body: string): string {
  return body.split("\n").map((l) => l.split(/\s+/).filter(Boolean).join(" ")).join("\n")
}

export function createSheetsMock(options: { me: () => string; now?: () => number } = { me: () => "You" }): SheetsBackend {
  const clock = options.now ?? Date.now
  const sheets = new Map<string, RecordingSheet>()
  const reported = new Set<string>()
  let counter = 0
  const seeded = new Set<string>()
  const seedFor = (recordingId: string) => {
    if (seeded.has(recordingId)) return
    seeded.add(recordingId)
    counter += 1
    const id = `mock-sheet-${counter}`
    sheets.set(id, {
      id,
      recordingId,
      instrument: "guitar",
      chartKey: "Em",
      body: SAMPLE,
      chordsCount: 8,
      note: "Sample chart for the preview.",
      playedIt: true,
      createdAt: new Date(clock() - 3 * 24 * 3_600_000).toISOString(),
      isAnonymous: false,
      author: { name: "Preview member" },
      mine: false,
      status: "published",
      rejectedReason: null,
      canReview: false,
      recordingTitle: null,
    })
  }
  const get = (id: string) => {
    const sheet = sheets.get(id)
    if (!sheet) throw new SheetMockFailure("gone")
    return sheet
  }
  const build = (id: string, recordingId: string, draft: SheetDraft, status: RecordingSheet["status"]): RecordingSheet => {
    const problem = draftProblem(draft)
    if (problem === "notPlayed" || problem === "badKey" || problem === "noteTooLong") throw new SheetMockFailure("invalid")
    if (problem) throw new SheetMockFailure(problem)
    const cleaned = cleanSheet(draft.body)
    if ("problem" in cleaned) throw new SheetMockFailure(cleaned.problem)
    return {
      id,
      recordingId,
      instrument: draft.instrument,
      chartKey: draft.key.trim() || null,
      body: cleaned.body,
      chordsCount: cleaned.chords,
      note: cleanDraft(draft.note) || null,
      playedIt: true,
      createdAt: new Date(clock()).toISOString(),
      isAnonymous: draft.isAnonymous,
      author: draft.isAnonymous ? null : { name: options.me() },
      mine: true,
      status,
      rejectedReason: null,
      canReview: false,
      recordingTitle: null,
    }
  }
  const live = (recordingId: string, instrument: string) =>
    [...sheets.values()].filter((s) => s.mine && s.recordingId === recordingId && s.instrument === instrument && s.status !== "rejected")

  return {
    async list(recordingId, instrument) {
      seedFor(recordingId)
      return [...sheets.values()]
        .filter((s) => s.recordingId === recordingId && (!instrument || s.instrument === instrument) && (s.status === "published" || s.mine))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },
    async mine() {
      return [...sheets.values()].filter((s) => s.mine).map((s) => ({ ...s, recordingTitle: "Sample recording" }))
    },
    async offer(recordingId, draft) {
      const sheet = build(`mock-sheet-${(counter += 1)}`, recordingId, draft, "pending")
      if (live(recordingId, draft.instrument).length >= OPEN_PER_RECORDING_INSTRUMENT) throw new SheetMockFailure("tooMany")
      if (live(recordingId, draft.instrument).some((s) => sameKey(s.body) === sameKey(sheet.body))) throw new SheetMockFailure("duplicate")
      sheets.set(sheet.id, sheet)
      return sheet
    },
    async update(sheetId, draft) {
      const old = get(sheetId)
      if (!old.mine) throw new SheetMockFailure("forbidden")
      if (old.status === "published") throw new SheetMockFailure("notEditable")
      if (old.instrument !== draft.instrument) throw new SheetMockFailure("invalid")
      const next = build(sheetId, old.recordingId, draft, "pending")
      sheets.set(sheetId, next)
      return next
    },
    async remove(sheetId) {
      if (!get(sheetId).mine) throw new SheetMockFailure("gone")
      sheets.delete(sheetId)
    },
    async report(sheetId, _reason: SheetReportReason) {
      get(sheetId)
      if (reported.has(sheetId)) return { status: "already_reported" as const }
      reported.add(sheetId)
      return { status: "received" as const }
    },
  }
}
