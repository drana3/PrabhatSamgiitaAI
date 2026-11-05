import type { WordCard } from "@/lib/learn/srs"

/** The learning streak: days in a row with at least one word review. Derived from the card histories. */
export type LearningStreak = {
  /** days in a row, counted back from today (or from yesterday while today is still open) */
  days: number
  /** true when a word was reviewed today */
  reviewedToday: boolean
}

function dayNumber(ms: number): number {
  const d = new Date(ms)
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

export function learningStreak(cards: Readonly<Record<string, WordCard>>, now: number): LearningStreak {
  const days = new Set<number>()
  for (const card of Object.values(cards)) {
    for (const entry of card.history) if (entry.at <= now) days.add(dayNumber(entry.at))
  }
  const today = dayNumber(now)
  const reviewedToday = days.has(today)
  // while today is still open, a streak that reached yesterday is alive
  let cursor = reviewedToday ? today : today - 1
  let count = 0
  while (days.has(cursor)) {
    count += 1
    cursor -= 1
  }
  return { days: count, reviewedToday }
}
