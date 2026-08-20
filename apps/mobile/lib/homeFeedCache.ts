import AsyncStorage from "@react-native-async-storage/async-storage"

const PREFIX = "prabhat-home-feed-v1"

export const HOME_FEED_TTL_MS = {
  testimonials: 15 * 60_000,
  quizWinners: 10 * 60_000,
  quizStatus: 5 * 60_000,
} as const

type Envelope<T> = { savedAt: number; value: T }

async function readEnvelope<T>(key: string): Promise<Envelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as Envelope<T>
  } catch {
    return null
  }
}

export async function readHomeFeedCache<T>(key: string, maxAgeMs: number): Promise<T | null> {
  const envelope = await readEnvelope<T>(key)
  if (!envelope) return null
  if (Date.now() - envelope.savedAt > maxAgeMs) return null
  return envelope.value
}

export async function readHomeFeedCacheStale<T>(key: string): Promise<T | null> {
  const envelope = await readEnvelope<T>(key)
  return envelope?.value ?? null
}

export async function writeHomeFeedCache<T>(key: string, value: T) {
  try {
    const envelope: Envelope<T> = { savedAt: Date.now(), value }
    await AsyncStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    /* ignore */
  }
}

export const HOME_FEED_KEYS = {
  testimonials: `${PREFIX}:testimonials`,
  quizWinners: `${PREFIX}:quiz-winners`,
  quizStatus: `${PREFIX}:quiz-status`,
} as const
