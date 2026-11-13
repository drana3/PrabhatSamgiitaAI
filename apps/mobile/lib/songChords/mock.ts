import type { ChordFailure, ChordProposal, ChordsBackend, ReviewItem } from "./types"

/**
 * The in-memory stand-in for the chord proposals API, used ONLY in the web preview (`EXPO_PUBLIC_MOCKUP_DATA=1`, see
 * lib/songChords/backend.ts). Nothing here reaches a server and nothing survives a reload. It follows the same rules as
 * the real one (a team member publishes at once, anyone else waits; an anonymous chart carries no author; three live
 * charts per song and instrument; the same chart twice is refused; a new version of the author's live chart replaces it
 * when accepted, and the old one is archived, not deleted; a chart taken back before the review is simply removed) so
 * the screens can be checked.
 * The seed charts are sample content for the preview; they are never shown in a real build.
 */

export const PREVIEW_NAME = "Preview member"

export class MockFailure extends Error {
  readonly failure: ChordFailure
  constructor(failure: ChordFailure) {
    super(failure)
    this.name = "MockFailure"
    this.failure = failure
  }
}

export function mockFailure(error: unknown): ChordFailure | null {
  return error instanceof MockFailure ? error.failure : null
}

type Row = ChordProposal & { ownerKey: string; reports: number }

const OPEN_LIMIT = 3

function fingerprint(p: Pick<ChordProposal, "baseKey" | "capo" | "lines">): string {
  return JSON.stringify([p.baseKey, p.capo, p.lines.map((l) => l.placements.map((x) => [x.word, x.chord]))])
}

function seed(): Row[] {
  const at = Date.now() - 2 * 24 * 60 * 60 * 1000
  const lines = [
    { placements: [{ word: 0, chord: "D" }, { word: 2, chord: "Bm" }] },
    { placements: [{ word: 0, chord: "G" }, { word: 1, chord: "A" }] },
  ]
  return [
    {
      id: "preview-sample-1",
      songId: 1,
      instrument: "guitar",
      baseKey: "D",
      capo: 2,
      strum: "D D U U D U",
      lines,
      note: "Sample chart for the preview. Capo on 2, open C shapes.",
      playedIt: true,
      createdAt: new Date(at).toISOString(),
      isAnonymous: false,
      author: { name: PREVIEW_NAME },
      mine: false,
      status: "published",
      rejectedReason: null,
      canReview: false,
      ownerKey: "other",
      reports: 0,
    },
    {
      id: "preview-sample-2",
      songId: 1,
      instrument: "harmonium",
      baseKey: "C",
      capo: 0,
      strum: null,
      lines,
      note: null,
      playedIt: true,
      createdAt: new Date(at + 3_600_000).toISOString(),
      isAnonymous: true,
      author: null,
      mine: false,
      status: "published",
      rejectedReason: null,
      canReview: false,
      ownerKey: "other",
      reports: 0,
    },
  ]
}

/**
 * The preview member's own charts, one in each state, so the Upload hub and the notices can be looked at. Only with
 * `seedMine` (the web preview turns it on; `?empty` in the address turns it off to see the empty hub).
 */
function seedMineRows(): Row[] {
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const lines = [{ placements: [{ word: 0, chord: "G" }, { word: 2, chord: "Em" }, { word: 4, chord: "C" }] }, { placements: [{ word: 1, chord: "D" }] }]
  const base = {
    strum: null,
    lines,
    note: null,
    playedIt: true,
    isAnonymous: false,
    author: { name: PREVIEW_NAME },
    mine: true,
    canReview: false,
    ownerKey: "me",
    reports: 0,
  }
  return [
    { ...base, id: "preview-mine-pending", songId: 2, instrument: "guitar", baseKey: "D", capo: 2, strum: "D D U U D U", createdAt: new Date(now - 1 * day).toISOString(), status: "pending", rejectedReason: null },
    { ...base, id: "preview-mine-live", songId: 3, instrument: "harmonium", baseKey: "C", capo: 0, createdAt: new Date(now - 6 * day).toISOString(), status: "published", rejectedReason: null },
    {
      ...base,
      id: "preview-mine-rejected",
      songId: 5,
      instrument: "guitar",
      baseKey: "G",
      capo: 0,
      createdAt: new Date(now - 3 * day).toISOString(),
      status: "rejected",
      rejectedReason: "The chords do not fit the tune in the second line. Please check the key and send it again.",
    },
  ]
}

/** Preview only (`?replaced`): a chart of the member's that a newer version replaced, and the newer one (live). */
function seedReplacedRows(): Row[] {
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const lines = [{ placements: [{ word: 0, chord: "Am" }, { word: 2, chord: "F" }] }, { placements: [{ word: 1, chord: "G" }] }]
  const base = {
    lines,
    note: null,
    playedIt: true,
    isAnonymous: false,
    author: { name: PREVIEW_NAME },
    mine: true,
    canReview: false,
    ownerKey: "me",
    reports: 0,
    songId: 8,
    instrument: "guitar" as const,
    strum: null,
    rejectedReason: null,
    status: "published" as const,
  }
  return [
    { ...base, id: "preview-mine-old", baseKey: "A", capo: 2, createdAt: new Date(now - 9 * day).toISOString(), archived: true },
    { ...base, id: "preview-mine-newer", baseKey: "A", capo: 0, createdAt: new Date(now - 2 * day).toISOString(), replaces: "preview-mine-old" },
  ]
}

function view(row: Row, me: string, team: boolean, all: readonly Row[] = []): ChordProposal {
  const { ownerKey, reports: _reports, ...rest } = row
  const mine = ownerKey === me
  const replacer = row.archived ? all.find((r) => r.replaces === row.id && r.status === "published") : undefined
  return {
    ...rest,
    author: row.isAnonymous ? null : row.author,
    mine,
    canReview: team,
    rejectedReason: mine || team ? row.rejectedReason : null,
    // what happened to a chart is the author's business
    archived: mine && Boolean(row.archived),
    replacedBy: mine && replacer ? replacer.id : null,
    replaces: mine ? (row.replaces ?? null) : null,
  }
}

/** `me` is the name a named chart gets; `team` says whether the previewing member counts as the team. */
export function createMockBackend(options: { me: () => string; team?: () => boolean; seedMine?: boolean; seedReplaced?: boolean } = { me: () => "You" }): ChordsBackend {
  const rows: Row[] = [...seed(), ...(options.seedMine ? seedMineRows() : []), ...(options.seedReplaced ? seedReplacedRows() : [])]
  const reported = new Set<string>()
  let counter = 0
  const isTeam = () => options.team?.() ?? false
  const find = (id: string): Row => {
    const row = rows.find((r) => r.id === id)
    if (!row) throw new MockFailure("gone")
    return row
  }
  /** the new version is live: the chart it replaces is archived (kept, hidden from the song page) */
  const archiveReplaced = (row: Row) => {
    const old = row.replaces ? rows.find((r) => r.id === row.replaces) : undefined
    if (old && old.status === "published" && !old.archived) old.archived = true
  }
  const asReview = (row: Row): ReviewItem => ({ ...view(row, "me", true, rows), authorId: row.ownerKey, authorName: row.author?.name ?? options.me(), reportsCount: row.reports })

  return {
    async listForSong(songId) {
      return rows
        .filter((r) => r.songId === songId && !r.archived && (r.status === "published" || (r.ownerKey === "me" && r.status !== "rejected")))
        .map((r) => view(r, "me", isTeam(), rows))
    },
    async mine() {
      return rows.filter((r) => r.ownerKey === "me").map((r) => view(r, "me", false, rows))
    },
    async offer(payload) {
      const live = rows.filter((r) => r.ownerKey === "me" && r.songId === payload.songId && r.instrument === payload.instrument && r.status !== "rejected" && !r.archived)
      // a new version replaces the member's own live chart of the same song and instrument; anything else is a new chart
      const replaced = payload.replacesId ? live.find((r) => r.id === payload.replacesId && r.status === "published") : undefined
      const original = payload.basedOnId ? rows.find((r) => r.id === payload.basedOnId && r.ownerKey !== "me" && r.status === "published" && !r.archived && r.songId === payload.songId) : undefined
      const wanted = fingerprint({ baseKey: payload.baseKey, capo: payload.capo, lines: payload.lines })
      if (live.some((r) => fingerprint(r) === wanted)) throw new MockFailure("duplicate")
      if (!isTeam() && live.filter((r) => r !== replaced).length >= OPEN_LIMIT) throw new MockFailure("tooMany")
      counter += 1
      const team = isTeam()
      const row: Row = {
        id: `preview-mine-${counter}`,
        songId: payload.songId,
        instrument: payload.instrument,
        baseKey: payload.baseKey,
        capo: payload.capo,
        strum: payload.strum,
        lines: payload.lines,
        note: payload.note,
        playedIt: payload.playedIt,
        createdAt: new Date().toISOString(),
        isAnonymous: payload.isAnonymous,
        author: payload.isAnonymous ? null : { name: options.me() },
        mine: true,
        status: team ? "published" : "pending",
        rejectedReason: null,
        canReview: false,
        ownerKey: "me",
        reports: 0,
        replaces: replaced?.id ?? null,
        basedOn: original ? { id: original.id, name: original.isAnonymous ? null : (original.author?.name ?? null) } : null,
      }
      rows.push(row)
      if (team) archiveReplaced(row)
      return view(row, "me", team, rows)
    },
    async update(id, payload) {
      const row = find(id)
      if (row.ownerKey !== "me") throw new MockFailure("forbidden")
      if (row.status === "published") throw new MockFailure("notEditable")
      if (payload.songId !== row.songId || payload.instrument !== row.instrument) throw new MockFailure("invalid")
      const others = rows.filter((r) => r.ownerKey === "me" && r !== row && r.songId === row.songId && r.instrument === row.instrument && r.status !== "rejected")
      const wanted = fingerprint({ baseKey: payload.baseKey, capo: payload.capo, lines: payload.lines })
      if (others.some((r) => fingerprint(r) === wanted)) throw new MockFailure("duplicate")
      if (!isTeam() && row.status === "rejected" && others.length >= OPEN_LIMIT) throw new MockFailure("tooMany")
      row.baseKey = payload.baseKey
      row.capo = payload.capo
      row.strum = payload.strum
      row.lines = payload.lines
      row.note = payload.note
      row.playedIt = payload.playedIt
      row.isAnonymous = payload.isAnonymous
      row.author = payload.isAnonymous ? null : { name: options.me() }
      row.status = isTeam() ? "published" : "pending"
      row.rejectedReason = null
      if (isTeam()) archiveReplaced(row)
      return view(row, "me", isTeam(), rows)
    },
    async remove(id) {
      const row = find(id)
      if (row.ownerKey !== "me") throw new MockFailure("forbidden")
      rows.splice(rows.indexOf(row), 1)
      // charts that pointed at this one lose the link (and the credit) and keep everything else
      for (const r of rows) {
        if (r.replaces === id) r.replaces = null
        if (r.basedOn?.id === id) r.basedOn = null // the server shows no credit once the original is gone
      }
    },
    async report(id) {
      const row = find(id)
      if (row.ownerKey === "me") throw new MockFailure("invalid")
      if (reported.has(id)) return { status: "already_reported" as const }
      reported.add(id)
      row.reports += 1
      return { status: "received" as const }
    },
    async reviewQueue(filter) {
      if (!isTeam()) throw new MockFailure("forbidden")
      const match = (r: Row) => (filter === "all" ? true : filter === "reported" ? r.reports > 0 && r.status === "published" && !r.archived : filter === "published" ? r.status === "published" && !r.archived : r.status === filter)
      const items = rows.filter(match).map(asReview)
      return { items, total: items.length }
    },
    async approve(id) {
      if (!isTeam()) throw new MockFailure("forbidden")
      const row = find(id)
      row.status = "published"
      archiveReplaced(row)
      return asReview(row)
    },
    async reject(id, reason) {
      if (!isTeam()) throw new MockFailure("forbidden")
      const row = find(id)
      row.status = "rejected"
      row.rejectedReason = reason
      return asReview(row)
    },
    async restore(id) {
      if (!isTeam()) throw new MockFailure("forbidden")
      const row = find(id)
      row.status = "published"
      row.rejectedReason = null
      archiveReplaced(row)
      return asReview(row)
    },
  }
}

