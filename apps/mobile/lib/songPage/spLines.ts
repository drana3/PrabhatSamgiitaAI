import { splitWords, type WordColumn } from "./chordChart"
import { swaraAt } from "./spChords"
import { glossFor, type WordGlosses } from "./songContent"

/**
 * Turns the chosen lyric lines into the rows the Song page draws: words with the chord that sits above them
 * and, for the harmonium, the swara under them. Pure, so the layout rules are tested.
 */
export type SpToken = {
  /** `line-word`, the key the gloss card selects by */
  key: string
  text: string
  chord: string
  swara: string
}

export type SpLine = {
  tokens: SpToken[]
  /** the second script of "Both", under the line */
  second: string | null
  /** up to two translation lines under the line */
  translations: string[]
}

export function buildSpLines(input: {
  primary: string[]
  columnsByLine: Array<WordColumn[] | null> | null
  secondary: string[] | null
  translations: Array<{ code: string; lines: string[] }>
  chordsOn: boolean
  instrument: "guitar" | "harmonium"
}): SpLine[] {
  const { primary, columnsByLine, secondary, translations, chordsOn, instrument } = input
  return primary.map((line, li) => {
    const columns = chordsOn ? (columnsByLine?.[li] ?? null) : null
    const tokens = splitWords(line).map((text, wi) => ({
      key: `${li}-${wi}`,
      text,
      chord: columns?.[wi]?.chord ?? "",
      swara: chordsOn && instrument === "harmonium" ? swaraAt(li, wi) : "",
    }))
    return {
      tokens,
      second: secondary?.[li] ?? null,
      translations: translations.map((t) => t.lines[li]).filter((x): x is string => Boolean(x)),
    }
  })
}

/** What the gloss card shows for a selected word (`gl`). */
export function glossCard(
  selected: string | null,
  lines: SpLine[],
  glosses: WordGlosses | null,
  languages: string[],
  wordCountsMatch: boolean[],
): { title: string; detail: string } {
  if (!selected) return { title: "Tap or hover a word", detail: "Its meaning shows here" }
  const [li, wi] = selected.split("-").map(Number)
  const token = lines[li]?.tokens[wi]
  if (!token) return { title: "Tap or hover a word", detail: "Its meaning shows here" }
  const first = glosses && wordCountsMatch[li] ? glossFor(glosses, languages.slice(0, 1), li, wi) : null
  const second =
    glosses && wordCountsMatch[li] && languages[1] ? glossFor(glosses, [languages[1]], li, wi) : null
  if (!first) return { title: token.text, detail: "No word meaning added yet" }
  return { title: first.text, detail: token.text + (second ? ` · ${second.text}` : "") }
}

export type SpWordToken = { key: string; chord: string; word: string; gloss: string; gloss2: string }
export type SpWordRow = { header: string; tokens: SpWordToken[] }

/** Word-by-word rows of the Words tab: `Line N`, then each word with its meaning in one or two languages. */
export function buildWordRows(
  lines: SpLine[],
  glosses: WordGlosses | null,
  languages: string[],
  wordCountsMatch: boolean[],
): SpWordRow[] {
  return lines.map((line, li) => ({
    header: `Line ${li + 1}`,
    tokens: line.tokens.map((token, wi) => {
      const ok = Boolean(glosses && wordCountsMatch[li])
      const first = ok && glosses && languages[0] ? glossFor(glosses, [languages[0]], li, wi) : null
      const second = ok && glosses && languages[1] ? glossFor(glosses, [languages[1]], li, wi) : null
      return { key: token.key, chord: token.chord, word: token.text, gloss: first?.text ?? "", gloss2: second?.text ?? "" }
    }),
  }))
}
