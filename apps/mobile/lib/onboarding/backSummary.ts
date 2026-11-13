/**
 * What "Your songs are back" counts: the saved songs and Kiirtans, the playlists and the words that wait for a
 * review today. Pure, so it is tested. A person with nothing yet gets a plain sentence instead of three zeros.
 */

export type BackCounts = { saved: number; playlists: number; words: number }

/** Cards that are not new and come due before the end of today (the same rule as the Learn queue). */
export function wordsToReview(cards: Readonly<Record<string, { status: string; dueAt: number }>>, now: number): number {
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  const limit = end.getTime()
  let count = 0
  for (const id of Object.keys(cards)) {
    const card = cards[id]!
    if (card.status !== "new" && card.dueAt <= limit) count += 1
  }
  return count
}

export function hasAnything(counts: BackCounts): boolean {
  return counts.saved + counts.playlists + counts.words > 0
}
