import type { ClaimRecording, MatchLevel, ProofOut, RequestStage, TeamReason } from "@/lib/authors/types"

/**
 * The team's desk for "claim my recordings" (apps/api `/admin/authors/claims`; docs/author-profiles.md, "The team desk").
 * Pure shapes and rules; the calls are in deskRemote.ts, the preview's stand-in in deskDemo.ts.
 */

export type DeskStatus = "pending" | "approved" | "rejected" | "revoked"
export const DESK_TABS: readonly DeskStatus[] = ["pending", "approved", "rejected", "revoked"]

/** What the team can do with one request. `reopen` is the Undo: the decision goes back to "waiting", nobody is told. */
export type DeskAction = "approve" | "reject" | "revoke" | "reopen"

export type DeskClaim = {
  id: string
  profile_id: string
  profile_slug: string
  profile_name: string
  profile_verified: boolean
  recording: ClaimRecording
  level: MatchLevel
  matched_text: string
  route: "self" | "team"
  status: DeskStatus | "withdrawn"
  team_reason: TeamReason | null
  created_at: string
  decided_by: string | null
  decision_note: string | null
  /** what the person wrote about a look-alike name (only the team reads it); absent from an older server */
  person_note?: string | null
  /** other pages that asked for the same recording; the team may put it on both */
  also_claimed_by?: { profile_id: string; profile_slug: string; profile_name: string }[]
}

export type DeskList = { items: DeskClaim[]; total: number }

export type DeskSummary = {
  pending: number
  approved: number
  rejected: number
  revoked: number
  /** the waiting ones per reason; `other` for a request that has none */
  by_reason: Record<string, number>
  /** proofs waiting for an answer, and how many of them are past the 3 days (absent from an older server) */
  proofs_waiting?: number
  overdue?: number
}

export const EMPTY_SUMMARY: DeskSummary = { pending: 0, approved: 0, rejected: 0, revoked: 0, by_reason: {} }

/** A proof as the team sees it: the page it is for, who decided, and whether it waited past the 3 days. */
export type DeskProof = ProofOut & {
  profile_id: string
  profile_slug: string
  profile_name: string
  decided_by: string | null
  overdue: boolean
}
export type DeskProofList = { items: DeskProof[]; total: number }
export type ProofAction = "ok" | "decline" | "more"

export type DeskPage = {
  profile_id: string
  slug: string
  name: string
  author_type: "solo" | "group"
  status: string
  verified: boolean
  claimed_name: string | null
  country: string | null
  city: string | null
  bio: string
  links: { kind: string; url: string }[]
  names: string[]
  created_at: string
  stage: RequestStage
  required: number
  have: number
  why_required: "one" | "famous" | "group"
  proofs: DeskProof[]
  pending: number
  approved: number
  rejected: number
}

export interface ClaimsDesk {
  readonly demo: boolean
  list(status: DeskStatus, reason?: string | null): Promise<DeskList>
  summary(): Promise<DeskSummary>
  /** one decision for any number of requests (also from several pages); returns how many changed */
  decide(ids: readonly string[], action: DeskAction, note?: string): Promise<number>
  /** the proofs of identity of one status (waiting by default), oldest first */
  proofs(status?: string): Promise<DeskProofList>
  page(profileId: string): Promise<DeskPage>
  /** accept (`ok`, with `approveWaiting` also the page's waiting requests), decline, or ask for more */
  decideProof(proofId: string, action: ProofAction, input?: { note?: string; approveWaiting?: boolean }): Promise<void>
  /** the team e-mails the code; `sent: false` when e-mail is not set up on the server */
  sendCode(proofId: string): Promise<{ sent: boolean }>
  askMore(profileId: string, note: string): Promise<void>
}

export type DeskFailure = "denied" | "network" | "conflict" | "server"

/** What a request in a tab can be given: a waiting one is approved or declined; a decided one is reversed or put back. */
export function actionsFor(status: DeskStatus): readonly DeskAction[] {
  switch (status) {
    case "pending":
      return ["approve", "reject"]
    case "approved":
      return ["revoke", "reopen"]
    default:
      return ["approve", "reopen"]
  }
}

/** The Undo of a bulk decision: every decision goes back to waiting. */
export const UNDO: DeskAction = "reopen"

export type DeskGroup = { profileId: string; slug: string; name: string; verified: boolean; items: DeskClaim[] }

/** The requests grouped by author page, in the order the pages first appear (the server sorts by page). */
export function groupByPage(items: readonly DeskClaim[]): DeskGroup[] {
  const groups = new Map<string, DeskGroup>()
  for (const item of items) {
    const group = groups.get(item.profile_id) ?? { profileId: item.profile_id, slug: item.profile_slug, name: item.profile_name, verified: item.profile_verified, items: [] }
    group.items.push(item)
    groups.set(item.profile_id, group)
  }
  return [...groups.values()]
}

/** The reason chips of the waiting tab: only reasons that have requests, the biggest first. */
export function reasonChips(summary: DeskSummary): { reason: string; count: number }[] {
  return Object.entries(summary.by_reason)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

/** Toggle one id in a selection (returns a new set). */
export function toggled(selection: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selection)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/** Select or clear a whole group at once. */
export function setMany(selection: ReadonlySet<string>, ids: readonly string[], on: boolean): Set<string> {
  const next = new Set(selection)
  for (const id of ids) {
    if (on) next.add(id)
    else next.delete(id)
  }
  return next
}

/** The words key for a reason; `taken_by_other` ends in `_other`, which the dictionaries read as a plural form, so it is stored as `taken`. */
export function deskReasonKey(reason: string): string {
  return `claimsDesk.reason.${reason === "taken_by_other" ? "taken" : reason}`
}

/** The proofs that wait longest come first; overdue ones lead. */
export function proofOrder(items: readonly DeskProof[]): DeskProof[] {
  return [...items].sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.created_at.localeCompare(b.created_at))
}

/** What the team can do with a proof in this state. A code is only for an e-mail proof that has none confirmed. */
export function proofActions(proof: DeskProof): readonly (ProofAction | "code")[] {
  if (proof.status === "ok" || proof.status === "declined" || proof.status === "withdrawn") return []
  const actions: (ProofAction | "code")[] = []
  if (proof.kind === "email" && !proof.code_confirmed) actions.push("code")
  actions.push("ok", "decline", "more")
  return actions
}
