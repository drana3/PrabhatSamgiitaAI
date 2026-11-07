import type { RemoteSet, RemoteSetDetail, RemoteSetState } from "@/lib/kirtan/remoteSets"
import { fromRemote } from "@/lib/kirtan/submissions"
import { dayRange, parseDay, setCounts, setState, trackFields, trackDay, type SetDraft, type SetTrack } from "@/lib/kirtan/sets"
import type { Kirtan } from "@/lib/kirtan/types"

/**
 * What the set page and "My event playlists" show, from either source: the server's answer (the truth, for everyone)
 * or the draft kept on this phone (a set that is still going up, or the demo preview, where there is no server).
 * Pure: formats nothing itself (the screens pass in the date and text functions of the app's language).
 */

export type SetSummary = {
  id: string
  title: string
  place: string | null
  startsOn: string
  endsOn: string | null
  state: RemoteSetState
  /** live tracks */
  count: number
  /** tracks still to go up (only known for a set kept on this phone) */
  waiting: number
  /** where the numbers come from */
  source: "server" | "phone"
}

export type SetView = SetSummary & {
  description: string | null
  ownerName: string
  owner: boolean
  tracks: Kirtan[]
  removedReason: string | null
}

export function summaryOfRemote(set: RemoteSet): SetSummary {
  return { id: set.id, title: set.title, place: set.place, startsOn: set.starts_on, endsOn: set.ends_on, state: set.state, count: set.tracks_count, waiting: 0, source: "server" }
}

export function summaryOfDraft(draft: SetDraft): SetSummary {
  const counts = setCounts(draft)
  return { id: draft.id, title: draft.title.trim(), place: draft.place.trim() || null, startsOn: draft.startsOn, endsOn: draft.endsOn || null, state: setState(draft), count: counts.live, waiting: counts.waiting + counts.limit + counts.failed + counts.similar, source: "phone" }
}

/** A live track of a set kept on this phone, shaped like a library recording so the player can take it. */
export function kirtanOfTrack(track: SetTrack, draft: SetDraft, position: number): Kirtan {
  const fields = trackFields(track, draft)
  return {
    id: track.recordingId ?? track.id,
    kind: fields.kind,
    title: track.title,
    author: draft.performer,
    durationSec: null,
    type: "other",
    audioUrl: track.uri,
    thumbnailUrl: null,
    addedBy: "You",
    status: "published",
    addedAt: Date.parse(draft.createdAt) || 0,
    ...(fields.language ? { language: fields.language } : {}),
    ...(fields.languageOther ? { languageOther: fields.languageOther } : {}),
    ...(fields.dance ? { dance: fields.dance } : {}),
    collectionId: draft.id,
    position,
    recordedOn: trackDay(track, draft),
  }
}

export function viewOfRemote(detail: RemoteSetDetail, memberId: string | null): SetView {
  const tracks = detail.tracks.filter((track) => track.status === "published").map((track) => fromRemote(track))
  return {
    ...summaryOfRemote(detail),
    description: detail.description,
    ownerName: detail.owner_name,
    owner: Boolean(memberId) && detail.owner_id === memberId,
    tracks,
    removedReason: detail.removed_reason ?? null,
  }
}

export function viewOfDraft(draft: SetDraft, ownerName: string): SetView {
  const live = draft.tracks.filter((track) => track.status === "done")
  return {
    ...summaryOfDraft(draft),
    description: draft.description.trim() || null,
    ownerName: ownerName || draft.performer,
    owner: true,
    tracks: live.map((track, index) => kirtanOfTrack(track, draft, index + 1)),
    removedReason: null,
  }
}

/** "12 Nov 2026" or "12 Nov 2026 to 14 Nov 2026", in the app's language. */
export function whenLabel(view: Pick<SetSummary, "startsOn" | "endsOn">, format: (day: string) => string, to: (from: string, until: string) => string): string {
  return dayRange(view.startsOn, view.endsOn, format, to)
}

/** Ordering for "My event playlists": what is not finished first (it needs the person), then the newest event first. */
export function sortSummaries<T extends SetSummary>(list: readonly T[]): T[] {
  const rank = (item: T) => (item.state === "published" || item.state === "removed" ? 1 : 0)
  return [...list].sort((a, b) => rank(a) - rank(b) || (parseDay(b.startsOn) ?? "").localeCompare(parseDay(a.startsOn) ?? ""))
}

/** The server's list and the phone's own drafts as one list: a set on the phone wins for the same id (it is newer than the server's count). */
export function mergeSummaries(server: readonly SetSummary[], phone: readonly SetSummary[]): SetSummary[] {
  const onPhone = new Set(phone.map((item) => item.id))
  return sortSummaries([...phone, ...server.filter((item) => !onPhone.has(item.id))])
}
