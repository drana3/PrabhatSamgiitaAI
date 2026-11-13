import { t } from "@/lib/i18n"
import type { LearnQuizQuestion } from "@/lib/learn/quiz"

/** "Right. Bandhu is friend." / "Not quite. Bandhu is friend." (the prototype's feedback line) */
export function quizFeedback(question: LearnQuizQuestion, pickedId: string): string {
  return `${pickedId === question.correctOptionId ? t("learn.quiz.right") : t("learn.quiz.notQuite")} ${question.explanation}`
}
