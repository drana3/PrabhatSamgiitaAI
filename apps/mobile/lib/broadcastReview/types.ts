import type { Broadcast, BroadcastRecording } from "@/lib/broadcasts/types"

/**
 * The team's desk for broadcasts (apps/api `/api/v1/broadcasts/review`, `/decisions`, `/recording-suggestions`;
 * docs/broadcasts.md). Only the team sees any of it: the server decides (a refusal is "denied"), the app stores nothing.
 * The link of a broadcast is shown as text here, never embedded: the team judges it before anybody plays it.
 */
export type ReviewState = "reported" | "auto_hidden" | "hidden" | "removed" | "kept"

/** `queue`: reports not yet judged, the ones hidden by the reports first. `hidden` and `removed`: what the team took off the lists, to look again. */
export type ReviewWhich = "queue" | "hidden" | "removed"

/** What the reports of one broadcast add up to. Never who sent them. */
export type ReportsSummary = {
  /** the weight that counted towards hiding (the part not yet judged) */
  counted: number
  /** people with a report not yet judged, and how many of them are anonymous (an anonymous report is seen, but does not count) */
  open: number
  anonymous: number
  /** people whose reports the team already judged ("Keep"): the same people cannot report it again for the same reason */
  cleared: number
  byReason: Record<string, number>
  notes: string[]
}

export type ReviewedBroadcast = Broadcast & {
  state: ReviewState
  reports: ReportsSummary
  reviewedAt: string | null
  reviewedBy: string | null
  /** how many people had reported when it was kept */
  reviewedReports: number
  hiddenAt: string | null
  hiddenBy: string | null
  hiddenReason: string | null
  removedAt: string | null
  removedBy: string | null
  removedReason: string | null
}

export type DecisionAction = "keep" | "hide" | "remove"

/** One line of the history of verdicts. */
export type Decision = {
  id: string
  broadcastId: string
  broadcastTitle: string
  action: DecisionAction
  reason: string | null
  decidedBy: string
  reportsTotal: number
  reportsCounted: number
  createdAt: string
}

/** A recording a member suggested for an ended broadcast, waiting for the team. */
export type Suggestion = { id: string; broadcastId: string; broadcastTitle: string; recording: BroadcastRecording }

export type ReviewFailure = "denied" | "network" | "gone" | "conflict" | "reasonNeeded" | "server"

export interface BroadcastReviewBackend {
  queue(which: ReviewWhich): Promise<{ items: ReviewedBroadcast[]; total: number }>
  decisions(): Promise<{ items: Decision[]; total: number }>
  suggestions(): Promise<{ items: Suggestion[]; total: number }>
  /** "The reports were not right": clears them and shows the broadcast again */
  keep(id: string): Promise<void>
  /** off the lists; the author and the team still read it. A reason is required: the author reads it. */
  hide(id: string, reason: string): Promise<void>
  /** removed for everybody but the team. A reason is required: the author reads it. */
  remove(id: string, reason: string): Promise<void>
  acceptSuggestion(id: string): Promise<void>
  rejectSuggestion(id: string): Promise<void>
}
