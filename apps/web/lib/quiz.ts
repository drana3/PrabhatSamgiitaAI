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

export async function fetchQuizStatus(): Promise<QuizStatus | null> {
  const response = await fetch("/api/member/quiz/status", { credentials: "same-origin", cache: "no-store" })
  if (!response.ok) return null
  return await response.json() as QuizStatus
}

export async function startQuiz(level: QuizLevel): Promise<QuizStart | null> {
  const response = await fetch("/api/member/quiz/start", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ level }),
  })
  if (!response.ok) return null
  return await response.json() as QuizStart
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
  return await response.json() as QuizSubmitResult
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
