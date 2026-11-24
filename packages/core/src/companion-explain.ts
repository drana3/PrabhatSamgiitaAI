/** Questions that should search all 5,018 songs, not only the song on screen. */
export function prefersCatalogCompanion(prompt: string): boolean {
  const text = (prompt || "").trim()
  if (!text) return false
  if (/\b(this song|the song|explain this|meaning of this|line by line)\b/i.test(text)) {
    return false
  }
  if (/\b(?:related|similar|songs?\s+like|another\s+song|other\s+songs?)\b/i.test(text)) {
    return false
  }
  return /\b(?:suggest|morning|evening|peace|calm|meditation|devotion|recommend|which song|what song|tell me about|prabhat samgiita|festival|theme|how many|who composed|what is prabhat|pick a song|choose a song|find me a song|any song|good song|general question)\b/i.test(
    text,
  )
}

/**
 * Prefer an explicit PS number in the prompt; else the active song for song-focused chat;
 * else catalog-wide (null) for browse / recommendation questions across the full catalog.
 */
export function resolveExplainSongNumber(
  prompt: string,
  currentSongNumber?: number | null,
): number | null {
  const match = prompt.match(
    /\b(?:song|ps|prabhat\s+(?:samgiita|sangeet))\s*(?:number|no\.?|#)?\s*(\d{1,4})\b/i,
  )
  if (match) {
    const number = Number(match[1])
    if (number >= 1 && number <= 5018) return number
  }
  if (/^\d{1,4}$/.test(prompt.trim())) {
    const number = Number(prompt.trim())
    if (number >= 1 && number <= 5018) return number
  }
  if (prefersCatalogCompanion(prompt)) return null
  if (currentSongNumber != null && currentSongNumber >= 1 && currentSongNumber <= 5018) {
    return currentSongNumber
  }
  return null
}