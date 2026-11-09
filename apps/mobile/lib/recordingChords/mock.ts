import { isChordName } from "@/lib/songChords/chordName"
import { splitWords } from "@/lib/songPage/chordChart"
import { cleanDraft } from "@/lib/songComments/rules"

import { chartBody } from "./chart"
import { CYCLE_MAX_TUNES, CYCLE_MAX_SLOTS, CYCLE_MIN_SLOTS, type CyclePayload } from "./cycle"
import { OPEN_PER_RECORDING_INSTRUMENT, cleanSheet, draftProblem, provesAChart } from "./rules"
import type { RecordingSheet, SheetChartPayload, SheetDraft, SheetFailure, SheetReportReason, SheetsBackend } from "./types"

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

/** Made-up text and chords for the preview of a Bhajan: the words are the Name of Baba, the chords are only an example. */
const CHART_SAMPLE: RecordingSheet["lines"] = [
  { text: "Baba Nam Kevalam", placements: [{ word: 0, chord: "Em" }, { word: 2, chord: "C" }] },
  { text: "Prema Mayi Dhyana", placements: [{ word: 0, chord: "Am" }, { word: 2, chord: "D" }] },
  { text: "", placements: [] },
  { text: "Ananda Marga Jaya", placements: [{ word: 0, chord: "G" }, { word: 2, chord: "Em" }] },
]

/** Made-up chords for the preview of a Kiirtan: three tunes are played, the first two have chords (the second has eight, the most a ring takes), the third has none yet. Only an example. */
const CYCLE_SAMPLE: NonNullable<RecordingSheet["cycle"]> = {
  tuneCount: 3,
  tunes: [
    { number: 1, name: "Slow", key: "G", chords: ["Em", "C", "G", "D"], start: 0, times: 4 },
    { number: 2, name: "Fast", key: "C", chords: ["Am", "G", "C", "F", "Dm7", "E7", "Asus4", "Bb"], start: 2, times: null },
  ],
}
const CYCLE_SAMPLE_BODY = "Tune 1 (Slow): Em - C - G - D (key G, starts on Em, x4)\nTune 2 (Fast): Am - G - C - F - Dm7 - E7 - Asus4 - Bb (key C, starts on C)\nTune 3: no chords yet"

const SAMPLE = ["        Em           C", "Baba Nam Kevalam", "        Am           D", "Prema Mayi Dhyana", "", "   G         Em", "Ananda Marga Jaya"].join("\n")

function sameKey(body: string): string {
  return body.split("\n").map((l) => l.split(/\s+/).filter(Boolean).join(" ")).join("\n")
}

export function createSheetsMock(options: { me: () => string; now?: () => number; chartKind?: (recordingId: string) => boolean; cycleKind?: (recordingId: string) => boolean } = { me: () => "You" }): SheetsBackend {
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
    const chart = options.chartKind?.(recordingId) ?? false
    const cycle = !chart && (options.cycleKind?.(recordingId) ?? false)
    sheets.set(id, {
      id,
      recordingId,
      instrument: "guitar",
      chartKey: chart ? "G" : "Em",
      body: chart ? chartBody(CHART_SAMPLE as NonNullable<typeof CHART_SAMPLE>) : cycle ? CYCLE_SAMPLE_BODY : SAMPLE,
      lines: chart ? CHART_SAMPLE : null,
      cycle: cycle ? { tuneCount: CYCLE_SAMPLE.tuneCount, tunes: CYCLE_SAMPLE.tunes.map((f) => ({ ...f, chords: [...f.chords] })) } : null,
      capo: 0,
      strum: chart ? "D DU UDU" : null,
      chordsCount: chart ? 6 : 8,
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
    [...sheets.values()].filter((s) => s.mine && s.recordingId === recordingId && s.instrument === instrument && s.status !== "rejected" && !s.archived)
  /** A chart as the server would keep it (it checks the same things, and has the last word). */
  const buildChart = (id: string, recordingId: string, chart: SheetChartPayload, status: RecordingSheet["status"]): RecordingSheet => {
    if (options.chartKind && !options.chartKind(recordingId)) throw new SheetMockFailure("invalid")
    if (!chart.playedIt) throw new SheetMockFailure("invalid")
    const found = chart.lines.flatMap((l) => l.placements.map((p) => p.chord))
    if (found.length === 0) throw new SheetMockFailure("noChords")
    if (found.some((name) => !isChordName(name))) throw new SheetMockFailure("invalid")
    if (chart.lines.some((l) => l.placements.some((p) => p.word >= splitWords(l.text).length))) throw new SheetMockFailure("invalid")
    if (!provesAChart(found)) throw new SheetMockFailure("fewChords")
    const old = chart.replacesId ? sheets.get(chart.replacesId) : undefined
    const replaces = old && old.mine && old.status === "published" && old.recordingId === recordingId && old.instrument === chart.instrument ? old.id : null
    const original = chart.basedOnId ? sheets.get(chart.basedOnId) : undefined
    const credited = original && !original.mine && original.status === "published" && original.recordingId === recordingId ? original : null
    return {
      id,
      recordingId,
      instrument: chart.instrument,
      chartKey: chart.baseKey,
      body: chartBody(chart.lines),
      lines: chart.lines.map((l) => ({ text: l.text, placements: l.placements.map((p) => ({ ...p })) })),
      capo: chart.instrument === "guitar" ? chart.capo : 0,
      strum: chart.instrument === "guitar" ? chart.strum : null,
      basedOn: credited ? { id: credited.id, name: credited.author?.name ?? null } : null,
      archived: false,
      replacedBy: null,
      replaces,
      chordsCount: found.length,
      note: cleanDraft(chart.note ?? "") || null,
      playedIt: true,
      createdAt: new Date(clock()).toISOString(),
      isAnonymous: chart.isAnonymous,
      author: chart.isAnonymous ? null : { name: options.me() },
      mine: true,
      status,
      rejectedReason: null,
      canReview: false,
      recordingTitle: null,
    }
  }
  /** A cycle as the server would keep it (it checks the same things, and has the last word). */
  const buildCycle = (id: string, recordingId: string, cycle: CyclePayload, status: RecordingSheet["status"]): RecordingSheet => {
    if (options.cycleKind && !options.cycleKind(recordingId)) throw new SheetMockFailure("invalid")
    if (!cycle.playedIt) throw new SheetMockFailure("invalid")
    const tunes = cycle.cycle.tunes
    const count = cycle.cycle.tuneCount
    if (tunes.length < 1 || count < 1 || count > CYCLE_MAX_TUNES || tunes.length > count) throw new SheetMockFailure("invalid")
    if (new Set(tunes.map((f) => f.number)).size < tunes.length || tunes.some((f) => f.number < 1 || f.number > count)) throw new SheetMockFailure("invalid")
    for (const f of tunes) {
      if (f.chords.length < CYCLE_MIN_SLOTS || f.chords.length > CYCLE_MAX_SLOTS || f.start < 0 || f.start >= f.chords.length) throw new SheetMockFailure("invalid")
      if (f.chords.some((name) => !isChordName(name))) throw new SheetMockFailure("invalid")
    }
    const found = tunes.flatMap((f) => f.chords)
    if (!provesAChart(found)) throw new SheetMockFailure("fewChords")
    const old = cycle.replacesId ? sheets.get(cycle.replacesId) : undefined
    const replaces = old && old.mine && old.status === "published" && old.recordingId === recordingId && old.instrument === cycle.instrument ? old.id : null
    const original = cycle.basedOnId ? sheets.get(cycle.basedOnId) : undefined
    const credited = original && !original.mine && original.status === "published" && original.recordingId === recordingId ? original : null
    return {
      id,
      recordingId,
      instrument: cycle.instrument,
      chartKey: cycle.key,
      body: Array.from({ length: count }, (_, i) => {
        const f = tunes.find((x) => x.number === i + 1)
        return f ? `Tune ${i + 1}${f.name ? ` (${f.name})` : ""}: ${f.chords.join(" - ")}` : `Tune ${i + 1}: no chords yet`
      }).join("\n"),
      lines: null,
      cycle: { tuneCount: count, tunes: tunes.map((f) => ({ ...f, chords: [...f.chords] })) },
      capo: cycle.instrument === "guitar" ? cycle.capo : 0,
      strum: null,
      basedOn: credited ? { id: credited.id, name: credited.author?.name ?? null } : null,
      archived: false,
      replacedBy: null,
      replaces,
      chordsCount: found.length,
      note: cleanDraft(cycle.note ?? "") || null,
      playedIt: true,
      createdAt: new Date(clock()).toISOString(),
      isAnonymous: cycle.isAnonymous,
      author: cycle.isAnonymous ? null : { name: options.me() },
      mine: true,
      status,
      rejectedReason: null,
      canReview: false,
      recordingTitle: null,
    }
  }
  const sameChart = (a: RecordingSheet, b: RecordingSheet) => a.chartKey === b.chartKey && (a.capo ?? 0) === (b.capo ?? 0) && JSON.stringify(a.lines) === JSON.stringify(b.lines)

  return {
    async list(recordingId, instrument) {
      seedFor(recordingId)
      return [...sheets.values()]
        .filter((s) => s.recordingId === recordingId && !s.archived && (!instrument || s.instrument === instrument) && (s.status === "published" || s.mine))
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
    async offerChart(recordingId, chart) {
      const sheet = buildChart(`mock-sheet-${(counter += 1)}`, recordingId, chart, "pending")
      const mine = live(recordingId, chart.instrument)
      // a new version takes the place of the live chart it replaces
      if (mine.filter((s) => s.id !== sheet.replaces).length >= OPEN_PER_RECORDING_INSTRUMENT) throw new SheetMockFailure("tooMany")
      if (mine.some((s) => sameChart(s, sheet))) throw new SheetMockFailure("duplicate")
      sheets.set(sheet.id, sheet)
      return sheet
    },
    async updateChart(sheetId, chart) {
      const old = get(sheetId)
      if (!old.mine) throw new SheetMockFailure("forbidden")
      if (old.status === "published") throw new SheetMockFailure("notEditable")
      if (old.instrument !== chart.instrument || !old.lines) throw new SheetMockFailure("invalid")
      const next = { ...buildChart(sheetId, old.recordingId, chart, "pending"), replaces: old.replaces ?? null, createdAt: old.createdAt }
      sheets.set(sheetId, next)
      return next
    },
    async offerCycle(recordingId, cycle) {
      const sheet = buildCycle(`mock-sheet-${(counter += 1)}`, recordingId, cycle, "pending")
      const mine = live(recordingId, cycle.instrument)
      if (mine.filter((s) => s.id !== sheet.replaces).length >= OPEN_PER_RECORDING_INSTRUMENT) throw new SheetMockFailure("tooMany")
      if (mine.some((s) => JSON.stringify(s.cycle) === JSON.stringify(sheet.cycle))) throw new SheetMockFailure("duplicate")
      sheets.set(sheet.id, sheet)
      return sheet
    },
    async updateCycle(sheetId, cycle) {
      const old = get(sheetId)
      if (!old.mine) throw new SheetMockFailure("forbidden")
      if (old.status === "published") throw new SheetMockFailure("notEditable")
      if (old.instrument !== cycle.instrument || !old.cycle) throw new SheetMockFailure("invalid")
      const next = { ...buildCycle(sheetId, old.recordingId, cycle, "pending"), replaces: old.replaces ?? null, createdAt: old.createdAt }
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
