import type { ProofKind, ProofOut, ProofStatus, RequestState, RequestStage } from "@/lib/authors/types"

/**
 * Proof of identity for claiming recordings (apps/api/app/services/author_proofs.py): one proof per PAGE.
 * Pure helpers, no React: checks of what the person types, and the words the screens pick by stage.
 */

export const PROOF_KINDS: ProofKind[] = ["link", "email", "voice", "team"]

/** Same limits as the server (author_proofs schema): value up to 500 characters, a code of 6 digits. */
export const PROOF_VALUE_MAX = 500
export const CODE_LENGTH = 6

export type ProofProblem = "empty" | "not_a_link" | "not_an_email" | "too_long"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** What is wrong with the text for this kind of proof, or null when it can be sent. */
export function proofProblem(kind: ProofKind, value: string): ProofProblem | null {
  const text = value.trim()
  if (!text) return "empty"
  if (text.length > PROOF_VALUE_MAX) return "too_long"
  if (kind === "link") {
    const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`
    try {
      const host = new URL(withScheme).hostname
      return host.includes(".") && !/\s/.test(text) ? null : "not_a_link"
    } catch {
      return "not_a_link"
    }
  }
  if (kind === "email") return EMAIL.test(text) ? null : "not_an_email"
  return null
}

/** A link written without a scheme gets https:// (what the person meant), the rest is kept as typed. */
export function cleanProofValue(kind: ProofKind, value: string): string {
  const text = value.trim()
  if (kind === "link" && text && !/^https?:\/\//i.test(text)) return `https://${text}`
  return text
}

/** Digits only, at most six: what the code box keeps while the person types or pastes. */
export function cleanCode(text: string): string {
  return text.replace(/\D+/g, "").slice(0, CODE_LENGTH)
}

export function codeReady(text: string): boolean {
  return cleanCode(text).length === CODE_LENGTH
}

/** Whole days from `now` to the date (0 when it is today or past); null without a date. */
export function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.ceil((t - now.getTime()) / 86_400_000))
}

/** The proofs that still count: not withdrawn and not declined. */
export function liveProofs(state: RequestState): ProofOut[] {
  return state.proofs.filter((p) => p.status !== "withdrawn" && p.status !== "declined")
}

/** Which kinds the person may still add: a kind that waits or is accepted is not offered twice. */
export function kindsToOffer(state: RequestState): ProofKind[] {
  const busy = new Set(state.proofs.filter((p) => p.status === "waiting" || p.status === "code_sent" || p.status === "ok").map((p) => p.kind))
  return PROOF_KINDS.filter((k) => !busy.has(k))
}

/** A proof waiting for the person's code: the e-mail one that got its code and is not confirmed yet. */
export function proofNeedingCode(state: RequestState): ProofOut | null {
  return state.proofs.find((p) => p.kind === "email" && p.status === "code_sent" && !p.code_confirmed) ?? null
}

/** The person can send a proof now: nothing verified yet and the request is not waiting on the team alone. */
export function canSendProof(state: RequestState): boolean {
  if (state.verified) return false
  return state.stage === "no_proof" || state.stage === "need_more" || state.stage === "closed" || state.stage === "code" || state.stage === "with_team"
}

export type StageTone = "neutral" | "wait" | "act" | "good" | "bad"

export function stageTone(stage: RequestStage): StageTone {
  switch (stage) {
    case "verified":
      return "good"
    case "with_team":
      return "wait"
    case "code":
    case "need_more":
    case "no_proof":
      return "act"
    case "closed":
      return "bad"
  }
}

export function statusTone(status: ProofStatus): StageTone {
  switch (status) {
    case "ok":
      return "good"
    case "declined":
      return "bad"
    case "more_needed":
    case "code_sent":
      return "act"
    case "waiting":
      return "wait"
    case "withdrawn":
      return "neutral"
  }
}

/** Progress as "have of required", never above the required number. */
export function progress(state: RequestState): { have: number; required: number } {
  return { have: Math.min(state.have, state.required), required: state.required }
}

/** Does the request still need the person to do something (the notification dot and the badge)? */
export function needsPerson(state: RequestState): boolean {
  return state.stage === "code" || state.stage === "need_more"
}

const PROOF_ERRORS = new Set(["code_wrong", "code_expired", "proofs_limit", "proof_invalid"])

/** The sentence key for a failed proof call: the proof codes have their own words, the rest go the usual way. */
export function proofErrorKey(error: unknown, fallback: (error: unknown) => string): string {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : null
  if (typeof code === "string" && PROOF_ERRORS.has(code)) return `claimProof.error.${code}`
  return fallback(error)
}
