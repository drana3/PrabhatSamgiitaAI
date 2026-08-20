/** Locale for catalog / lyric voice search — must yield Romanized text. */
export const VOICE_SEARCH_LANG = "en-IN"

/**
 * Web Speech / native STT locale for Prabhat Samgiita search.
 * Device locale (often en-US) mis-hears Romanized Bengali/Hindi lyrics.
 * en-IN is trained on Indian English + code-mixed speech and returns Latin script
 * that matches our lyric index. Native-script locales (hi-IN, bn-IN) are avoided
 * for search because Devanagari/Bengali transcripts do not match the Roman index.
 */
export function resolveVoiceSearchLang(_navigatorLanguage?: string | null): string {
  return VOICE_SEARCH_LANG
}

export function normalizeVoiceTranscript(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
}

function latinRatio(value: string) {
  const letters = value.replace(/[^a-zA-Z\u00C0-\u024F]/g, "")
  if (!letters.length) return 0
  const latin = letters.replace(/[^a-zA-Z]/g, "").length
  return latin / letters.length
}

/** Prefer a Romanized alternative that looks like searchable lyrics. */
export function pickVoiceTranscript(primary: string, alternatives: string[] = []): string {
  const candidates = [primary, ...alternatives]
    .map(normalizeVoiceTranscript)
    .filter(Boolean)
  if (candidates.length <= 1) return candidates[0] ?? ""

  return [...candidates].sort((left, right) => {
    const ratioDelta = latinRatio(right) - latinRatio(left)
    if (Math.abs(ratioDelta) > 0.05) return ratioDelta
    // Prefer slightly longer lyric-like phrases over a single misheard word.
    return right.split(/\s+/).length - left.split(/\s+/).length
  })[0]!
}
