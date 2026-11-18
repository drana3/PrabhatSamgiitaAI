/**
 * Plain lyrics of the Player: the lines of a song and, when there is one, a translation per line.
 * The catalogue has no reliable line or word timing, so nothing here follows the song in time.
 */
export type LyricLine = { text: string; translation?: string }

export function splitLines(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Some catalog lyrics are stored in capitals. The design shows them as sentence case
 * ("Bandhu he niye calo"), so a line that is entirely capitals is lowered, keeping the
 * first letter. Lines with any lower-case letter, and scripts without case, are untouched.
 */
export function sentenceCaseLine(line: string): string {
  const letters = line.match(/\p{L}/gu)
  if (!letters || letters.length < 3) return line
  if (line !== line.toUpperCase() || line === line.toLowerCase()) return line
  const lower = line.toLowerCase()
  const first = lower.search(/\p{L}/u)
  return first < 0 ? lower : lower.slice(0, first) + lower.charAt(first).toUpperCase() + lower.slice(first + 1)
}

export function splitWords(line: string): string[] {
  return line.split(/\s+/).filter(Boolean)
}

/** One translation line per lyric line, or null when they do not line up. */
export function alignTranslation(lines: string[], translation: string | null | undefined): string[] | null {
  const translated = splitLines(translation)
  return translated.length === lines.length && lines.length > 0 ? translated : null
}

export function buildLyricLines(script: string[], translations: string[] | null): LyricLine[] {
  return script.map((text, i) => ({ text, translation: translations?.[i] }))
}
