/**
 * The server's own count of today's AI questions, as the API reports it (docs/ai-quota-header.md).
 *
 * `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (seconds until the count starts
 * again, at UTC midnight) come on every /ai/explain reply, and GET /ai/quota returns the same numbers
 * without asking a question. Anything that does not parse is "not reported": callers show nothing then.
 */
export type DailyQuota = {
  limit: number
  remaining: number
  /** whole seconds until the count starts again */
  resetSeconds: number
}

function wholeNumber(value: string | null | undefined): number | null {
  if (value == null) return null
  const text = value.trim()
  if (!/^\d{1,9}$/.test(text)) return null
  return Number(text)
}

/** A header reader: `response.headers` of fetch, or anything with a `get(name)`. */
export type HeaderReader = { get?: (name: string) => string | null } | null | undefined

export function readDailyQuota(headers: HeaderReader): DailyQuota | null {
  const get = headers?.get
  if (typeof get !== "function") return null
  const read = (name: string) => get.call(headers, name)
  const limit = wholeNumber(read("x-ratelimit-limit"))
  const remaining = wholeNumber(read("x-ratelimit-remaining"))
  const resetSeconds = wholeNumber(read("x-ratelimit-reset"))
  if (limit === null || remaining === null || resetSeconds === null) return null
  if (limit < 1 || remaining > limit) return null
  return { limit, remaining, resetSeconds }
}

/** The JSON of GET /ai/quota, checked the same way. */
export function parseDailyQuotaBody(body: unknown): DailyQuota | null {
  if (!body || typeof body !== "object") return null
  const { limit, remaining, resets_in_seconds: reset } = body as Record<string, unknown>
  const whole = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0
  if (!whole(limit) || !whole(remaining) || !whole(reset)) return null
  if (limit < 1 || remaining > limit) return null
  return { limit, remaining, resetSeconds: reset }
}
