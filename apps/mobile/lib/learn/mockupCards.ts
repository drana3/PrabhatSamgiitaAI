import type { Grade, QueueCounts, QueueKind, ReviewStyle } from "@/lib/learn/srs"

/**
 * Preview-only card logic (EXPO_PUBLIC_MOCKUP_DATA=1). The prototype's flashcards do not run
 * a scheduler: the deck is the first ten words in song order, the last two are "Due" cards,
 * the rest are "New", and a card answered Again or Hard turns into a "Learning" card. The
 * button times are fixed labels per review style. Mirrors Main.dc.html (`fcRev`, `srsIv`).
 */

export type MockGrades = Readonly<Record<string, Grade | undefined>>

/** The prototype treats the last two cards of the deck as review cards. */
export function mockIsReview(index: number, deckSize: number): boolean {
  return index >= deckSize - 2
}

export function mockKind(wordId: string, deckIds: readonly string[], grades: MockGrades): QueueKind {
  const grade = grades[wordId]
  if (grade === "again" || grade === "hard") return "learning"
  return mockIsReview(deckIds.indexOf(wordId), deckIds.length) ? "due" : "new"
}

export function mockCounts(queue: readonly string[], deckIds: readonly string[], grades: MockGrades): QueueCounts {
  const counts: QueueCounts = { newCount: 0, learningCount: 0, dueCount: 0 }
  for (const id of queue) {
    const kind = mockKind(id, deckIds, grades)
    if (kind === "new") counts.newCount += 1
    else if (kind === "learning") counts.learningCount += 1
    else counts.dueCount += 1
  }
  return counts
}

/** The four button times, in the order Again, Hard, Good, Easy. */
export function mockIntervals(style: ReviewStyle, review: boolean, learning: boolean): Record<Grade, string> {
  const pick = (row: readonly [string, string, string, string]): Record<Grade, string> => ({
    again: row[0],
    hard: row[1],
    good: row[2],
    easy: row[3],
  })
  if (style === "daily") return pick(review ? ["<10m", "1d", "1d", "7d"] : ["<1m", "10m", "1d", "3d"])
  if (style === "adaptive") {
    if (review) return pick(["<10m", "2d", "4d", "7d"])
    return pick(learning ? ["<1m", "8m", "15m", "4d"] : ["<1m", "6m", "10m", "4d"])
  }
  return pick(review ? ["<10m", "3d", "7d", "14d"] : ["<1m", "10m", "1d", "3d"])
}
