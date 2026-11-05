import { isTypeOfKind, normalizeKind } from "@/lib/kirtan/kind"
import type { Kirtan, KirtanStatus, KirtanTypeId, RecordingKind } from "@/lib/kirtan/types"

/**
 * Submissions: an author uploads an audio file of a Kiirtan or a Bhajan (the `kind`); it waits for review.
 * Pure transitions on a list, used by stores/kirtanStore.
 * TODO(api): upload the file to the backend (multipart or a signed URL), POST the metadata; an admin
 * approves or rejects there. Until then the file stays on the phone and only the record is kept.
 */

export const CONFIRM_TEXT = "This is my recording, or I have the rights holder's permission."

export type SubmissionInput = {
  /** "What is it?": a Kiirtan or a Bhajan. The type choices depend on it. */
  kind: RecordingKind
  /** name of the picked audio file, e.g. `morning-round.mp3`; null until a file is chosen */
  fileName: string | null
  /** where the picked file is (a local uri, or a blob url in the browser) */
  fileUri: string | null
  title: string
  /** performer or group */
  author: string
  type: KirtanTypeId | null
  confirmed: boolean
  addedBy: string
}

export type SubmissionError = "file" | "title" | "author" | "type" | "confirm"

/** The first thing missing from the form, or null when it can be sent. Order follows the form from the top. */
export function validateSubmission(input: SubmissionInput): SubmissionError | null {
  if (!input.fileName || !input.fileUri) return "file"
  if (!input.title.trim()) return "title"
  if (!input.author.trim()) return "author"
  if (!input.type || !isTypeOfKind(normalizeKind(input.kind), input.type)) return "type"
  if (!input.confirmed) return "confirm"
  return null
}

export const SUBMISSION_ERROR_TEXT: Record<SubmissionError, string> = {
  file: "Choose the audio file you recorded.",
  title: "Add a title.",
  author: "Add the performer or group.",
  type: "Choose a type.",
  confirm: "Please confirm this is your recording or you have permission.",
}

function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

/** Same title by the same author counts as the same recording. */
export function submissionKey(title: string, author: string): string {
  return `${tidy(title).toLowerCase()}|${tidy(author).toLowerCase()}`
}

function slug(text: string, fallback: string): string {
  return tidy(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || fallback
}

/** A new pending Kiirtan or Bhajan. The id is stable per title and time. */
export function buildSubmission(input: SubmissionInput, now: number): Kirtan {
  const kind = normalizeKind(input.kind)
  return {
    id: `sub-${slug(input.title, kind)}-${now}`,
    kind,
    title: tidy(input.title),
    author: tidy(input.author),
    durationSec: null,
    type: (input.type as KirtanTypeId) ?? "other",
    audioUrl: input.fileUri,
    thumbnailUrl: null,
    addedBy: input.addedBy.trim() || "You",
    status: "pending",
    addedAt: now,
  }
}

export type AddResult = { list: Kirtan[]; added: Kirtan | null; duplicate: Kirtan | null }

/**
 * Adds a submission. The same Kiirtan cannot wait twice: a pending or approved one blocks it
 * (a rejected one does not, so a person can try again after fixing the type).
 * `known` holds the submissionKey of Kiirtans already in the catalog.
 */
export function addSubmission(list: readonly Kirtan[], next: Kirtan, known: readonly string[] = []): AddResult {
  const key = submissionKey(next.title, next.author)
  const duplicate = list.find((k) => submissionKey(k.title, k.author) === key && k.status !== "rejected") ?? null
  if (duplicate) return { list: [...list], added: null, duplicate }
  if (known.includes(key)) {
    return { list: [...list], added: null, duplicate: { ...next, status: "approved" } }
  }
  return { list: [next, ...list], added: next, duplicate: null }
}

const ALLOWED: Record<KirtanStatus, readonly KirtanStatus[]> = {
  pending: ["approved", "rejected"],
  approved: [],
  rejected: [],
}

export function canTransition(from: KirtanStatus, to: KirtanStatus): boolean {
  return ALLOWED[from].includes(to)
}

/** Admin decision. Only a pending submission can be decided; anything else is left as it is. */
export function decideSubmission(list: readonly Kirtan[], id: string, to: Extract<KirtanStatus, "approved" | "rejected">): Kirtan[] {
  return list.map((k) => (k.id === id && canTransition(k.status, to) ? { ...k, status: to } : k))
}

/** A person may take back a submission that is waiting or was turned down. */
export function withdrawSubmission(list: readonly Kirtan[], id: string): Kirtan[] {
  return list.filter((k) => !(k.id === id && k.status !== "approved"))
}

/** Counts for the "Your submissions" header. */
export function submissionCounts(list: readonly Kirtan[]): Record<KirtanStatus, number> {
  const counts: Record<KirtanStatus, number> = { pending: 0, approved: 0, rejected: 0 }
  for (const k of list) counts[k.status] += 1
  return counts
}
