/**
 * Line-by-line pairing of the lyrics with a translation, for variant A ("Pairs").
 *
 * A translation is paired with the lyric lines only when (1) it has exactly as many non-empty lines as
 * the lyrics and (2) every one of its lines stands on its own: starts like a sentence and ends with
 * a full stop, a question or exclamation mark, a colon, a semicolon or a closing quote or bracket. The
 * second rule exists because the first alone proved nothing: in the real catalogue the English lines
 * are broken where the official page wraps ("In Your name, / in Your song / I have lost myself."), and
 * the few songs whose counts happen to match (PS 33, 42, 52, 58 of the first 80) are shifted against the
 * lyrics. Anything else is NOT paired; the page falls back to the stacked layout and says so. Nothing is
 * ever split, merged or padded to make it fit.
 */

export type AlignResult =
  | { kind: "pairs"; pairs: ReadonlyArray<{ readonly line: string; readonly meaning: string }> }
  | { kind: "stacked"; reason: "no-lyrics" | "no-meaning" | "count-differs" | "runs-on"; lyricCount: number; meaningCount: number }

/** The non-empty, trimmed lines of a translation text. */
export function meaningLines(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** A line that begins and ends like a sentence of its own (a fragment that runs on into the next line does not). */
export function standsAlone(line: string): boolean {
  return /^["\u201C\u2018'(\[]?[\p{Lu}\d]/u.test(line) && /[.!?:;\u2026]["\u201D\u2019')\]]?$/.test(line)
}

export function alignLines(lyricLines: readonly string[], meaningText: string | null | undefined): AlignResult {
  const lyrics = lyricLines.map((line) => line.trim()).filter(Boolean)
  const meaning = meaningLines(meaningText)
  if (!lyrics.length) return { kind: "stacked", reason: "no-lyrics", lyricCount: 0, meaningCount: meaning.length }
  if (!meaning.length) return { kind: "stacked", reason: "no-meaning", lyricCount: lyrics.length, meaningCount: 0 }
  if (lyrics.length !== meaning.length) {
    return { kind: "stacked", reason: "count-differs", lyricCount: lyrics.length, meaningCount: meaning.length }
  }
  if (!meaning.every(standsAlone)) {
    return { kind: "stacked", reason: "runs-on", lyricCount: lyrics.length, meaningCount: meaning.length }
  }
  return { kind: "pairs", pairs: lyrics.map((line, i) => ({ line, meaning: meaning[i] as string })) }
}
