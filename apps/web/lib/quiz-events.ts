import {
  HOME_CACHE_KEYS,
  HOME_CACHE_TTL,
  readHomeCache,
  readHomeCacheStale,
  writeHomeCache,
} from "@/lib/home-cache"

export type QuizEventOption = {
  id: string
  text: string
}

export type QuizEventQuestion = {
  prompt: string
  options: QuizEventOption[]
  correct_option_id: string
  explanation?: string
}

export type QuizEventSummary = {
  id: string
  slug: string
  title: string
  description?: string | null
  deadline: string
  tags: string[]
  status: string
  deep_link: string
  created_at: string
}

export type QuizEventWinner = {
  rank: number
  display_name: string
  score: number
  total: number
  submitted_at?: string | null
}

export type QuizWinnersGroup = {
  event: QuizEventSummary
  winners: QuizEventWinner[]
}

export function emptyQuestion(position: number): QuizEventQuestion {
  return {
    prompt: "",
    options: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ],
    correct_option_id: "a",
    explanation: "",
  }
}

export function qrCodeUrl(deepLink: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(deepLink)}`
}

export function readCachedQuizWinners(): QuizWinnersGroup[] {
  return readHomeCacheStale<QuizWinnersGroup[]>(HOME_CACHE_KEYS.quizWinners) ?? []
}

export async function fetchQuizWinners(options?: { bypassCache?: boolean }): Promise<QuizWinnersGroup[]> {
  const key = HOME_CACHE_KEYS.quizWinners
  if (!options?.bypassCache) {
    const fresh = readHomeCache<QuizWinnersGroup[]>(key, HOME_CACHE_TTL.quizWinners)
    if (fresh?.length) return fresh
    const stale = readHomeCacheStale<QuizWinnersGroup[]>(key)
    if (stale?.length) {
      void refreshQuizWinners(key)
      return stale
    }
  }
  return refreshQuizWinners(key)
}

async function refreshQuizWinners(cacheKey: string): Promise<QuizWinnersGroup[]> {
  try {
    const response = await fetch("/api/quiz/winners", { cache: "no-store" })
    if (!response.ok) return readHomeCacheStale<QuizWinnersGroup[]>(cacheKey) ?? []
    const groups = (await response.json()) as QuizWinnersGroup[]
    if (Array.isArray(groups)) writeHomeCache(cacheKey, groups)
    return Array.isArray(groups) ? groups : []
  } catch {
    return readHomeCacheStale<QuizWinnersGroup[]>(cacheKey) ?? []
  }
}
