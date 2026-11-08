import { MAX_ROWS, validateDraft } from "./rules"
import type { PianoBackend, PianoDraft, PianoFailure, PianoReviewFilter, PianoReviewItem, PianoSheet, PianoTarget } from "./types"

/**
 * The in-memory stand-in for the piano notes API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`). Nothing
 * here reaches a server and nothing survives a reload. It follows the real rules (three open sheets per member and
 * target, the same notes twice are refused, an anonymous sheet carries no author, a stranger's sheet waits for the
 * team). The seed is a made-up sample line for the preview; a real build never shows it.
 */
export class PianoMockFailure extends Error {
  readonly failure: PianoFailure
  constructor(failure: PianoFailure) {
    super(failure)
    this.name = "PianoMockFailure"
    this.failure = failure
  }
}

export function pianoMockFailure(error: unknown): PianoFailure | null {
  return error instanceof PianoMockFailure ? error.failure : null
}

const OPEN_PER_TARGET = 3

const key = (target: PianoTarget) => (target.kind === "recording" ? `recording:${target.id}` : `song:${target.number}`)
const quick = (notes: number[], beats = 1) => notes.map((k) => ({ k: [k], b: beats }))

export function createPianoMock(options: { me: () => string; now?: () => number; teamMember?: boolean; seedRecordings?: readonly string[] } = { me: () => "You" }): PianoBackend {
  const clock = options.now ?? Date.now
  const sheets = new Map<string, PianoSheet>()
  const reported = new Set<string>()
  const seeded = new Set<string>()
  let counter = 0

  const seedFor = (target: PianoTarget) => {
    if (seeded.has(key(target))) return
    seeded.add(key(target))
    counter += 1
    const id = `mock-piano-${counter}`
    sheets.set(id, {
      id,
      target,
      saKey: "C",
      level: "one_finger",
      // Sa Re Ga Ga | Ga Dha Pa Pa | Re Re Ga Ga | Sa Sa Re Re : sample for the preview
      rows: [
        { label: "A", repeat: 1, hand: "right", steps: [...quick([0, 2]), { k: [4], b: 2 }, ...quick([4, 9]), { k: [7], b: 2 }, { k: [2], b: 2 }, { k: [4], b: 2 }, { k: [0], b: 2 }, { k: [2], b: 2 }] },
      ],
      stepsCount: 10,
      linkUrl: null,
      note: "Sample line for the preview.",
      createdAt: new Date(clock() - 86_400_000).toISOString(),
      isAnonymous: false,
      author: { name: "Carya" },
      byRecordingAuthor: false,
      basedOn: null,
      archived: false,
      replacedBy: null,
      replaces: null,
      mine: false,
      status: "published",
      rejectedReason: null,
      canReview: Boolean(options.teamMember),
      recordingTitle: null,
    })
  }

  // the preview shows the shelf "Kiirtan for piano" from the start: these recordings already have notes
  for (const id of options.seedRecordings ?? []) seedFor({ kind: "recording", id })

  const live = (member: boolean, target: PianoTarget) =>
    [...sheets.values()].filter((s) => key(s.target) === key(target) && s.mine === member && s.status !== "rejected" && !s.archived)
  const asReview = (s: PianoSheet): PianoReviewItem => ({ ...s, authorName: s.author?.name ?? options.me(), reportsCount: reported.has(s.id) ? 1 : 0 })

  return {
    async list(target) {
      seedFor(target)
      return [...sheets.values()].filter((s) => key(s.target) === key(target) && !s.archived && (s.status === "published" || s.mine))
    },
    async mine() {
      return [...sheets.values()].filter((s) => s.mine)
    },
    async offer(target, draft: PianoDraft) {
      seedFor(target)
      const problem = validateDraft(draft)
      if (problem) throw new PianoMockFailure(problem)
      const fingerprint = JSON.stringify([draft.saKey, draft.rows.map((r) => [r.hand, r.repeat, r.steps])])
      const mine = live(true, target)
      if (mine.some((s) => JSON.stringify([s.saKey, s.rows.map((r) => [r.hand, r.repeat, r.steps])]) === fingerprint)) throw new PianoMockFailure("duplicate")
      if (mine.length >= OPEN_PER_TARGET) throw new PianoMockFailure("tooMany")
      counter += 1
      const id = `mock-piano-${counter}`
      const sheet: PianoSheet = {
        id,
        target,
        saKey: draft.saKey,
        level: draft.rows.some((r) => r.hand === "left") ? "two_hands" : "one_finger",
        rows: draft.rows.slice(0, MAX_ROWS),
        stepsCount: draft.rows.reduce((n, r) => n + r.steps.filter((x) => x.k.length > 0).length, 0),
        linkUrl: draft.linkUrl.trim() || null,
        note: draft.note.trim() || null,
        createdAt: new Date(clock()).toISOString(),
        isAnonymous: draft.isAnonymous,
        author: draft.isAnonymous ? null : { name: options.me() },
        byRecordingAuthor: false,
        basedOn: draft.basedOnId ? { id: draft.basedOnId, name: null } : null,
        archived: false,
        replacedBy: null,
        replaces: draft.replacesId ?? null,
        mine: true,
        status: options.teamMember ? "published" : "pending",
        rejectedReason: null,
        canReview: Boolean(options.teamMember),
        recordingTitle: null,
      }
      sheets.set(id, sheet)
      return sheet
    },
    async update(sheetId, draft) {
      const old = sheets.get(sheetId)
      if (!old || !old.mine) throw new PianoMockFailure("gone")
      if (old.status === "published") throw new PianoMockFailure("notEditable")
      const problem = validateDraft(draft)
      if (problem) throw new PianoMockFailure(problem)
      const next = { ...old, saKey: draft.saKey, rows: draft.rows, linkUrl: draft.linkUrl.trim() || null, note: draft.note.trim() || null, isAnonymous: draft.isAnonymous, status: "pending" as const, rejectedReason: null }
      sheets.set(sheetId, next)
      return next
    },
    async remove(sheetId) {
      if (!sheets.delete(sheetId)) throw new PianoMockFailure("gone")
    },
    async report(sheetId) {
      if (!sheets.has(sheetId)) throw new PianoMockFailure("gone")
      const again = reported.has(sheetId)
      reported.add(sheetId)
      return { status: again ? "already_reported" : "received" }
    },
    async recordingIds() {
      return [...sheets.values()].filter((s) => s.target.kind === "recording" && s.status === "published").map((s) => (s.target as { id: string }).id)
    },
    async reviewQueue(filter: PianoReviewFilter) {
      return [...sheets.values()]
        .filter((s) => (filter === "reported" ? reported.has(s.id) && s.status === "published" : s.status === filter))
        .map(asReview)
    },
    async approve(sheetId) {
      const s = sheets.get(sheetId)
      if (!s) throw new PianoMockFailure("gone")
      const next = { ...s, status: "published" as const, rejectedReason: null }
      sheets.set(sheetId, next)
      return asReview(next)
    },
    async reject(sheetId, reason) {
      const s = sheets.get(sheetId)
      if (!s) throw new PianoMockFailure("gone")
      const next = { ...s, status: "rejected" as const, rejectedReason: reason }
      sheets.set(sheetId, next)
      return asReview(next)
    },
    async restore(sheetId) {
      const s = sheets.get(sheetId)
      if (!s) throw new PianoMockFailure("gone")
      const next = { ...s, status: "published" as const, rejectedReason: null }
      sheets.set(sheetId, next)
      return asReview(next)
    },
  }
}
