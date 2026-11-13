import { quotaLabel } from "@/lib/assistantQuota"

/**
 * "N questions left today", from the server's own count (docs/ai-quota-header.md).
 *
 * The server reports the allowance on every answer (`X-RateLimit-*`) and on GET /ai/quota. This file holds
 * what the screen needs from that report and nothing else: no guessing, no limits copied into the app. When
 * the server has not reported (offline, an old server, a failed read) there is no number and no label, so the
 * screen shows nothing rather than an estimate. A report is only good until the server's day ends.
 */
export type ServerQuota = {
  limit: number
  remaining: number
  /** epoch ms when the count starts again (the server's UTC midnight) */
  resetsAt: number
}

/** What the API client hands over: `resetSeconds` is relative to the moment the reply arrived. */
export type QuotaReport = { limit: number; remaining: number; resetSeconds: number }

export function serverQuotaFrom(report: QuotaReport, now: number): ServerQuota {
  return { limit: report.limit, remaining: report.remaining, resetsAt: now + report.resetSeconds * 1000 }
}

/** Questions left, or null when the server has not said (or its day has ended since). */
export function serverQuotaLeft(quota: ServerQuota | undefined, now: number): number | null {
  if (!quota) return null
  if (now >= quota.resetsAt) return null
  return quota.remaining
}

/** The line under the header, or null (nothing is shown) when the number is unknown. */
export function serverQuotaLabel(left: number | null): string | null {
  return left === null ? null : quotaLabel(left)
}
