/** Official English theme labels glued into Roman lyrics on some early songs. */

const SONG_OF = /^song\s+of\b/i
const DIACRITIC =
  /[ÁáÀàÂâÃãÄäÅåĀāĂăǍǎĆćČčḌḍÉéÈèÊêËëĒēĚěÍíÌìÎîÏïĪīǏǐŃńÑñṆṇÓóÒòÔôÖöÕõŌōŎŏǑǒṚṛṜṝŚśṢṣṬṭÚúÙùÛûÜüŪūŬŭǓǔÝýŸÿŹźŽžḾḿ]/
const LATIN_LINE = /^[A-Za-z0-9 ,.'’\-:/!?]+$/

export function isEnglishThemeLine(line: string): boolean {
  const text = line.trim()
  if (!text || text.length > 80) return false
  if (DIACRITIC.test(text)) return false
  if (!LATIN_LINE.test(text)) return false
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 10) return false
  return SONG_OF.test(text)
}

export function formatThemeLabel(raw: string): string {
  const small = new Set(["of", "the", "and", "a", "an", "to", "in", "for", "with"])
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && small.has(lower)) return lower
      if (word === word.toUpperCase() || word === word.toLowerCase()) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }
      return word
    })
    .join(" ")
}

/** Peel trailing English theme from Roman lyrics. */
export function extractTrailingEnglishTheme(lyrics: string | null | undefined): {
  lyrics: string
  theme: string | null
} {
  if (!lyrics) return { lyrics: "", theme: null }
  const endsWithNewline = lyrics.endsWith("\n")
  const lines = lyrics.split("\n")
  let end = lines.length
  while (end > 0 && lines[end - 1]!.trim() === "") end -= 1
  if (end === 0) return { lyrics, theme: null }
  const candidate = lines[end - 1]!
  if (!isEnglishThemeLine(candidate)) return { lyrics, theme: null }
  const theme = formatThemeLabel(candidate)
  const kept = lines.slice(0, end - 1)
  while (kept.length && kept[kept.length - 1]!.trim() === "") kept.pop()
  let cleaned = kept.join("\n")
  if (endsWithNewline && cleaned) cleaned += "\n"
  return { lyrics: cleaned, theme: theme || null }
}

export function dropLastNonemptyLine(text: string | null | undefined): string {
  if (!text) return ""
  const endsWithNewline = text.endsWith("\n")
  const lines = text.split("\n")
  let end = lines.length
  while (end > 0 && lines[end - 1]!.trim() === "") end -= 1
  if (end === 0) return text
  const kept = lines.slice(0, end - 1)
  while (kept.length && kept[kept.length - 1]!.trim() === "") kept.pop()
  let cleaned = kept.join("\n")
  if (endsWithNewline && cleaned) cleaned += "\n"
  return cleaned
}

/** Rule-converted leftovers of ``SONG OF …`` (e.g. ``सोन्ग् ओफ़् फ़ुल्फ़िल्ल्मेन्त्``). */
const CONVERTED_SONG_OF = /(सोन्ग्|सोंग्|सोङ्ग्|सॉन्ग्)\s*(ओफ़्|ओफ्|अव्|ऑफ़्)/

export function looksLikeConvertedThemeLine(line: string | null | undefined): boolean {
  const text = (line || "").trim()
  if (!text || text.length > 80) return false
  if (CONVERTED_SONG_OF.test(text)) return true
  return isEnglishThemeLine(text)
}

/**
 * Drop a trailing theme line that was rule-converted into Devanagari.
 * Strips when the last line looks like converted ``Song of …``, or when a theme
 * is known and Devanagari has exactly one more non-empty line than cleaned Roman.
 */
export function stripTrailingThemeFromDevanagari(
  roman: string | null | undefined,
  devanagari: string | null | undefined,
  knownTheme?: string | null,
): string | null {
  const raw = (devanagari || "").trim()
  if (!raw) return null
  const { lyrics: cleanedRoman, theme: peeled } = extractTrailingEnglishTheme(roman)
  const themeHint = peeled || (knownTheme || "").trim() || null
  const last = [...raw.split("\n")].reverse().find((ln) => ln.trim()) || ""
  if (looksLikeConvertedThemeLine(last)) {
    return dropLastNonemptyLine(raw).trim() || null
  }
  if (!themeHint) return raw
  const romanN = cleanedRoman.split("\n").filter((ln) => ln.trim()).length
  const devN = raw.split("\n").filter((ln) => ln.trim()).length
  if (romanN && devN === romanN + 1) {
    return dropLastNonemptyLine(raw).trim() || null
  }
  return raw
}
