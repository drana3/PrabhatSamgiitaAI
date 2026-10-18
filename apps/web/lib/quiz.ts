import {
  HOME_CACHE_KEYS,
  HOME_CACHE_TTL,
  clearHomeCache,
  readHomeCache,
  readHomeCacheStale,
  writeHomeCache,
} from "@/lib/home-cache"

export type QuizLevel = "starter" | "intermediate" | "experienced"

export type QuizCertification = {
  level: QuizLevel
  label: string
  certificate_code: string
  earned_at: string
}

export type QuizStatus = {
  levels: Array<{ level: QuizLevel; label: string; question_pool_size: number }>
  questions_per_quiz: number
  pass_percent: number
  pass_score: number
  certifications: QuizCertification[]
}

export type QuizQuestion = {
  id: string
  prompt: string
  options: Array<{ id: string; text: string }>
}

export type QuizStart = {
  attempt_id: string
  level: QuizLevel
  level_label: string
  questions_per_quiz: number
  pass_score: number
  questions: QuizQuestion[]
}

export type QuizReviewItem = {
  question_id: string
  prompt: string
  options: Array<{ id: string; text: string }>
  selected_option_id: string | null
  correct_option_id: string
  is_correct: boolean
  explanation: string
}

export type QuizSubmitResult = {
  attempt_id: string
  level: QuizLevel
  level_label: string
  score: number
  total: number
  pass_score: number
  passed: boolean
  review: QuizReviewItem[]
  certification: QuizCertification | null
  newly_earned: boolean
}

function quizStatusCacheKey(memberKey = "self") {
  return HOME_CACHE_KEYS.quizStatus(memberKey)
}

/** Instant paint from cache (may be slightly stale). */
export function readCachedQuizStatus(memberKey = "self"): QuizStatus | null {
  return (
    readHomeCache<QuizStatus>(quizStatusCacheKey(memberKey), HOME_CACHE_TTL.quizStatus) ??
    readHomeCacheStale<QuizStatus>(quizStatusCacheKey(memberKey))
  )
}

export async function fetchQuizStatus(options?: {
  memberKey?: string
  bypassCache?: boolean
}): Promise<QuizStatus | null> {
  const memberKey = options?.memberKey ?? "self"
  const cacheKey = quizStatusCacheKey(memberKey)
  if (!options?.bypassCache) {
    const fresh = readHomeCache<QuizStatus>(cacheKey, HOME_CACHE_TTL.quizStatus)
    if (fresh) return fresh
    const stale = readHomeCacheStale<QuizStatus>(cacheKey)
    if (stale) {
      void refreshQuizStatus(cacheKey)
      return stale
    }
  }
  return refreshQuizStatus(cacheKey)
}

async function refreshQuizStatus(cacheKey: string): Promise<QuizStatus | null> {
  try {
    const response = await fetch("/api/member/quiz/status", {
      credentials: "same-origin",
      cache: "no-store",
    })
    if (!response.ok) return readHomeCacheStale<QuizStatus>(cacheKey)
    const status = (await response.json()) as QuizStatus
    writeHomeCache(cacheKey, status)
    return status
  } catch {
    return readHomeCacheStale<QuizStatus>(cacheKey)
  }
}

export async function startQuiz(level: QuizLevel): Promise<QuizStart | null> {
  const response = await fetch("/api/member/quiz/start", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level }),
  })
  if (!response.ok) return null
  return (await response.json()) as QuizStart
}

export async function submitQuiz(payload: {
  attempt_id: string
  answers: Array<{ question_id: string; selected_option_id: string }>
}): Promise<QuizSubmitResult | null> {
  const response = await fetch("/api/member/quiz/submit", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) return null
  const result = (await response.json()) as QuizSubmitResult
  clearHomeCache(quizStatusCacheKey())
  return result
}

export const QUIZ_LEVEL_COPY: Record<QuizLevel, { title: string; description: string }> = {
  starter: {
    title: "Starter",
    description: "Basics of Prabhat Samgiita, the app, and daily practice.",
  },
  intermediate: {
    title: "Intermediate",
    description: "Stories, AI companion features, sources, and member journey.",
  },
  experienced: {
    title: "Experienced",
    description: "Deeper context from devotee stories, recommendations, and app design.",
  },
}
