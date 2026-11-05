/**
 * Line-by-line pairing of the lyrics with a translation, for variant A ("Pairs").
 *
 * A translation is paired with the lyric lines only when it has exactly as many non-empty lines as
 * the lyrics. Anything else (about 97% of songs today: the English text is often one paragraph, or
 * two variants glued together) is NOT paired. The page then falls back to the stacked layout and says
 * so. Nothing is ever split, merged or padded to make it fit.
 */

export type AlignResult =
  | { kind: "pairs"; pairs: ReadonlyArray<{ readonly line: string; readonly meaning: string }> }
  | { kind: "stacked"; reason: "no-lyrics" | "no-meaning" | "count-differs"; lyricCount: number; meaningCount: number }

/** The non-empty, trimmed lines of a translation text. */
export function meaningLines(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function alignLines(lyricLines: readonly string[], meaningText: string | null | undefined): AlignResult {
  const lyrics = lyricLines.map((line) => line.trim()).filter(Boolean)
  const meaning = meaningLines(meaningText)
  if (!lyrics.length) return { kind: "stacked", reason: "no-lyrics", lyricCount: 0, meaningCount: meaning.length }
  if (!meaning.length) return { kind: "stacked", reason: "no-meaning", lyricCount: lyrics.length, meaningCount: 0 }
  if (lyrics.length !== meaning.length) {
    return { kind: "stacked", reason: "count-differs", lyricCount: lyrics.length, meaningCount: meaning.length }
  }
  return { kind: "pairs", pairs: lyrics.map((line, i) => ({ line, meaning: meaning[i] as string })) }
}
