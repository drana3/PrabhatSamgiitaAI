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
