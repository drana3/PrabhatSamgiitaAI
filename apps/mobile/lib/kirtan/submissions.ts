import { normalizeKind } from "@/lib/kirtan/kind"
import type { RemoteRecording } from "@/lib/kirtan/remote"
import { validateAudioFile, type FileProblem } from "@/lib/kirtan/rules"
import type { Kirtan, KirtanStatus, KirtanTypeId, RecordingKind, UploadFailure } from "@/lib/kirtan/types"

/**
 * Submissions: a person uploads an audio file of a Kiirtan or a Bhajan (the `kind`) and it is PUBLISHED AT ONCE.
 * There is no waiting for review: the team looks afterwards, and removes a recording that breaks the content rules
 * with a notice to the author (docs/kiirtan-publishing.md). Pure transitions on a list, used by stores/kirtanStore.
 *
 * Life of a submission on the phone: `uploading` -> `published` (the server accepted it) or `failed` (a check or the
 * network stopped it; the person can try again). Later the server may say `removed`, with a reason.
 * The upload itself is lib/kirtan/upload.ts; the network calls are lib/kirtan/remote.ts.
 */

/**
 * Every new submission gets this type. The form does not ask for a type (Dada: "we don't need it"); "other" is
 * valid for both kinds, so covers and tones (lib/kirtan/tone) keep working. The team can set a better one later.
 * `byAuthor` records whether the person wrote or performs it. The one-time agreement to the content rules
 * is a separate step (stores/contentRulesStore).
 */
export const DEFAULT_SUBMISSION_TYPE = "other" as const

export type SubmissionInput = {
  /** "What is it?": a Kiirtan or a Bhajan. */
  kind: RecordingKind
  /** name of the picked audio file, e.g. `morning-round.mp3`; null until a file is chosen */
  fileName: string | null
  /** where the picked file is (a local uri, or a blob url in the browser) */
  fileUri: string | null
  /** size in bytes when the picker knows it */
  fileSize?: number | null
  /** the picker's content type, when it gives one */
  fileType?: string | null
  title: string
  /** performer or group */
  author: string
  /** the person is the author, or performs it themselves */
  byAuthor: boolean
  addedBy: string
  /** the person agreed to the content rules (now, or on an earlier upload) */
  termsAccepted?: boolean
}

export type SubmissionError = "file" | FileProblem | "title" | "author" | "terms"

/** The first thing missing from the form, or null when it can be sent. Order follows the form from the top. */
export function validateSubmission(input: SubmissionInput): SubmissionError | null {
  if (!input.fileName || !input.fileUri) return "file"
  const problem = validateAudioFile({ name: input.fileName, size: input.fileSize ?? null, type: input.fileType })
  if (problem) return problem
  if (!input.title.trim()) return "title"
  if (!input.author.trim()) return "author"
  if (!input.termsAccepted) return "terms"
  return null
}

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

/** Same title by the same author. Only used to catch a double tap while the first upload is still running. */
export function submissionKey(title: string, author: string): string {
  return `${tidy(title).toLowerCase()}|${tidy(author).toLowerCase()}`
}

function slug(text: string, fallback: string): string {
  return tidy(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || fallback
}

/** A new Kiirtan or Bhajan, on its way up. The id is stable per title and time. */
export function buildSubmission(input: SubmissionInput, now: number): Kirtan {
  const kind = normalizeKind(input.kind)
  return {
    id: `sub-${slug(input.title, kind)}-${now}`,
    kind,
    title: tidy(input.title),
    author: tidy(input.author),
    durationSec: null,
    type: DEFAULT_SUBMISSION_TYPE,
    byAuthor: Boolean(input.byAuthor),
    audioUrl: input.fileUri,
    thumbnailUrl: null,
    addedBy: input.addedBy.trim() || "You",
    status: "uploading",
    addedAt: now,
    ...(input.fileName ? { fileName: input.fileName } : {}),
    ...(input.fileType ? { fileType: input.fileType } : {}),
  }
}

export type AddResult = { list: Kirtan[]; added: Kirtan | null; duplicate: Kirtan | null }

/**
 * Adds a submission to the list. The only thing refused here is the same title by the same author while its first
 * upload is still running (a double tap). Whether the AUDIO is already in the app is the server's call: the same file
 * is refused, a similar one only warns, a different performance of the same chant is welcome (lib/kirtan/upload.ts).
 */
export function addSubmission(list: readonly Kirtan[], next: Kirtan): AddResult {
  const key = submissionKey(next.title, next.author)
  const running = list.find((k) => k.status === "uploading" && submissionKey(k.title, k.author) === key) ?? null
  if (running) return { list: [...list], added: null, duplicate: running }
  return { list: [next, ...list], added: next, duplicate: null }
}

function update(list: readonly Kirtan[], id: string, patch: (k: Kirtan) => Kirtan): Kirtan[] {
  return list.map((k) => (k.id === id ? patch(k) : k))
}

/** The server accepted the upload: it is published; the server's link, id and length replace the phone's file. */
export function markPublished(list: readonly Kirtan[], id: string, remote: RemoteRecording): Kirtan[] {
  return update(list, id, (k) => fromRemote(remote, k))
}

/** The upload stopped. The person can try again from My uploads. */
export function markFailed(list: readonly Kirtan[], id: string, failure: UploadFailure): Kirtan[] {
  return update(list, id, (k) => (k.status === "published" || k.status === "removed" ? k : { ...k, status: "failed", failure }))
}

/** Try again: back to uploading, the old failure forgotten. */
export function retrySubmission(list: readonly Kirtan[], id: string): Kirtan[] {
  return update(list, id, (k) => {
    if (k.status !== "failed") return k
    const { failure: _failure, ...rest } = k
    return { ...rest, status: "uploading" }
  })
}

/** Dismiss a submission that is not live (failed, still uploading, or removed). A published one is never dropped here. */
export function withdrawSubmission(list: readonly Kirtan[], id: string): Kirtan[] {
  return list.filter((k) => !(k.id === id && k.status !== "published"))
}

/** The team took it down (the server says so, with a reason). */
export function markRemoved(list: readonly Kirtan[], id: string, info: { reason: string; at: number }): Kirtan[] {
  return update(list, id, (k) => ({ ...k, status: "removed", removedReason: info.reason, removedAt: info.at }))
}

/** Published here before, removed now: the ones the person has to be told about. */
export function newlyRemoved(before: readonly Kirtan[], after: readonly Kirtan[]): Kirtan[] {
  const wasLive = new Set(before.filter((k) => k.status === "published").map((k) => k.id))
  return after.filter((k) => k.status === "removed" && wasLive.has(k.id))
}

/** Demo preview only (no server): the upload counts as done at once and the file stays on this device. */
export function markPublishedLocal(list: readonly Kirtan[], id: string): Kirtan[] {
  return update(list, id, (k) => {
    const { failure: _failure, ...rest } = k
    return { ...rest, status: "published" }
  })
}

/** Counts for the "Your uploads" header. */
export function submissionCounts(list: readonly Kirtan[]): Record<KirtanStatus, number> {
  const counts: Record<KirtanStatus, number> = { uploading: 0, published: 0, failed: 0, removed: 0 }
  for (const k of list) counts[k.status] += 1
  return counts
}

/* ------------------------------------------------------------------ the server's view */

function ms(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** A server recording as the app's `Kirtan`. `base` keeps the phone's own id and time when the item is already here. */
export function fromRemote(remote: RemoteRecording, base?: Kirtan): Kirtan {
  const removed = remote.status === "removed"
  const kind = normalizeKind(remote.kind)
  const next: Kirtan = {
    id: base?.id ?? `srv-${remote.id}`,
    kind,
    title: remote.title,
    author: remote.author,
    durationSec: remote.duration_sec ?? base?.durationSec ?? null,
    type: remote.type as KirtanTypeId,
    byAuthor: base?.byAuthor ?? remote.by_author,
    audioUrl: remote.audio_url,
    thumbnailUrl: remote.thumbnail_url,
    addedBy: remote.added_by,
    // the server's `flagged` is still live: it stays in the app until the team decides
    status: removed ? "removed" : "published",
    addedAt: base?.addedAt ?? ms(remote.published_at) ?? ms(remote.created_at) ?? 0,
    plays: remote.plays,
    serverId: remote.id,
    authorId: remote.author_id,
  }
  if (removed) {
    next.removedReason = remote.removed_reason ?? ""
    const at = ms(remote.removed_at)
    if (at !== undefined) next.removedAt = at
  }
  return next
}

/**
 * Folds the person's own uploads from the server (`GET /recordings/mine`) into the list: a recording the team removed
 * shows as removed with its reason; one made on another device appears here. Items that never reached the server
 * (uploading, failed) stay as they are.
 */
export function mergeRemoteMine(list: readonly Kirtan[], remote: readonly RemoteRecording[]): Kirtan[] {
  const byServerId = new Map(remote.map((r) => [r.id, r]))
  const known = new Set<string>()
  const merged = list.map((k) => {
    const r = k.serverId ? byServerId.get(k.serverId) : undefined
    if (!r) return k
    known.add(r.id)
    return fromRemote(r, k)
  })
  const fresh = remote.filter((r) => !known.has(r.id)).map((r) => fromRemote(r))
  return [...merged, ...fresh].sort((a, b) => b.addedAt - a.addedAt)
}
