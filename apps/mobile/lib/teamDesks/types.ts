/** Shapes of the team desks' API answers (apps/api/app/api/v1/team_queues.py and value_suggestions.py). */

export type WordField = "instrument" | "style" | "mood" | "language" | "mantra"
export type WordAction = "accept" | "merge" | "reject"

export type MergeTarget = { code: string; label: string }

/** One word an author wrote under "Add your own", waiting for the team. */
export type WordItem = {
  id: string
  field: WordField
  label: string
  key: string
  status: "pending" | "accepted" | "merged" | "rejected"
  similar_to: string | null
  recordings_count: number
  people_count: number
  created_at: string | null
  first_by: string | null
  merge_targets: MergeTarget[]
}

export type TakedownKind = "notice" | "counter_notice"
export type TakedownStatus = "new" | "taken_down" | "rejected" | "counter_received" | "forwarded" | "restored" | "closed"

/** One takedown request (a rights holder's notice, or the uploader's counter-notice). */
export type TakedownItem = {
  id: string
  reference: string
  kind: TakedownKind
  status: TakedownStatus
  related_id: string | null
  recording_ref: string
  recording_id: string | null
  recording_title: string | null
  sender_name: string
  sender_org: string | null
  sender_email: string
  work_description: string
  claim_description: string | null
  decision_reason: string | null
  decided_by: string | null
  decided_at: string | null
  forwarded_at: string | null
  waiting_until: string | null
  created_at: string
}

export type TakedownAction = "link" | "takeDown" | "reject" | "forward" | "restore" | "restoreWithdrawn" | "close"

export type FlagStatus = "open" | "cleared" | "confirmed"
export type FlagAction = "clear" | "confirm" | "unconfirm"

/** One day whose play count looks inflated: counts and a reason, never who played. */
export type FlagItem = {
  recording_id: string
  recording_title: string | null
  day: string
  plays: number
  held: number
  confirmed_held: number
  last_decision: string | null
  baseline: number
  reason: string
  status: FlagStatus
  created_at: string
  reviewed_by: string | null
  reviewed_at: string | null
}

export type DeskFailure = "denied" | "network" | "conflict" | "gone" | "invalid" | "server"
