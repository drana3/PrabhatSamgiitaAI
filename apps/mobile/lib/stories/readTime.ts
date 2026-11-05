/** About how fast people read on a phone: 200 words a minute. */
export const WORDS_PER_MINUTE = 200

export function countWords(texts: string | readonly string[]): number {
  const text = typeof texts === "string" ? texts : texts.join(" ")
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Whole minutes to read the text: rounded up, never under one. 0 only when there is no text at all (the
 * length is then unknown, not "one minute").
 */
export function estimateReadMinutes(texts: string | readonly string[], wordsPerMinute = WORDS_PER_MINUTE): number {
  const words = countWords(texts)
  if (words === 0) return 0
  return Math.max(1, Math.ceil(words / wordsPerMinute))
}

/** `4 min read`; empty while the length is not known. */
export function readTimeLabel(minutes: number | null | undefined): string {
  return minutes && minutes > 0 ? `${minutes} min read` : ""
}
