import type { ChordChart } from "@/lib/songPage/chordChart"

/**
 * Chord proposals for a Prabhat Samgiita song (apps/api `/api/v1/song-chords`, docs/chord-proposals.md).
 *
 * A proposal IS a chart in the model the song page already draws (lib/songPage/chordChart.ts): per lyric line the
 * chords that change on a word, written as SOUNDING chords in `baseKey`. A guitar player's capo travels with it as
 * a hint (the shapes they played), it is not folded into the chords.
 */
export type ChordInstrument = "guitar" | "harmonium" | "piano"

export type ProposalStatus = "pending" | "published" | "rejected"

export type ProposalAuthor = { name: string }

/**
 * "Based on a chart by <name>": the chart whose chords were copied with "Start from this chart". `name` is null when
 * that chart was anonymous (the server never sends a name for it); `id` is null once the original was deleted.
 */
export type ProposalCredit = { id: string | null; name: string | null }

export type ChordProposal = {
  id: string
  songId: number
  instrument: ChordInstrument
  baseKey: string
  capo: number
  strum: string | null
  /** one entry per lyric line */
  lines: Array<{ placements: Array<{ word: number; chord: string }> }>
  note: string | null
  playedIt: boolean
  createdAt: string
  isAnonymous: boolean
  /** null for an anonymous proposal: the server never sends a name for it, and this app never invents one */
  author: ProposalAuthor | null
  /** true only for the signed-in author asking about their own proposal */
  mine: boolean
  status: ProposalStatus
  rejectedReason: string | null
  /** true for the team */
  canReview: boolean
  /** set when the chords were copied from another member's chart */
  basedOn?: ProposalCredit | null
  /** the author's own view only: a newer version of this chart went live and replaced it (kept, hidden from everyone) */
  archived?: boolean
  /** the id of the newer chart that replaced this one (only when `archived`) */
  replacedBy?: string | null
  /** the author's own view only: the live chart this waiting chart will replace once it is accepted */
  replaces?: string | null
}

/** A proposal as the team sees it in the review queue. */
export type ReviewItem = ChordProposal & {
  authorId: string
  authorName: string
  reportsCount: number
}

export type ReviewFilter = "pending" | "reported" | "published" | "rejected" | "all"

/** What a member sends. Chords are already SOUNDING chords in `baseKey`. */
export type ProposalPayload = {
  songId: number
  instrument: ChordInstrument
  baseKey: string
  capo: number
  strum: string | null
  lines: Array<{ placements: Array<{ word: number; chord: string }> }>
  playedIt: boolean
  note: string | null
  isAnonymous: boolean
  /** a new version of the author's own LIVE chart: when it goes live the old one is replaced (archived) */
  replacesId?: string | null
  /** "Start from this chart": somebody else's published chart whose chords were copied (credited) */
  basedOnId?: string | null
}

export type ChordReportReason = "wrong_chords" | "offensive" | "spam" | "other"

/** What a person can be told when something goes wrong. Each has a sentence in locales/chordProposals.ts. */
export type ChordFailure =
  | "signin" // not signed in (or the session ran out)
  | "dailyLimit" // too many charts today
  | "slowDown" // too many in an hour
  | "duplicate" // exactly this chart was offered already
  | "tooMany" // three live charts of this song for this instrument
  | "invalid" // the server found the chart unusable
  | "forbidden" // not the author / not the team
  | "network" // no answer (offline)
  | "gone" // the chart is not there any more
  | "notEditable" // a live chart cannot be changed in place
  | "server"

export type SubmitOutcome = { ok: true; proposal: ChordProposal } | { ok: false; failure: ChordFailure }

/** The things the screens ask of a server (the real one, or the in-memory one of the web preview). */
export interface ChordsBackend {
  listForSong(songId: number): Promise<ChordProposal[]>
  mine(): Promise<ChordProposal[]>
  offer(payload: ProposalPayload): Promise<ChordProposal>
  /** the author fixes a waiting or rejected chart and sends it again (same song and instrument) */
  update(id: string, payload: ProposalPayload): Promise<ChordProposal>
  remove(id: string): Promise<void>
  report(id: string, reason: ChordReportReason): Promise<{ status: "received" | "already_reported" }>
  /** team only */
  reviewQueue(filter: ReviewFilter): Promise<{ items: ReviewItem[]; total: number }>
  approve(id: string): Promise<ReviewItem>
  reject(id: string, reason: string): Promise<ReviewItem>
  restore(id: string): Promise<ReviewItem>
}

/** The chart of a proposal, in the song page's model. Only published charts are `reviewed`. */
export function chartOf(proposal: Pick<ChordProposal, "baseKey" | "strum" | "lines" | "status">): ChordChart {
  return {
    reviewed: proposal.status === "published" || proposal.status === "pending",
    baseKey: proposal.baseKey,
    strum: proposal.strum ?? undefined,
    lines: proposal.lines.map((line) => ({ placements: line.placements.map((p) => ({ word: p.word, chord: p.chord })) })),
  }
}
