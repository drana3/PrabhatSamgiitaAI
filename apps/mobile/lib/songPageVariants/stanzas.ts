/**
 * Stanzas and repeats found in the lyric lines themselves, for variants A and C.
 * The catalogue has no stanza markers, so a stanza starts where the song returns to its first line
 * (a refrain). Where the song never does, it is one stanza. A repeat is a line that says again what an
 * earlier line said (compared by letters only, without accents, case or punctuation).
 * Nothing is invented: both rules read only the text that is there.
 */

/** Letters only, no accents, lower case: "E gán ámár, álor" and "E gan amar alor" are the same line. */
export function foldLine(line: string): string {
  return line
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
}

/** For each line, the index of the first earlier line it repeats, or null. */
export function repeatsOf(lines: readonly string[]): Array<number | null> {
  const seen = new Map<string, number>()
  return lines.map((line, index) => {
    const key = foldLine(line)
    if (!key) return null
    const first = seen.get(key)
    if (first === undefined) {
      seen.set(key, index)
      return null
    }
    return first
  })
}

/** Inclusive line range of a stanza. */
export type Stanza = { from: number; to: number }

export function splitStanzas(lines: readonly string[]): Stanza[] {
  if (!lines.length) return []
  const head = foldLine(lines[0] as string)
  const starts = [0]
  if (head) {
    for (let i = 1; i < lines.length; i += 1) {
      const last = starts[starts.length - 1] as number
      // a return to the first line starts a stanza, unless it only repeats the line just sung
      if (foldLine(lines[i] as string) === head && i - last >= 2) starts.push(i)
    }
  }
  const stanzas: Stanza[] = starts.map((from, k) => ({ from, to: (starts[k + 1] ?? lines.length) - 1 }))
  // a last "stanza" of one line is the refrain sung once more at the end: it stays with the stanza before
  if (stanzas.length > 1) {
    const tail = stanzas[stanzas.length - 1] as Stanza
    if (tail.from === tail.to) {
      stanzas.pop()
      ;(stanzas[stanzas.length - 1] as Stanza).to = tail.to
    }
  }
  return stanzas
}
