export type QuizEventOption = {
  id: string
  text: string
}

export type QuizEventQuestion = {
  id: string
  position: number
  prompt: string
  options: QuizEventOption[]
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
  is_open?: boolean
  seconds_remaining?: number
  has_submission?: boolean
  submission_status?: string | null
  score?: number | null
}

export type QuizEventStart = {
  submission_id: string
  event: QuizEventSummary
  questions: QuizEventQuestion[]
  seconds_remaining: number
}

export type QuizEventSubmitResult = {
  submission_id: string
  event: QuizEventSummary
  score: number
  total: number
  pending_verification: boolean
  review: Array<{
    question_id: string
    prompt: string
    is_correct: boolean
    explanation?: string
  }>
}

export type QuizWinner = {
  rank: number
  display_name: string
  score: number
  total: number
}

export type QuizWinnersGroup = {
  event: QuizEventSummary
  winners: QuizWinner[]
}

export function parseQuizEventSlug(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  if (!raw.includes("://")) {
    return raw.replace(/^\/+/, "").replace(/^quiz\/event\//, "")
  }
  try {
    const url = new URL(raw)
    const match = url.pathname.match(/\/quiz\/event\/([^/]+)/)
    if (match?.[1]) return match[1]
    if (url.hostname === "quiz" && url.pathname.startsWith("/event/")) {
      return url.pathname.replace("/event/", "").replace(/^\//, "")
    }
  } catch {
    return null
  }
  return null
}

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}
