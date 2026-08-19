export type LyricSearchRow = {
  n: number
  t: string
  o: string
  b: string
}

export type LyricSearchHit = {
  number: number
  title: string
  firstLine: string
  snippet: string
  score: number
  matchedBy: "opening_line" | "full_text"
}

const TOKEN = /[^a-z0-9]+/g

export function isCatalogNumberQuery(value: string) {
  return /^\s*(?:ps[\s-]*)?\d{1,4}\s*$/i.test(value)
}

export function normalizeLyricText(value: string | null | undefined): string {
  const decomposed = (value ?? "").normalize("NFKD").toLowerCase()
  let plain = ""
  for (const character of decomposed) {
    if (character.charCodeAt(0) >= 0x300 && character.charCodeAt(0) <= 0x36f) continue
    plain += character
  }
  return plain.replace(TOKEN, " ").trim()
}

const STOP = new Set(
  "a an and as at be but by can do for from i if in is it me my no not o of oh on or so that the this to us we with you your".split(
    " ",
  ),
)

function lyricSnippet(query: string, tokens: string[], opening: string, body: string) {
  const source = body.includes(query) ? body : opening
  const at = source.indexOf(query)
  if (at >= 0) {
    const start = Math.max(0, at - 20)
    const end = Math.min(source.length, at + Math.max(query.length, 48) + 28)
    let slice = source.slice(start, end).trim()
    if (start > 0) slice = `…${slice}`
    if (end < source.length) slice = `${slice}…`
    return slice
  }
  const distinctive = tokens.filter((token) => !STOP.has(token) && body.includes(token))
  if (distinctive.length) {
    const first = body.indexOf(distinctive[0])
    const start = Math.max(0, first - 16)
    const end = Math.min(body.length, first + 72)
    let slice = body.slice(start, end).trim()
    if (start > 0) slice = `…${slice}`
    if (end < body.length) slice = `${slice}…`
    return slice
  }
  return opening
}

function scoreRow(query: string, tokens: string[], row: LyricSearchRow): LyricSearchHit | null {
  const title = normalizeLyricText(row.t)
  const opening = normalizeLyricText(row.o)
  const body = row.b
  const bodyTokens = new Set(body.split(" ").filter(Boolean))
  let score = 0
  let matchedBy: LyricSearchHit["matchedBy"] = "full_text"
  if (query === opening || query === title) {
    score = 100
    matchedBy = "opening_line"
  } else if (opening.startsWith(query) || title.startsWith(query)) {
    score = 88
    matchedBy = "opening_line"
  } else if (opening.includes(query) || title.includes(query)) {
    score = 72
    matchedBy = "opening_line"
  } else if (body.includes(query)) {
    score = 48
    matchedBy = "full_text"
  } else if (tokens.length) {
    const distinctive = tokens.filter((token) => !STOP.has(token))
    const scored = distinctive.length ? distinctive : tokens
    const hits = scored.filter((token) => bodyTokens.has(token)).length
    if (!hits) return null
    const coverage = hits / scored.length
    if (distinctive.length >= 3 && coverage >= 0.7) {
      score = 40
      matchedBy = "full_text"
    } else if (coverage < 0.6) {
      return null
    } else {
      score = 12 * coverage
      matchedBy = "full_text"
    }
  } else {
    return null
  }
  return {
    number: row.n,
    title: row.t,
    firstLine: row.o,
    snippet:
      matchedBy === "opening_line"
        ? row.o || row.t
        : lyricSnippet(query, tokens, row.o, body) || row.o || row.t,
    score,
    matchedBy,
  }
}

export function isLyricCatalogQuery(value: string) {
  const trimmed = value.trim()
  if (trimmed.length < 2) return false
  if (isCatalogNumberQuery(trimmed)) return false
  if (/^search prabhat samgiita for\s+/i.test(trimmed)) return false
  if (/\?/.test(trimmed)) return false
  if (
    /\b(?:i(?:'m| am)|we are|feel(?:ing)?|help me|recommend|suggest|what|why|how|should i|can you|please)\b/i.test(
      trimmed,
    )
  ) {
    return false
  }
  if (/^(?:songs?|song)\s+(?:for|about|on)\b/i.test(trimmed)) return false
  return true
}

export function confidentLyricHits(hits: LyricSearchHit[]): LyricSearchHit[] {
  return hits.filter((hit) => hit.matchedBy === "opening_line" || hit.score >= 40)
}

export function searchLyrics(query: string, rows: LyricSearchRow[], limit = 5): LyricSearchHit[] {
  const normalized = normalizeLyricText(query)
  if (normalized.length < 2) return []
  const tokens = normalized.split(" ").filter(Boolean)
  const hits: LyricSearchHit[] = []
  for (const row of rows) {
    const hit = scoreRow(normalized, tokens, row)
    if (hit) hits.push(hit)
  }
  hits.sort((left, right) => right.score - left.score || left.number - right.number)
  return hits.slice(0, Math.max(1, limit))
}
