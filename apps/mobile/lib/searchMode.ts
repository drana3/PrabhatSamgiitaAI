/** Pick search backend mode silently — aligned with web exploreSearchKind. */
export function resolveSearchMode(query: string): "catalog" | "semantic" {
  const trimmed = query.trim()
  if (!trimmed) return "semantic"
  if (/search prabhat samgiita for/i.test(trimmed)) return "catalog"
  if (/^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(trimmed)) return "catalog"

  const semanticSearchHints =
    /\b(?:about|awakening|bliss|devotion|feel(?:ing)?|festival|help me|hope|joy|meaning|meditat|mood|morning|nature|occasion|peace|rain|recommend|service|spiritual|sorrow|suggest|theme|why)\b/i

  if (semanticSearchHints.test(trimmed)) return "semantic"
  // Lyric lines and short lookups are much faster with catalog search.
  if (trimmed.split(/\s+/).length <= 8) return "catalog"
  return "semantic"
}
