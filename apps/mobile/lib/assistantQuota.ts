import {
  AI_COMPANION_GUEST_DAILY_LIMIT,
  AI_COMPANION_MEMBER_DAILY_LIMIT,
} from "@/lib/chat"

/**
 * "N questions left today" (spec SCR-13/SCR-14).
 *
 * The server enforces the limit and exposes no counter, so the app keeps its own
 * tally per account for the current UTC day (the server also counts per UTC day).
 * It counts every answered question, but the server charges only deeper ones, so
 * the number shown is a safe lower bound. When the server says the limit is
 * reached, that wins and the tally is pinned to zero for the day.
 */
export type QuotaState = {
  /** UTC date, YYYY-MM-DD */
  day: string
  used: number
  exhausted: boolean
}

export function quotaDayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function freshQuota(now: Date): QuotaState {
  return { day: quotaDayKey(now), used: 0, exhausted: false }
}

/** A tally from an earlier day counts as empty. */
export function currentQuota(state: QuotaState | undefined, now: Date): QuotaState {
  if (!state || state.day !== quotaDayKey(now)) return freshQuota(now)
  return state
}

export function recordQuestion(state: QuotaState | undefined, now: Date): QuotaState {
  const current = currentQuota(state, now)
  return { ...current, used: current.used + 1 }
}

export function markQuotaExhausted(state: QuotaState | undefined, now: Date): QuotaState {
  return { ...currentQuota(state, now), exhausted: true }
}

export function dailyLimit(isMember: boolean): number {
  return isMember ? AI_COMPANION_MEMBER_DAILY_LIMIT : AI_COMPANION_GUEST_DAILY_LIMIT
}

export function questionsLeft(state: QuotaState | undefined, limit: number, now: Date): number {
  const current = currentQuota(state, now)
  if (current.exhausted) return 0
  return Math.max(limit - current.used, 0)
}

export function quotaLabel(left: number): string {
  if (left <= 0) return "No questions left today"
  if (left === 1) return "1 question left today"
  return `${left} questions left today`
}

/** Plain next step once the limit is reached. */
export function quotaHelp(isMember: boolean): string {
  return isMember
    ? "Come back tomorrow. Lyrics, meanings and recordings are still here."
    : "Sign in for more questions each day, or come back tomorrow."
}
