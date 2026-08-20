/** Browser cache for home-page widgets — paint from localStorage, sync DB in background. */

export const HOME_CACHE_TTL = {
  testimonials: 15 * 60_000,
  quizWinners: 10 * 60_000,
  quizStatus: 5 * 60_000,
  today: 30 * 60_000,
} as const

type CacheEnvelope<T> = {
  savedAt: number
  value: T
}

function canUseStorage() {
  return typeof window !== "undefined"
}

export function readHomeCache<T>(key: string, maxAgeMs: number): T | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed || typeof parsed.savedAt !== "number") return null
    if (Date.now() - parsed.savedAt > maxAgeMs) return null
    return parsed.value
  } catch {
    return null
  }
}

/** Return stale cache for instant paint even when TTL expired (background refresh will replace). */
export function readHomeCacheStale<T>(key: string): T | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    return parsed?.value ?? null
  } catch {
    return null
  }
}

export function writeHomeCache<T>(key: string, value: T) {
  if (!canUseStorage()) return
  try {
    const envelope: CacheEnvelope<T> = { savedAt: Date.now(), value }
    window.localStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    /* private mode / quota */
  }
}

export function clearHomeCache(key: string) {
  if (!canUseStorage()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const HOME_CACHE_KEYS = {
  testimonials: "prabhat-home-testimonials-v1",
  quizWinners: "prabhat-home-quiz-winners-v1",
  quizStatus: (memberKey: string) => `prabhat-home-quiz-status-v1:${memberKey}`,
  today: () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
    const date = new Date().toLocaleDateString("en-CA", { timeZone: timezone })
    return `prabhat-home-today-v1:${timezone}:${date}`
  },
} as const
