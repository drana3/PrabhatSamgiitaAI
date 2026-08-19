import { isLyricCatalogQuery } from "@prabhat/core"

/** Pick search backend mode silently — aligned with web exploreSearchKind.
 * Catalog path (lyrics, numbers, collections) stays unchanged and already fast.
 * Theme chips / devotion-style words are handled separately via precomputed lists.
 */

/** A sentence about feelings or a question — always semantic, never a category chip. */
export function isNaturalLanguageSearch(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (/\?/.test(trimmed)) return true
  const words = trimmed.split(/\s+/).filter(Boolean)
  if (words.length < 3) return false
  return /\b(?:i(?:'m| am)|we are|feel(?:ing)?|help me|recommend|suggest|what|why|how|should i|can you|please|of mind|stress(?:ful|ed)?|anxious|anxiety|tense|worried|overwhelm(?:ed)?)\b/i.test(
    trimmed,
  )
}

export function resolveSearchMode(query: string): "catalog" | "semantic" {
  const trimmed = query.trim()
  if (!trimmed) return "semantic"
  if (/search prabhat samgiita for/i.test(trimmed)) return "catalog"
  if (/^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(trimmed)) return "catalog"
  if (isNaturalLanguageSearch(trimmed)) return "semantic"
  if (isLyricCatalogQuery(trimmed) && trimmed.split(/\s+/).length >= 3) return "catalog"

  // Mood chips and collection chips are served from local lists in search UI.
  if (
    /^(?:(?:songs?(?:\s+(?:of|for|about|on))?)\s+)?(?:devotion(?:al)?|devotees?|bhakti|bhajans?|kirtans?|kiirtan(?:a)?|prayers?|worship|spiritual(?:ity)?|divine|sacred|holy|praise|hymns?|surrender|offering|adoration|reverence|puja|aarti|arati|sadhana|prabhu|ishta|love|loving|nature|meditat(?:e|ion)|morning|dawn|evening|dusk|rain(?:y)?|monsoon|festival(?:s)?|guru|baba|peace(?:ful)?|hindi|urdu|english|sanskrit|shiva|kr(?:ishna|[sś][nń]a)|spring|children|kids|neo[-\s]?humanism)(?:\s+(?:songs?|music|bhajans?|kirtans?))?$/i.test(
      trimmed,
    )
  ) {
    return "catalog"
  }

  const semanticSearchHints =
    /\b(?:about|awakening|bliss|devotion(?:al)?|feel(?:ing)?|festival|guru|help me|hope|joy|love|meaning|meditat(?:ion|e|ing)?|mood|morning|nature|occasion|peace(?:ful)?|rain|recommend|service|spiritual|sorrow|suggest|theme|why)\b/i

  if (semanticSearchHints.test(trimmed) && trimmed.split(/\s+/).length >= 2) return "semantic"
  if (/\b(?:stress(?:ful|ed)?|anxious|anxiety|tense|worried)\b/i.test(trimmed)) return "semantic"
  // Lyric lines and short lookups are much faster with catalog search.
  if (trimmed.split(/\s+/).length <= 8) return "catalog"
  return "semantic"
}

/** Quiet search header — count only, no “searching catalog / semantic” copy. */
export function searchResultsTitle(categoryLabel: string | null, resultCount: number) {
  if (categoryLabel) {
    return resultCount > 0 ? `${categoryLabel} · ${resultCount}` : categoryLabel
  }
  return resultCount > 0 ? `Songs · ${resultCount}` : "Songs"
}
