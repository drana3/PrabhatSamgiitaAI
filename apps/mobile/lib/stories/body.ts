export type StoryBlock = { kind: "p"; text: string } | { kind: "quote"; text: string }

/** An editor marks a pull quote by starting the paragraph with `> `. */
const QUOTE_MARK = /^>\s*/

/** The story body as blocks: paragraphs and pull quotes. Blank paragraphs are dropped, spacing is tidied. */
export function parseBody(paragraphs: readonly string[]): StoryBlock[] {
  const blocks: StoryBlock[] = []
  for (const raw of paragraphs) {
    const text = raw.replace(/\s+/g, " ").trim()
    if (!text) continue
    if (QUOTE_MARK.test(text)) {
      const quote = text.replace(QUOTE_MARK, "").trim()
      if (quote) blocks.push({ kind: "quote", text: quote })
    } else {
      blocks.push({ kind: "p", text })
    }
  }
  return blocks
}

/** The words of the body (quotes included, marks left out), for the read-time estimate. */
export function bodyText(paragraphs: readonly string[]): string[] {
  return parseBody(paragraphs).map((b) => b.text)
}

/** "PS 3" never breaks across two lines: a no-break space between PS and the number. */
export function keepPsTogether(text: string): string {
  return text.replace(/\bPS (\d)/g, "PS\u00a0$1")
}
