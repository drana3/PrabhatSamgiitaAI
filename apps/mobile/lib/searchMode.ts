/** Pick search backend mode silently — aligned with web exploreSearchKind.
 * Catalog path (lyrics, numbers, collections) stays unchanged and already fast.
 * Theme chips / devotion-style words are handled separately via precomputed lists.
 */
export function resolveSearchMode(query: string): "catalog" | "semantic" {
  const trimmed = query.trim()
  if (!trimmed) return "semantic"
  if (/search prabhat samgiita for/i.test(trimmed)) return "catalog"
  if (/^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(trimmed)) return "catalog"

  // Single-word theme chips are served from local precompute in search UI —
  // still label as catalog for messaging (no semantic round-trip).
  if (
    /^(?:(?:songs?(?:\s+(?:of|for|about|on))?)\s+)?(?:devotion(?:al)?|devotees?|bhakti|bhajans?|kirtans?|kiirtan(?:a)?|prayers?|worship|spiritual(?:ity)?|divine|sacred|holy|praise|hymns?|surrender|offering|adoration|reverence|puja|aarti|arati|sadhana|prabhu|ishta|love|loving|nature|meditat(?:e|ion)|morning|dawn|evening|dusk|rain(?:y)?|monsoon|festival(?:s)?|guru|baba|peace(?:ful)?)(?:\s+(?:songs?|music|bhajans?|kirtans?))?$/i.test(
      trimmed,
    )
  ) {
    return "catalog"
  }

  const semanticSearchHints =
    /\b(?:about|awakening|bliss|devotion(?:al)?|feel(?:ing)?|festival|guru|help me|hope|joy|love|meaning|meditat(?:ion|e|ing)?|mood|morning|nature|occasion|peace(?:ful)?|rain|recommend|service|spiritual|sorrow|suggest|theme|why)\b/i

  if (semanticSearchHints.test(trimmed)) return "semantic"
  // Lyric lines and short lookups are much faster with catalog search.
  if (trimmed.split(/\s+/).length <= 8) return "catalog"
  return "semantic"
}
