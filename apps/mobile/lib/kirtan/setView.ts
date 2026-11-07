import type { RemoteSet, RemoteSetDetail, RemoteSetState } from "@/lib/kirtan/remoteSets"
import { fromRemote } from "@/lib/kirtan/submissions"
import { eventLabel, firstDayOf } from "@/lib/kirtan/setDate"
import { performerName, setCounts, setState, trackFields, trackDay, type SetDraft, type SetTrack } from "@/lib/kirtan/sets"
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
  /** the approximate date: the year and, when known, the month */
  eventYear: number | null
  eventMonth: number | null
  /** the cover: a path on the API, an https link, or a picture on this phone; null when none */
  coverUrl: string | null
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
  return { id: set.id, title: set.title, place: set.place, eventYear: set.event_year ?? null, eventMonth: set.event_month ?? null, coverUrl: set.cover_url, state: set.state, count: set.tracks_count, waiting: 0, source: "server" }
}

export function summaryOfDraft(draft: SetDraft): SetSummary {
  const counts = setCounts(draft)
  return { id: draft.id, title: draft.title.trim(), place: draft.place.trim() || null, eventYear: draft.eventYear, eventMonth: draft.eventMonth, coverUrl: draft.coverUri || null, state: setState(draft), count: counts.live, waiting: counts.waiting + counts.limit + counts.failed + counts.similar, source: "phone" }
}

/** A live track of a set kept on this phone, shaped like a library recording so the player can take it. */
export function kirtanOfTrack(track: SetTrack, draft: SetDraft, position: number, uploader = ""): Kirtan {
  const fields = trackFields(track, draft)
  return {
    id: track.recordingId ?? track.id,
    kind: fields.kind,
    title: track.title,
    author: performerName(draft, uploader),
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
    description: null,
    ownerName: ownerName || draft.performer.trim(),
    owner: true,
    tracks: live.map((track, index) => kirtanOfTrack(track, draft, index + 1, ownerName)),
    removedReason: null,
  }
}

/** "November 2026", or just "2026" when the month is not known, in the app's language (`monthName` gives the month word). */
export function whenLabel(view: Pick<SetSummary, "eventYear" | "eventMonth">, monthName: (month: number) => string): string {
  return eventLabel(view.eventYear, view.eventMonth, monthName)
}

/** Ordering for "My event playlists": what is not finished first (it needs the person), then the newest event first. */
export function sortSummaries<T extends SetSummary>(list: readonly T[]): T[] {
  const rank = (item: T) => (item.state === "published" || item.state === "removed" ? 1 : 0)
  return [...list].sort((a, b) => rank(a) - rank(b) || firstDayOf(b.eventYear, b.eventMonth).localeCompare(firstDayOf(a.eventYear, a.eventMonth)))
}

/** The server's list and the phone's own drafts as one list: a set on the phone wins for the same id (it is newer than the server's count). */
export function mergeSummaries(server: readonly SetSummary[], phone: readonly SetSummary[]): SetSummary[] {
  const onPhone = new Set(phone.map((item) => item.id))
  return sortSummaries([...phone, ...server.filter((item) => !onPhone.has(item.id))])
}
