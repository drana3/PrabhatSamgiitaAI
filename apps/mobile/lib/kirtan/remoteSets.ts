import { callBytes, callUrl, type RemoteConfig, type RemoteRecording } from "@/lib/kirtan/remote"
import type { RecordingKind } from "@/lib/kirtan/types"

/**
 * The phone's side of the playlists-from-an-event API (apps/api `/api/v1/recording-sets`, docs/kiirtan-sets.md).
 * Plain `fetch` through lib/kirtan/remote.ts `callUrl` (the same errors and codes as the recordings API); the base URL,
 * the member headers and `fetch` are passed in, so tests run it against a fake server.
 */

export type RemoteSetState = "draft" | "uploading" | "published" | "removed"

/** `SetOut` of the API. */
export type RemoteSet = {
  id: string
  title: string
  description: string | null
  place: string | null
  /** what people give: the year of the event and, when known, the month */
  event_year: number
  event_month: number | null
  /** the day it is filed under (the first of the month); an older field, kept for ordering */
  starts_on: string
  ends_on: string | null
  /** a path on the API for a picture the member uploaded, or the team's https link; null when none */
  cover_url: string | null
  owner_id: string | null
  owner_name: string
  default_kind: RecordingKind
  default_language: string | null
  default_language_other: string | null
  default_dance: string | null
  tracks_expected: number
  tracks_count: number
  state: RemoteSetState
  finished_at: string | null
  created_at: string
  removed_reason?: string | null
  removed_at?: string | null
}

/** `SetDetail`: the set and its tracks in order. */
export type RemoteSetDetail = RemoteSet & { tracks: RemoteRecording[] }

export type RemoteSetList = { items: RemoteSet[]; total: number }

export type SetCreatePayload = {
  id: string
  title: string
  eventYear: number
  /** null: the month is not known */
  eventMonth?: number | null
  place?: string | null
  defaultKind: RecordingKind
  defaultLanguage?: string | null
  defaultLanguageOther?: string | null
  defaultDance?: string | null
  tracksExpected?: number
}

export type SetPatchPayload = Partial<Pick<SetCreatePayload, "title" | "eventYear" | "eventMonth" | "place" | "defaultKind" | "tracksExpected">>

function url(cfg: RemoteConfig, path = ""): string {
  return `${cfg.baseUrl.replace(/\/+$/, "")}/api/v1/recording-sets${path}`
}

/** Only the fields that were given go over the wire; an empty text on an optional field clears it. */
function body(payload: SetPatchPayload | SetCreatePayload) {
  const out: Record<string, unknown> = {}
  const text = (value: string | null | undefined) => (value == null ? undefined : value.trim() || null)
  if ("id" in payload && payload.id) out.id = payload.id
  if (payload.title !== undefined) out.title = payload.title.trim()
  if (payload.eventYear !== undefined) out.event_year = payload.eventYear
  if (payload.eventMonth !== undefined) out.event_month = payload.eventMonth
  if (payload.place !== undefined) out.place = text(payload.place)
  if (payload.defaultKind !== undefined) out.default_kind = payload.defaultKind
  if ("defaultLanguage" in payload && payload.defaultLanguage !== undefined) out.default_language = payload.defaultLanguage
  if ("defaultLanguageOther" in payload && payload.defaultLanguageOther !== undefined) out.default_language_other = text(payload.defaultLanguageOther)
  if ("defaultDance" in payload && payload.defaultDance !== undefined) out.default_dance = payload.defaultDance
  if (payload.tracksExpected !== undefined) out.tracks_expected = payload.tracksExpected
  return out
}

/** Starts the playlist. Sending the same `id` again returns the one that exists (the app was killed before the answer came). */
export function createSet(cfg: RemoteConfig, payload: SetCreatePayload): Promise<RemoteSet> {
  return callUrl<RemoteSet>(cfg, "POST", url(cfg), body(payload))
}

/**
 * The cover picture: the bytes of a small JPEG, PNG or WebP (at most 300 KB). The server cuts out any metadata and
 * answers with the playlist, whose `cover_url` is the picture's address.
 */
export function putSetCover(cfg: RemoteConfig, id: string, bytes: Blob, contentType: string): Promise<RemoteSet> {
  return callBytes<RemoteSet>(cfg, "PUT", url(cfg, `/${id}/cover`), bytes, contentType)
}

export function removeSetCover(cfg: RemoteConfig, id: string): Promise<RemoteSet> {
  return callUrl<RemoteSet>(cfg, "DELETE", url(cfg, `/${id}/cover`))
}

export function patchSet(cfg: RemoteConfig, id: string, payload: SetPatchPayload): Promise<RemoteSet> {
  return callUrl<RemoteSet>(cfg, "PATCH", url(cfg, `/${id}`), body(payload))
}

/** The last file was sent: the playlist is published and leaves "draft". */
export function finishSet(cfg: RemoteConfig, id: string): Promise<RemoteSet> {
  return callUrl<RemoteSet>(cfg, "POST", url(cfg, `/${id}/finish`), {})
}

/** The order of the live tracks: every id, first to last. */
export function reorderSet(cfg: RemoteConfig, id: string, recordingIds: readonly string[]): Promise<RemoteSetDetail> {
  return callUrl<RemoteSetDetail>(cfg, "PUT", url(cfg, `/${id}/order`), { recording_ids: recordingIds })
}

/** Puts a recording the member already has into the playlist (at a place, or last). */
export function attachTrack(cfg: RemoteConfig, id: string, recordingId: string, position?: number): Promise<RemoteSetDetail> {
  return callUrl<RemoteSetDetail>(cfg, "POST", url(cfg, `/${id}/tracks`), { recording_id: recordingId, ...(position ? { position } : {}) })
}

/** A track's own title or date. */
export function patchTrackOnServer(cfg: RemoteConfig, id: string, recordingId: string, patch: { title?: string; recordedOn?: string | null }): Promise<RemoteRecording> {
  return callUrl<RemoteRecording>(cfg, "PATCH", url(cfg, `/${id}/tracks/${recordingId}`), {
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.recordedOn !== undefined ? { recorded_on: patch.recordedOn } : {}),
  })
}

/** Takes a track out of the playlist; the recording stays in the library on its own. */
export function removeTrackFromSet(cfg: RemoteConfig, id: string, recordingId: string): Promise<RemoteSetDetail> {
  return callUrl<RemoteSetDetail>(cfg, "DELETE", url(cfg, `/${id}/tracks/${recordingId}`))
}

/** Deletes the playlist. `tracks: "keep"` leaves its recordings in the library; "remove" takes them out as well. */
export function deleteSet(cfg: RemoteConfig, id: string, tracks: "keep" | "remove"): Promise<void> {
  return callUrl<void>(cfg, "DELETE", url(cfg, `/${id}?tracks=${tracks}`), undefined, undefined)
}

export function fetchPublicSets(cfg: RemoteConfig, query: { limit?: number; offset?: number } = {}): Promise<RemoteSetList> {
  const params = new URLSearchParams()
  if (query.limit) params.set("limit", String(query.limit))
  if (query.offset) params.set("offset", String(query.offset))
  const text = params.toString()
  return callUrl<RemoteSetList>(cfg, "GET", url(cfg, text ? `?${text}` : ""))
}

/** The member's own playlists, drafts included. */
export function fetchMySets(cfg: RemoteConfig): Promise<RemoteSetList> {
  return callUrl<RemoteSetList>(cfg, "GET", url(cfg, "/mine"))
}

export function fetchSet(cfg: RemoteConfig, id: string): Promise<RemoteSetDetail> {
  return callUrl<RemoteSetDetail>(cfg, "GET", url(cfg, `/${id}`))
}
