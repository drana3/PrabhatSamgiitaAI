import {
  discardUpload,
  failureFromError,
  publishRecording,
  putFile,
  requestUpload,
  RemoteError,
  type RemoteBrief,
  type RemoteConfig,
  type RemoteRecording,
} from "@/lib/kirtan/remote"
import { audioContentType, RULES_VERSION, validateAudioFile } from "@/lib/kirtan/rules"
import type { RecordingKind, UploadFailure } from "@/lib/kirtan/types"

/**
 * One upload from the phone to the server, in three steps (docs/kiirtan-publishing.md):
 * 1. ask where to send the file (an exact copy that is already published is refused here, before the bytes travel),
 * 2. send the bytes,
 * 3. publish. The recording is live the moment step 3 returns.
 * A near copy ("sounds like a recording already in the library") is not refused: the outcome `similar` asks the author
 * whether theirs is a different performance, and the same call with `confirmDifferent` publishes it. If the author
 * backs out instead, `discardSimilar` deletes the file that was already sent. Pure of React and stores; `fetch` comes from `cfg`.
 */

export type UploadSource = {
  /** a local uri, or a blob url in the browser */
  uri: string
  fileName: string
  /** the picker's content type, when it gave one */
  fileType?: string | null
  kind: RecordingKind
  title: string
  author: string
  byAuthor: boolean
  year?: number | null
  language?: string | null
  languageOther?: string | null
  /** Dance music only */
  dance?: string | null
  /** a track of a playlist from an event: its server id and place; the playlist's own allowance and defaults apply */
  collectionId?: string | null
  position?: number | null
  recordedOn?: string | null
  credits?: string
  notes?: string
  /** Baba's Audio Discourses only */
  place?: string
  discourse?: string
  /** Prabhat Samgiita only: the number of the song */
  psSong?: number | null
  /** Kiirtan only: the optional style and the name of an "other" style */
  style?: string | null
  styleOther?: string | null
  /** Kiirtan only: "avarta" marks an Avarta Kiirtan */
  practice?: string | null
  /** the version of the content rules the person accepted */
  termsVersion?: string
  /** the author saw the "sounds like a recording already in the library" question and said theirs is different */
  confirmDifferent?: boolean
  /** a file that already reached the server in an earlier try (after the similar question), so it is not sent twice */
  key?: string
}

export type UploadOutcome =
  | { status: "published"; recording: RemoteRecording }
  | { status: "similar"; similar: RemoteBrief[]; key: string }
  | { status: "failed"; failure: UploadFailure }

export type UploadDeps = {
  /** reads the picked file; default: `fetch(uri).blob()` (works for file:// on a phone and blob: in the browser) */
  readBlob?: (uri: string) => Promise<Blob>
  /** SHA-256 of the file, hex; default: Web Crypto when it exists, else null (the server checks anyway) */
  sha256?: (blob: Blob) => Promise<string | null>
}

async function defaultReadBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri)
  return response.blob()
}

export async function sha256Hex(blob: Blob): Promise<string | null> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle
  if (!subtle || typeof blob.arrayBuffer !== "function") return null
  try {
    const digest = await subtle.digest("SHA-256", await blob.arrayBuffer())
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
  } catch {
    return null
  }
}

export async function uploadSubmission(cfg: RemoteConfig, source: UploadSource, deps: UploadDeps = {}): Promise<UploadOutcome> {
  const contentType = audioContentType(source.fileName, source.fileType)
  if (!contentType) return { status: "failed", failure: { code: "format" } }
  let key = source.key
  try {
    if (!key) {
      const blob = await (deps.readBlob ?? defaultReadBlob)(source.uri)
      const problem = validateAudioFile({ name: source.fileName, size: blob.size, type: source.fileType })
      if (problem) return { status: "failed", failure: { code: problem } }
      const sha256 = await (deps.sha256 ?? sha256Hex)(blob)
      const target = await requestUpload(cfg, { fileName: source.fileName, contentType, sizeBytes: blob.size, sha256, collectionId: source.collectionId })
      await putFile(cfg, target, blob, contentType)
      key = target.key
    }
    const recording = await publishRecording(cfg, {
      key,
      kind: source.kind,
      type: "other",
      title: source.title,
      author: source.author,
      byAuthor: source.byAuthor,
      termsVersion: source.termsVersion ?? RULES_VERSION,
      year: source.year,
      language: source.language,
      languageOther: source.languageOther,
      dance: source.dance,
      collectionId: source.collectionId,
      position: source.position,
      recordedOn: source.recordedOn,
      credits: source.credits,
      notes: source.notes,
      place: source.place,
      discourse: source.discourse,
      psSong: source.psSong,
      style: source.style,
      styleOther: source.styleOther,
      practice: source.practice,
      confirmDifferent: Boolean(source.confirmDifferent),
    })
    return { status: "published", recording }
  } catch (error) {
    if (key && error instanceof RemoteError && error.code === "similar_recording") {
      return { status: "similar", similar: error.similar, key }
    }
    const failure = failureFromError(error)
    // The same recording is in the library already: the stored copy is of no use, so it is deleted (best effort).
    if (key && (failure.code === "duplicate" || failure.code === "ownDuplicate" || failure.code === "removedDuplicate")) void discardSimilar(cfg, key)
    return { status: "failed", failure }
  }
}

/** The author said "Cancel" to the similar-recording question: the file that already reached the server is deleted. Never throws. */
export async function discardSimilar(cfg: RemoteConfig, key: string): Promise<void> {
  try {
    await discardUpload(cfg, key)
  } catch {
    // nothing to tell the person: an unpublished file is not shown anywhere
  }
}
