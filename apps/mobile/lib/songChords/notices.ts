import type { AppNotification } from "@/lib/notifications"

import type { ChordInstrument, ChordProposal, ProposalStatus } from "./types"

/**
 * Notices for the author of a chord chart: "your chart is live" and "your chart was not published, here is why".
 *
 * The server already writes a notice row for each decision (apps/api `chords_published` / `chords_rejected`), but the
 * app has no inbox feed from the server yet. So the phone notices a decision the way it can: it remembers the state of
 * each of the member's charts (`seen`), and when `/song-chords/mine` shows a different state, that is the decision.
 * Pure: the clock and the words are passed in, and the first look at the account (nothing seen yet) only records, so a
 * new install does not announce old decisions.
 */
export type Seen = { statuses: Record<string, { status: ProposalStatus; n: number; archived?: boolean }> | null }

export const EMPTY_SEEN: Seen = { statuses: null }

type Say = (key: ChordNoticeKey, params: Record<string, string | number>) => string
export type ChordNoticeKey =
  | "notif.chords.published.title"
  | "notif.chords.published.text"
  | "notif.chords.restored.text"
  | "notif.chords.rejected.title"
  | "notif.chords.rejected.text"
  | "notif.chords.rejected.noReason"
  | "notif.chords.replaced.title"
  | "notif.chords.replaced.text"

export type Instruments = Record<ChordInstrument, string>

/**
 * Compare the member's charts with what was seen. Returns the new notices and the new `seen`.
 * - pending to published: "live"; rejected to published: "we looked again";
 * - pending or published to rejected: "not published" with the team's reason, opening the fix screen;
 * - a chart that a newer version of the same author replaced (it turned archived): "replaced by your new version";
 * - a chart seen for the first time, a chart that did not change, a chart that is gone: no notice.
 */
export function chordNotices(
  seen: Seen,
  mine: readonly ChordProposal[],
  now: number,
  say: Say,
  instruments: Instruments,
): { notices: AppNotification[]; seen: Seen } {
  const before = seen.statuses
  const after: NonNullable<Seen["statuses"]> = {}
  const notices: AppNotification[] = []
  for (const p of mine) {
    const was = before?.[p.id]
    if (!was) {
      after[p.id] = { status: p.status, n: 0, ...(p.archived ? { archived: true } : {}) }
      continue
    }
    const params = { number: p.songId, instrument: instruments[p.instrument] }
    if (p.archived && !was.archived) {
      notices.push({
        id: `chords:${p.id}:replaced`,
        kind: "upload",
        title: say("notif.chords.replaced.title", params),
        text: say("notif.chords.replaced.text", params),
        target: `/song-v2/ps-${p.songId}`,
        firedAt: now,
      })
    }
    if (was.status === p.status) {
      after[p.id] = p.archived ? { ...was, archived: true } : was
      continue
    }
    const n = was.n + 1
    after[p.id] = { status: p.status, n, ...(p.archived ? { archived: true } : {}) }
    if (p.status === "published") {
      notices.push({
        id: `chords:${p.id}:published:${n}`,
        kind: "upload",
        title: say("notif.chords.published.title", params),
        text: say(was.status === "rejected" ? "notif.chords.restored.text" : "notif.chords.published.text", params),
        target: `/song-v2/ps-${p.songId}`,
        firedAt: now,
      })
    } else if (p.status === "rejected") {
      const reason = p.rejectedReason?.trim()
      notices.push({
        id: `chords:${p.id}:rejected:${n}`,
        kind: "upload",
        title: say("notif.chords.rejected.title", params),
        text: reason ? say("notif.chords.rejected.text", { ...params, reason }) : say("notif.chords.rejected.noReason", params),
        target: `/upload-chords?edit=${p.id}`,
        firedAt: now,
      })
    }
  }
  return { notices, seen: { statuses: after } }
}
