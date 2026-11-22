/** Split prepared lyrics into stanza blocks (blank-line separated), like prabhatasamgiita.net <p> gaps. */
export function lyricsStanzaBlocks(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  const blocks: string[] = []
  let current: string[] = []
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current.length) {
        blocks.push(current.join("\n"))
        current = []
      }
      continue
    }
    current.push(line)
  }
  if (current.length) blocks.push(current.join("\n"))
  return blocks.length ? blocks : [trimmed]
}