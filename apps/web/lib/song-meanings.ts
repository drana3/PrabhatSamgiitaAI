export type SongMeaningSource = {
  english_meaning?: string | null
  hindi_meaning?: string | null
  central_idea?: string | null
  language?: string | null
  lyrics_original?: string | null
  first_line?: string | null
  title?: string | null
  metadata_json?: Record<string, unknown> | null
}

/** Collapse punctuation/case for near-duplicate checks (Latin + Devanagari). */
export function proseFingerprint(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u0900-\u097F]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Dice coefficient on character bigrams — true near-duplicates score high. */
export function proseSimilarity(left: string, right: string): number {
  const a = proseFingerprint(left)
  const b = proseFingerprint(right)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const counts = (s: string) => {
    const map = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const gram = s.slice(i, i + 2)
      map.set(gram, (map.get(gram) || 0) + 1)
    }
    return map
  }
  const aGrams = counts(a)
  const bGrams = counts(b)
  let overlap = 0
  for (const [gram, count] of aGrams) {
    overlap += Math.min(count, bGrams.get(gram) || 0)
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1))
}

/** True when prose is the same meaning restated — not merely similar length. */
export function isNearDuplicateProse(
  left: string | null | undefined,
  right: string | null | undefined,
  threshold = 0.88,
): boolean {
  if (!left?.trim() || !right?.trim()) return false
  return proseSimilarity(left, right) >= threshold
}

/** Unwrap HTML soft line-wraps; collapse bogus one-line "paragraphs" from translators. */
export function normalizeProseBlock(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[ \t]*\n[ \t]*/g, " ").replace(/ {2,}/g, " ").trim())
    .filter(Boolean)
  if (!paragraphs.length) return ""
  if (paragraphs.length >= 4) {
    const short = paragraphs.filter((part) => part.length < 90).length
    if (short / paragraphs.length >= 0.7) {
      return paragraphs.join(" ").replace(/ {2,}/g, " ").trim()
    }
  }
  return paragraphs.join("\n\n")
}

/** Official Central idea / Purport prose when present. */
export function centralIdeaText(song: SongMeaningSource): string {
  const direct = song.central_idea?.trim()
  if (direct) return normalizeProseBlock(direct)
  const purport = song.metadata_json?.purport
  return typeof purport === "string" && purport.trim()
    ? normalizeProseBlock(purport)
    : ""
}

export function isEnglishSongLanguage(value?: string | null) {
  const token = value?.trim().toLowerCase() ?? ""
  return token.includes("english") || token === "en" || token === "eng"
}

/** English songs often store the poem in lyrics, not english_meaning. */
export function englishMeaningText(song: SongMeaningSource) {
  const curated = song.english_meaning?.trim()
  if (curated) return curated
  if (!isEnglishSongLanguage(song.language)) return ""
  return song.lyrics_original?.trim() || song.first_line?.trim() || song.title?.trim() || ""
}

export function collectStoredMeanings(song: SongMeaningSource): Record<string, string> {
  const meanings: Record<string, string> = {}
  const english = englishMeaningText(song)
  const hindi = song.hindi_meaning?.trim()
  if (english) meanings.en = normalizeProseBlock(english)
  if (hindi) meanings.hi = normalizeProseBlock(hindi)
  const localized = (song.metadata_json?.localized_meanings ?? {}) as Record<string, unknown>
  for (const [code, text] of Object.entries(localized)) {
    if (typeof text === "string" && text.trim()) {
      meanings[code.toLowerCase()] = normalizeProseBlock(text)
    }
  }
  return meanings
}

export function storedMeaningForLanguage(song: SongMeaningSource, language: string): string | null {
  return collectStoredMeanings(song)[language.toLowerCase()] ?? null
}

export function hasStoredMeaningForLanguage(song: SongMeaningSource, language: string): boolean {
  return Boolean(storedMeaningForLanguage(song, language))
}

/** Cached Central idea translation / LLM summary from metadata_json.localized_explanations. */
export function storedExplanationForLanguage(
  song: SongMeaningSource,
  language: string,
): string | null {
  const code = language.trim().toLowerCase()
  if (!code) return null
  const explanations = song.metadata_json?.localized_explanations
  if (!explanations || typeof explanations !== "object") return null
  const value = (explanations as Record<string, unknown>)[code]
  if (typeof value !== "string" || !value.trim()) return null
  const prose = normalizeProseBlock(value)
  if (!prose) return null
  // Reject official English Central idea echoes and true meaning mirrors.
  const official = centralIdeaText(song)
  if (official && prose === official) return null
  const meaning = englishMeaningText(song)
  const hindi = song.hindi_meaning?.trim() ? normalizeProseBlock(song.hindi_meaning) : ""
  for (const raw of [meaning, hindi]) {
    if (raw && isNearDuplicateProse(prose, raw, 0.95)) return null
  }
  return prose
}
