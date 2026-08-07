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

export async function fetchQuizWinners(): Promise<QuizWinnersGroup[]> {
  try {
    const response = await fetch("/api/quiz/winners", { cache: "no-store" })
    if (!response.ok) return []
    return (await response.json()) as QuizWinnersGroup[]
  } catch {
    return []
  }
}
