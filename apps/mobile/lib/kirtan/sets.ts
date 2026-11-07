import { addFiles, effectiveFields, patchItem, queueCounts, removeItem, requeue, requeueAll, runQueue, setRowFields, type KindDefaults, type PickedFile, type QueueItem, type QueueStop, type RowFieldsPatch, type RowOutcome } from "@/lib/kirtan/queue"
import { kindHasDance, kindHasLanguage, normalizeKind } from "@/lib/kirtan/kind"
import { cleanLanguageOther } from "@/lib/kirtan/languages"
import { missingKindFields, type MissingField } from "@/lib/kirtan/uploadForm"
import type { DanceId, RecordingKind } from "@/lib/kirtan/types"

/**
 * A playlist from an event ("set"): a concert, a retreat, a festival, a satsang - many recordings sent together under
 * one title, date and place (docs/kiirtan-sets.md). Pure: the draft, its rules, the ordering, the status and the loop
 * that works through the tracks. No React, no stores, no network: the store (stores/uploadSetStore.ts) wires the real
 * calls, the tests wire fakes.
 *
 * A TRACK is a queue row (lib/kirtan/queue.ts `QueueItem`) with a few more fields of its own: a date, a kind and the
 * server id once it is live. Everything the bulk queue knows (retry, duplicate, similar, the daily limit, the row's own
 * language and dance, "Apply to all") works the same on the tracks of a set.
 *
 * The set's STATUS is read from its tracks, never kept apart:
 *   draft      nothing has been sent yet (the person is still filling it in, or the app was closed before Upload)
 *   uploading  some tracks are live or going, and some still wait, run or failed
 *   published  every track that was meant to go up is live (or was left out on purpose); nothing waits
 */

/** The limits of the server, kept here only to explain them before the person hits them (apps/api config.py is the truth). */
export const SET_LIMITS = {
  /** tracks in one playlist */
  maxTracks: 60,
  /** the team keeps long recorded events whole */
  maxTracksTeam: 200,
  /** tracks of playlists a member can put up in one day (apart from the single-upload allowance) */
  tracksPerDay: 60,
  /** playlists a member can start in one day */
  setsPerDay: 3,
  /** started playlists without a live track a member can hold at once */
  emptyDrafts: 5,
} as const

export type SetState = "draft" | "uploading" | "published"

/** One track of the set. Fields left `undefined` are inherited from the set. */
export type SetTrack = QueueItem & {
  /** this track's own date (YYYY-MM-DD); the set's first day when empty */
  recordedOn?: string
  /** this track's own type; the set's default type when empty */
  kind?: RecordingKind
  /** the server id once the track is live: reordering and removing a live track need it */
  recordingId?: string
}

/** The set the person is making. `id` is made on the phone, so a create that is sent twice finds the same set. */
export type SetDraft = {
  id: string
  title: string
  /** YYYY-MM-DD */
  startsOn: string
  /** YYYY-MM-DD; empty for a one-day event */
  endsOn: string
  place: string
  description: string
  /** an https URL of a cover picture, when there is one (the cover upload is not built yet; see docs/kiirtan-sets.md) */
  coverUrl: string
  /** the performer: who sings these tracks (the same for the whole set; a track by someone else is a separate upload) */
  performer: string
  /** the type, language and dance every track inherits unless it has its own */
  defaultKind: RecordingKind
  defaultLanguage: string | null
  defaultLanguageOther: string
  defaultDance: DanceId | null
  /** the person confirmed the content rules once for the whole set */
  confirmed: boolean
  /** the playlist exists on the server (the create was answered) */
  created: boolean
  /** the server says it is finished (the last file was sent) */
  finished: boolean
  tracks: SetTrack[]
  createdAt: string
}

export type SetDetailsError = "title" | "date" | "dateOrder" | "dateFuture" | "performer"

/* ------------------------------------------------------------------ dates */

/** `2026-11-07`, or null when the text is not a real calendar day. */
export function parseDay(text: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((text ?? "").trim())
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null
  if (Number(y) < 1900) return null
  return `${y}-${m}-${d}`
}

/** Today as YYYY-MM-DD in UTC (the server compares in UTC and allows a day of slack). */
export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** The server refuses a date more than a day ahead. */
export function isFutureDay(day: string, now: Date = new Date()): boolean {
  const limit = new Date(now.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10)
  return day > limit
}

/* ------------------------------------------------------------------ the draft */

export function newSetDraft(id: string, now: Date = new Date()): SetDraft {
  return {
    id,
    title: "",
    startsOn: today(now),
    endsOn: "",
    place: "",
    description: "",
    coverUrl: "",
    performer: "",
    defaultKind: "kiirtan",
    defaultLanguage: null,
    defaultLanguageOther: "",
    defaultDance: null,
    confirmed: false,
    created: false,
    finished: false,
    tracks: [],
    createdAt: now.toISOString(),
  }
}

/** The set's choices that every track without its own inherits (the same shape the bulk queue uses). */
export function setDefaults(draft: SetDraft): KindDefaults {
  return { kind: draft.defaultKind, language: draft.defaultLanguage, languageOther: draft.defaultLanguageOther, dance: draft.defaultDance }
}

/** The type of one track. */
export function trackKind(track: SetTrack, draft: SetDraft): RecordingKind {
  return track.kind ?? draft.defaultKind
}

/** The fields a track will be sent with: its own type, language and dance, else the set's. A type without a language sends none. */
export function trackFields(track: SetTrack, draft: SetDraft) {
  const kind = trackKind(track, draft)
  const fields = effectiveFields(track, { ...setDefaults(draft), kind })
  return {
    kind,
    language: kindHasLanguage(kind) ? fields.language : null,
    languageOther: kindHasLanguage(kind) && fields.language === "other" ? cleanLanguageOther(fields.languageOther) : null,
    dance: kindHasDance(kind) ? fields.dance : null,
  }
}

/** What this track still needs (a Spiritual song needs its language, a Dance song its dance). */
export function trackMissing(track: SetTrack, draft: SetDraft): MissingField[] {
  const kind = trackKind(track, draft)
  return missingKindFields(effectiveFields(track, { ...setDefaults(draft), kind }))
}

/** The date a track will carry: its own, else the first day of the set. */
export function trackDay(track: SetTrack, draft: SetDraft): string {
  return parseDay(track.recordedOn) ?? parseDay(draft.startsOn) ?? ""
}

/** The first thing wrong with the set's details, or null (the first step of the flow). */
export function validateSetDetails(draft: SetDraft, now: Date = new Date()): SetDetailsError | null {
  if (!draft.title.trim()) return "title"
  const start = parseDay(draft.startsOn)
  if (!start) return "date"
  if (isFutureDay(start, now)) return "dateFuture"
  if (draft.endsOn.trim()) {
    const end = parseDay(draft.endsOn)
    if (!end) return "date"
    if (end < start) return "dateOrder"
    if (isFutureDay(end, now)) return "dateFuture"
  }
  if (!draft.performer.trim()) return "performer"
  return null
}

/** Tracks the set may still take. */
export function roomLeft(draft: SetDraft, team: boolean): number {
  return Math.max(0, (team ? SET_LIMITS.maxTracksTeam : SET_LIMITS.maxTracks) - draft.tracks.length)
}

/* ------------------------------------------------------------------ tracks: add, order, edit */

/**
 * Adds picked files as tracks, in the order they were picked. A file already in the set (same name and size) is left
 * out, and so is every file beyond the room the set has: `skipped` and `overLimit` say how many, so the screen can tell.
 */
export function addTracks(draft: SetDraft, files: readonly PickedFile[], newId: () => string, team: boolean): { draft: SetDraft; added: number; skipped: number; overLimit: number } {
  const room = roomLeft(draft, team)
  const fresh = files.filter((file) => !draft.tracks.some((track) => track.fileName === file.name && track.size === file.size))
  const seen = new Set<string>()
  const unique = fresh.filter((file) => {
    const key = `${file.name}:${file.size}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const taken = unique.slice(0, room)
  const result = addFiles(draft.tracks, taken, newId)
  return { draft: { ...draft, tracks: result.items as SetTrack[] }, added: result.added, skipped: files.length - unique.length, overLimit: unique.length - taken.length }
}

/** Moves a track to a place in the list (0 is first). A track that is already live moves too: the server order is set at the end. */
export function moveTrack(tracks: readonly SetTrack[], id: string, to: number): SetTrack[] {
  const from = tracks.findIndex((track) => track.id === id)
  if (from < 0) return [...tracks]
  const target = Math.max(0, Math.min(tracks.length - 1, to))
  if (target === from) return [...tracks]
  const next = [...tracks]
  const [moved] = next.splice(from, 1)
  next.splice(target, 0, moved as SetTrack)
  return next
}

/** One step up (-1) or down (+1): the buttons of the list, for people who do not drag. */
export function nudgeTrack(tracks: readonly SetTrack[], id: string, step: -1 | 1): SetTrack[] {
  const from = tracks.findIndex((track) => track.id === id)
  return from < 0 ? [...tracks] : moveTrack(tracks, id, from + step)
}

/** The tracks sorted by the order of the file names, numbers read as numbers ("2 Lord" before "10 Lord"). */
export function sortByFileName(tracks: readonly SetTrack[]): SetTrack[] {
  return [...tracks].sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: "base" }))
}

/** 1-based place of a track. */
export function positionOf(tracks: readonly SetTrack[], id: string): number {
  const index = tracks.findIndex((track) => track.id === id)
  return index < 0 ? 0 : index + 1
}

export function patchTrack(draft: SetDraft, id: string, patch: Partial<SetTrack>): SetDraft {
  return { ...draft, tracks: patchItem(draft.tracks, id, patch) as SetTrack[] }
}

export function setTrackTitle(draft: SetDraft, id: string, title: string): SetDraft {
  return patchTrack(draft, id, { title })
}

/** A track's own date. An empty or invalid text clears it, and the track follows the set again. */
export function setTrackDay(draft: SetDraft, id: string, text: string): SetDraft {
  return patchTrack(draft, id, { recordedOn: parseDay(text) ?? undefined })
}

/** A track's own type. The language and dance it had go with it if the new type has none. */
export function setTrackKind(draft: SetDraft, id: string, kind: RecordingKind | undefined): SetDraft {
  const next = patchTrack(draft, id, { kind: kind ? normalizeKind(kind) : undefined })
  return next
}

export function setTrackFields(draft: SetDraft, id: string, patch: RowFieldsPatch): SetDraft {
  return { ...draft, tracks: setRowFields(draft.tracks, id, patch) as SetTrack[] }
}

/** Removes a track that is not being sent. */
export function removeTrack(draft: SetDraft, id: string): SetDraft {
  return { ...draft, tracks: removeItem(draft.tracks, id) as SetTrack[] }
}

/** Puts a track that stopped back in line (a retry). */
export function retryTrack(draft: SetDraft, id: string): SetDraft {
  return { ...draft, tracks: requeue(draft.tracks, id) as SetTrack[] }
}

export function retryAllTracks(draft: SetDraft): SetDraft {
  return { ...draft, tracks: requeueAll(draft.tracks) as SetTrack[] }
}

/* ------------------------------------------------------------------ status and numbers */

export type SetCounts = { total: number; waiting: number; uploading: number; live: number; duplicate: number; similar: number; limit: number; failed: number; missing: number }

export function setCounts(draft: SetDraft): SetCounts {
  const counts = queueCounts(draft.tracks)
  const missing = draft.tracks.filter((track) => track.status === "waiting" && trackMissing(track, draft).length > 0).length
  return { total: counts.total, waiting: counts.waiting, uploading: counts.uploading, live: counts.done, duplicate: counts.duplicate, similar: counts.similar, limit: counts.limit, failed: counts.failed, missing }
}

/** Is every track settled (none waits or runs)? Limits, failures and duplicates are settled: they wait for the person, not for the loop. */
export function isSettled(draft: SetDraft): boolean {
  return !draft.tracks.some((track) => track.status === "waiting" || track.status === "uploading")
}

export function setState(draft: SetDraft): SetState {
  const counts = setCounts(draft)
  const open = counts.waiting + counts.uploading + counts.limit + counts.failed + counts.similar
  if (counts.live > 0 && open === 0) return "published"
  // nothing has been tried yet (this includes a set without tracks)
  if (counts.waiting === counts.total) return "draft"
  return "uploading"
}

/** 0 to 1 over the tracks that could be sent. */
export function setProgress(draft: SetDraft): number {
  const sendable = draft.tracks.filter((track) => !(track.status === "failed" && (track.failure?.code === "format" || track.failure?.code === "size")))
  if (!sendable.length) return 0
  return sendable.filter((track) => track.status !== "waiting" && track.status !== "uploading").length / sendable.length
}

/** Can the set go up? Details are right, the rules are confirmed, at least one track waits and none misses a field. */
export type StartBlock = "details" | "rules" | "nothing" | "fields" | null

export function startBlock(draft: SetDraft, now: Date = new Date()): StartBlock {
  if (validateSetDetails(draft, now)) return "details"
  if (!draft.confirmed) return "rules"
  const waiting = draft.tracks.filter((track) => track.status === "waiting")
  if (!waiting.length) return "nothing"
  if (waiting.some((track) => !track.title.trim() || trackMissing(track, draft).length > 0)) return "fields"
  return null
}

/** The live tracks in list order: the order the server is asked to keep. */
export function liveOrder(draft: SetDraft): string[] {
  return draft.tracks.flatMap((track) => (track.status === "done" && track.recordingId ? [track.recordingId] : []))
}

/* ------------------------------------------------------------------ the loop */

export type SetRunDeps = {
  /** the draft as it is now (the person may edit while it runs) */
  draft: () => SetDraft
  patch: (id: string, patch: Partial<SetTrack>) => void
  /** sends one track at the place it has in the list; never throws */
  upload: (track: SetTrack, position: number) => Promise<RowOutcome & { recordingId?: string }>
}

/** Why a run ended early: the queue's reasons, plus no connection (the tracks that did not go stay waiting). */
export type SetRunStop = QueueStop | "network"

/**
 * Sends the waiting tracks one after another, in list order, each with its place. A track that fails does not stop the
 * others (partial success is normal: the person retries the failed ones). A track that still misses its language or
 * dance is passed over. The daily limit and a lost sign-in stop the run, and the rest stay waiting for tomorrow.
 * No connection stops it too, and the track that was going goes back to waiting, so continuing needs no "retry".
 */
export async function runSet(deps: SetRunDeps): Promise<SetRunStop> {
  let offline = false
  const stop = await runQueue({
    items: () => deps.draft().tracks,
    patch: (id, patch) => {
      if (patch.status === "failed" && patch.failure?.code === "network") {
        // not a failure of the file: it goes back in line, and the screen says there is no connection
        offline = true
        deps.patch(id, { status: "waiting", failure: undefined })
        return
      }
      deps.patch(id, patch as Partial<SetTrack>)
    },
    ready: (track) => !offline && trackMissing(track as SetTrack, deps.draft()).length === 0 && Boolean(track.title.trim()),
    upload: async (track) => {
      const outcome = await deps.upload(track as SetTrack, positionOf(deps.draft().tracks, track.id))
      if (outcome.status === "published" && outcome.recordingId) deps.patch(track.id, { recordingId: outcome.recordingId, similar: undefined })
      return outcome
    },
  })
  return stop ?? (offline ? "network" : null)
}

/* ------------------------------------------------------------------ after the app was closed */

/**
 * A draft read back from the phone's storage. The app may have been killed in the middle of a track: that track was
 * "uploading" and goes back to "waiting" (the server answers "already yours" if the file did arrive; the row then says
 * so). In the browser a picked file is a blob address that does not survive a reload: that track cannot be sent any
 * more and says so, the person removes it or picks the file again. Nothing else changes, so the set resumes where it was.
 */
export function restoreDraft(draft: SetDraft): SetDraft {
  const tracks = draft.tracks.map((track): SetTrack => {
    let next = track
    if (next.status === "uploading") next = { ...next, status: "waiting" }
    if (next.status === "waiting" && next.uri.startsWith("blob:")) next = { ...next, status: "failed", failure: { code: "gone" } }
    return next
  })
  return { ...draft, tracks }
}

/** A short line for lists: the days of the event ("12 Nov 2026" or "12 to 14 Nov 2026"), in the given formatter. */
export function dayRange(startsOn: string, endsOn: string | null | undefined, format: (day: string) => string, to: (from: string, until: string) => string): string {
  const start = parseDay(startsOn)
  if (!start) return ""
  const end = parseDay(endsOn ?? "")
  if (!end || end === start) return format(start)
  return to(format(start), format(end))
}
