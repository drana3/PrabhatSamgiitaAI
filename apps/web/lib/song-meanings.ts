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
  // Reject official English Central idea echoes and meaning mirrors.
  const official = centralIdeaText(song)
  if (official && prose === official) return null
  const meaning = englishMeaningText(song)
  const hindi = song.hindi_meaning?.trim() ? normalizeProseBlock(song.hindi_meaning) : ""
  const fingerprint = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\u0900-\u097F]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  const explFp = fingerprint(prose)
  for (const raw of [meaning, hindi]) {
    if (!raw) continue
    const other = fingerprint(normalizeProseBlock(raw))
    if (!other) continue
    if (explFp === other) return null
    const shorter = explFp.length <= other.length ? explFp : other
    const longer = explFp.length <= other.length ? other : explFp
    if (longer.length >= 80 && shorter.length / longer.length >= 0.82) return null
  }
  return prose
}
