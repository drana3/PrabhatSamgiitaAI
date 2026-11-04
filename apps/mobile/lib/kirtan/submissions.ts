import { isKirtanType, type Kirtan, type KirtanStatus, type KirtanTypeId } from "@/lib/kirtan/types"
import { isVideoId } from "@/lib/kirtan/youtube"

/**
 * Submissions: a person sends a public YouTube link; it waits for review.
 * Pure transitions on a list, used by stores/kirtanStore.
 * TODO(api): POST the submission to the backend; an admin approves or rejects there.
 */

export const CONFIRM_TEXT = "This is a public YouTube video. I am not uploading anyone's private recording."

export type SubmissionInput = {
  videoId: string
  title: string
  author?: string
  thumbnailUrl?: string | null
  type: KirtanTypeId | null
  confirmed: boolean
  addedBy: string
}

export type SubmissionError = "video" | "title" | "type" | "confirm"

/** The first thing missing from the form, or null when it can be sent. Order follows the form from the top. */
export function validateSubmission(input: SubmissionInput): SubmissionError | null {
  if (!isVideoId(input.videoId)) return "video"
  if (!input.title.trim()) return "title"
  if (!input.type || !isKirtanType(input.type)) return "type"
  if (!input.confirmed) return "confirm"
  return null
}

export const SUBMISSION_ERROR_TEXT: Record<SubmissionError, string> = {
  video: "Paste a link to a YouTube video.",
  title: "Add a title.",
  type: "Choose a type.",
  confirm: "Please confirm it is a public YouTube video.",
}

/** A new pending kirtan. The id is stable per video and time. */
export function buildSubmission(input: SubmissionInput, now: number): Kirtan {
  return {
    id: `sub-${input.videoId}-${now}`,
    videoId: input.videoId,
    title: input.title.trim().replace(/\s+/g, " "),
    author: (input.author ?? "").trim(),
    durationSec: null,
    type: (input.type as KirtanTypeId) ?? "other",
    thumbnailUrl: input.thumbnailUrl ?? null,
    addedBy: input.addedBy.trim() || "You",
    status: "pending",
    addedAt: now,
  }
}

export type AddResult = { list: Kirtan[]; added: Kirtan | null; duplicate: Kirtan | null }

/**
 * Adds a submission. The same video cannot wait twice: a pending or approved one blocks it
 * (a rejected one does not, so a person can try again after fixing the type).
 * `known` holds videos already in the catalog.
 */
export function addSubmission(list: readonly Kirtan[], next: Kirtan, known: readonly string[] = []): AddResult {
  const duplicate = list.find((k) => k.videoId === next.videoId && k.status !== "rejected") ?? null
  if (duplicate) return { list: [...list], added: null, duplicate }
  if (known.includes(next.videoId)) {
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
