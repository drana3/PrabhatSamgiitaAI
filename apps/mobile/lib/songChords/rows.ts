import { listDrafts, type DraftBook, type DraftEntry } from "./drafts"
import type { ChordInstrument, ChordProposal, ProposalStatus } from "./types"

/**
 * "Your chord charts" on the Upload hub, one compact row per chart. A row is either a chart the member sent (waiting,
 * published, not accepted) or a draft that lives only on the phone. Pure, so the whole table of actions
 * (docs/chord-proposals.md, "Actions of a row") is tested without a screen.
 */
export type RowKind = "draft" | ProposalStatus

export type ChartRow = {
  /** the chart id, or the draft key for a draft */
  key: string
  kind: RowKind
  songId: number | null
  instrument: ChordInstrument
  /** the chart, for a chart row */
  proposal: ChordProposal | null
  /** a draft row: the draft itself. A chart row: unsent changes the member saved for it (a fix or a new version) */
  draft: DraftEntry | null
}

/** What a row (or its menu) can do. The result of each is in the scenario table. */
export type RowAction =
  | "continue" // open the draft in the editor
  | "edit" // open a waiting chart in the editor
  | "fix" // open a not accepted chart in the editor, with the team's words on top
  | "newVersion" // open a copy of a live chart in the editor
  | "why" // the team's reason, in a small window with a way to fix it
  | "viewSong" // the song page
  | "withdraw" // take a waiting chart back from the team (deletes it)
  | "delete" // delete a live or not accepted chart
  | "discardDraft" // throw away a draft that has no chart
  | "discardChanges" // throw away the unsent changes of a chart

const ORDER: Record<RowKind, number> = { rejected: 0, draft: 1, pending: 2, published: 3 }

function ownerOf(entry: DraftEntry): string | null {
  return entry.draft.editId ?? entry.draft.basedOn ?? null
}

/**
 * The rows of the list: what needs the member first (not accepted, then drafts, then waiting, then live), newest first
 * inside each group. A draft that belongs to a chart in the list (a fix, a new version) rides on that chart's row as
 * "unsent changes" instead of being a second row. A draft whose chart cannot be found (deleted somewhere else, or the
 * list has not loaded yet) is shown on its own, so a draft is never hidden.
 */
export function buildRows(mine: readonly ChordProposal[], book: DraftBook): ChartRow[] {
  const byId = new Set(mine.map((p) => p.id))
  const attachedTo = new Map<string, DraftEntry>()
  const rows: ChartRow[] = []
  for (const entry of listDrafts(book)) {
    const owner = ownerOf(entry)
    if (owner && byId.has(owner)) {
      attachedTo.set(owner, entry)
      continue
    }
    rows.push({ key: entry.key, kind: "draft", songId: entry.draft.songId, instrument: entry.draft.instrument, proposal: null, draft: entry })
  }
  for (const p of mine) rows.push({ key: p.id, kind: p.status, songId: p.songId, instrument: p.instrument, proposal: p, draft: attachedTo.get(p.id) ?? null })
  const when = (r: ChartRow) => (r.kind === "draft" ? (r.draft?.updatedAt ?? 0) : Date.parse(r.proposal?.createdAt ?? "") || 0)
  return rows.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || when(b) - when(a) || a.key.localeCompare(b.key))
}

/** What a tap on the row itself does. */
export function primaryAction(row: Pick<ChartRow, "kind">): RowAction {
  switch (row.kind) {
    case "draft":
      return "continue"
    case "pending":
      return "edit"
    case "rejected":
      return "why"
    case "published":
      return "viewSong"
  }
}

/** The items of the ⋯ menu, in the order they are shown. The one that destroys something is always last. */
export function menuActions(row: Pick<ChartRow, "kind" | "draft">): RowAction[] {
  const changes: RowAction[] = row.kind !== "draft" && row.draft ? ["discardChanges"] : []
  switch (row.kind) {
    case "draft":
      return ["continue", "discardDraft"]
    case "pending":
      return ["edit", "viewSong", ...changes, "withdraw"]
    case "rejected":
      return ["fix", "why", ...changes, "delete"]
    case "published":
      return ["viewSong", "newVersion", ...changes, "delete"]
  }
}

/** The address a row action opens, or null when the action stays on the hub (a window, or a change). */
export function actionHref(action: RowAction, row: Pick<ChartRow, "songId" | "proposal" | "draft">): string | null {
  const p = row.proposal
  switch (action) {
    case "continue":
      return row.draft ? `/upload-chords?draft=${encodeURIComponent(row.draft.key)}` : null
    case "edit":
    case "fix":
      return p ? `/upload-chords?edit=${encodeURIComponent(p.id)}` : null
    case "newVersion":
      return p ? `/upload-chords?copy=${encodeURIComponent(p.id)}` : null
    case "viewSong":
      return row.songId ? `/song-v2/ps-${row.songId}` : null
    default:
      return null
  }
}
