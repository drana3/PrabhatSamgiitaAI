export type QuizReviewOption = {
  id: string
  text: string
}

export type QuizReviewShape = {
  question_id: string
  prompt: string
  options: QuizReviewOption[]
  selected_option_id?: string | null
  correct_option_id: string
  is_correct: boolean
  explanation?: string | null
}

export function quizOptionText(
  options: QuizReviewOption[],
  optionId: string | null | undefined,
): string {
  if (!optionId) return "Not answered"
  return options.find((item) => item.id === optionId)?.text ?? "Not answered"
}