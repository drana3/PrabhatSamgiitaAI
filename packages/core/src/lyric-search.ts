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

const STOP = new Set(
  "a an and as at be but by can do for from i if in is it me my no not o of oh on or so that the this to us we with you your".split(
    " ",
  ),
)

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

/** Fold common Roman-transliteration spellings: humdardi ≈ hamdardi, siv ≈ shiva. */
export function foldLyricPhonetic(value: string): string {
  return value
    .split(" ")
    .map((token) => foldLyricToken(token))
    .filter(Boolean)
    .join(" ")
}

function foldLyricToken(token: string): string {
  if (!token) return token
  let folded = token
  folded = folded.replace(/aa+/g, "a")
  folded = folded.replace(/ee+/g, "i")
  folded = folded.replace(/oo+/g, "u")
  folded = folded.replace(/uu+/g, "u")
  folded = folded.replace(/kh/g, "k")
  folded = folded.replace(/gh/g, "g")
  folded = folded.replace(/bh/g, "b")
  folded = folded.replace(/dh/g, "d")
  folded = folded.replace(/ph/g, "f")
  folded = folded.replace(/th/g, "t")
  folded = folded.replace(/sh/g, "s")
  folded = folded.replace(/ch/g, "c")
  folded = folded.replace(/v/g, "w")
  folded = folded.replace(/y/g, "i")
  if (folded.length >= 4 && folded.endsWith("a")) folded = folded.slice(0, -1)
  folded = folded.replace(/[ou]/g, "a")
  folded = folded.replace(/i{2,}/g, "i")
  folded = folded.replace(/a{2,}/g, "a")
  return folded
}

/** Names people type many ways: siv / shiv / shiva, krishna / krsna. */
const SEARCH_NAME_ALIASES: Record<string, string> = {
  siv: "shiva",
  shiv: "shiva",
  siva: "shiva",
  shiva: "shiva",
  mahadev: "shiva",
  mahadeva: "shiva",
  shankar: "shiva",
  shankara: "shiva",
  sadashiv: "shiva",
  sadashiva: "shiva",
  kishan: "krsna",
  kisan: "krsna",
  kisna: "krsna",
  kisn: "krsna",
  kishna: "krsna",
  krisna: "krsna",
  krisn: "krsna",
  krishn: "krsna",
  krishna: "krsna",
  krsna: "krsna",
  krsn: "krsna",
  krshna: "krsna",
  krushna: "krsna",
  krushn: "krsna",
}

export function canonicalSearchKey(value: string): string {
  const normalized = normalizeLyricText(value)
  if (!normalized) return normalized
  if (SEARCH_NAME_ALIASES[normalized]) return SEARCH_NAME_ALIASES[normalized]
  const folded = foldLyricPhonetic(normalized)
  return SEARCH_NAME_ALIASES[folded] ?? SEARCH_NAME_ALIASES[normalized.replace(/a$/, "")] ?? normalized
}

/** Drop “songs of / songs about / …songs” so any remaining word can match the catalog. */
export function stripCatalogSearchFraming(value: string): string {
  return normalizeLyricText(value)
    .replace(/^(search prabhat samgiita for)\s+/, "")
    .replace(/^(songs?)\s+(of|for|about|on)\s+/, "")
    .replace(/\s+(songs?|music|bhajans?|kirtans?|kiirtans?)$/, "")
    .trim()
}

/** Keys to try against collections or lyrics: full query, stripped framing, short-name tokens. */
export function catalogLookupKeys(query: string): string[] {
  const keys: string[] = []
  const add = (value: string) => {
    if (!value || keys.includes(value)) return
    keys.push(value)
    const compact = value.replace(/ /g, "")
    if (compact !== value) add(compact)
    const canon = canonicalSearchKey(value)
    if (canon !== value) add(canon)
  }
  const full = normalizeLyricText(query)
  add(full)
  const stripped = stripCatalogSearchFraming(query)
  add(stripped)
  const words = stripped.split(" ").filter(Boolean)
  if (words.length >= 1 && words.length <= 3) {
    for (const word of words) {
      if (word.length >= 3 && !STOP.has(word)) add(word)
    }
  }
  return keys
}

/** One typo for short words, two for longer ones. */
export function maxLyricEdits(length: number) {
  if (length < 5) return 0
  if (length < 8) return 1
  return 2
}

function adjacentTranspose(left: string, right: string) {
  if (left.length !== right.length || left.length < 2) return false
  let index = 0
  while (index < left.length && left[index] === right[index]) index += 1
  if (index >= left.length - 1) return false
  if (left[index] !== right[index + 1] || left[index + 1] !== right[index]) return false
  return left.slice(index + 2) === right.slice(index + 2)
}

export function withinLyricEdits(left: string, right: string, max = maxLyricEdits(left.length)) {
  if (left === right) return true
  if (max <= 0) return false
  const gap = Math.abs(left.length - right.length)
  if (gap > max) return false
  if (gap === 0 && adjacentTranspose(left, right)) return true
  const rows = left.length
  const cols = right.length
  let previous = new Array(cols + 1)
  let current = new Array(cols + 1)
  for (let col = 0; col <= cols; col += 1) previous[col] = col
  for (let row = 1; row <= rows; row += 1) {
    current[0] = row
    let best = current[0]
    const leftCode = left.charCodeAt(row - 1)
    for (let col = 1; col <= cols; col += 1) {
      const cost = leftCode === right.charCodeAt(col - 1) ? 0 : 1
      const value = Math.min(previous[col] + 1, current[col - 1] + 1, previous[col - 1] + cost)
      current[col] = value
      if (value < best) best = value
    }
    if (best > max) return false
    const swap = previous
    previous = current
    current = swap
  }
  return previous[cols] <= max
}

function fuzzyTokenMatch(needle: string, tokens: Iterable<string>) {
  const max = maxLyricEdits(needle.length)
  if (max <= 0 || needle.length < 2) return false
  const first = needle[0]
  const second = needle[1]
  for (const token of tokens) {
    if (!token) continue
    if (token[0] !== first && token[0] !== second) continue
    if (token === needle) return true
    if (needle.length >= 5 && token.startsWith(needle) && token.length - needle.length <= max) return true
    if (token.length >= 5 && needle.startsWith(token) && needle.length - token.length <= max) return true
    if (withinLyricEdits(needle, token, max)) return true
  }
  return false
}

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
  const foldedQuery = foldLyricPhonetic(query)
  if (foldedQuery.length >= 4) {
    const words = body.split(" ").filter(Boolean)
    const needle = foldedQuery.split(" ")[0] ?? ""
    const index = words.findIndex((word) => {
      const folded = foldLyricPhonetic(word)
      return folded.includes(needle) || (needle.length >= 5 && withinLyricEdits(needle, folded))
    })
    if (index >= 0) {
      const start = Math.max(0, index - 2)
      const end = Math.min(words.length, index + 8)
      return words.slice(start, end).join(" ")
    }
  }
  return opening
}

type FoldedLyric = {
  title: string
  opening: string
  body: string
  tokens: Set<string>
  openingTokens: string[]
  tokenList: string[]
}

const foldedCache = new WeakMap<LyricSearchRow, FoldedLyric>()

function foldedLyric(row: LyricSearchRow): FoldedLyric {
  const cached = foldedCache.get(row)
  if (cached) return cached
  const title = foldLyricPhonetic(normalizeLyricText(row.t))
  const opening = foldLyricPhonetic(normalizeLyricText(row.o))
  const body = foldLyricPhonetic(row.b)
  const tokens = new Set(body.split(" ").filter(Boolean))
  const openingTokens = Array.from(
    new Set(`${title} ${opening}`.split(" ").filter((token) => token.length >= 4)),
  )
  const next = {
    title,
    opening,
    body,
    tokens,
    openingTokens,
    tokenList: Array.from(tokens),
  }
  foldedCache.set(row, next)
  return next
}

function scoreRow(
  query: string,
  tokens: string[],
  row: LyricSearchRow,
  foldedQuery: string,
  foldedTokenByExact: Map<string, string>,
): LyricSearchHit | null {
  const title = normalizeLyricText(row.t)
  const opening = normalizeLyricText(row.o)
  const body = row.b
  const bodyTokens = new Set(body.split(" ").filter(Boolean))
  const folded = foldedLyric(row)
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
  } else if (foldedQuery.length >= 4 && (folded.opening.includes(foldedQuery) || folded.title.includes(foldedQuery))) {
    score = 64
    matchedBy = "opening_line"
  } else if (foldedQuery.length >= 4 && folded.body.includes(foldedQuery)) {
    score = 44
    matchedBy = "full_text"
  } else if (tokens.length) {
    const distinctive = tokens.filter((token) => !STOP.has(token))
    const scored = distinctive.length ? distinctive : tokens
    const exactHits = scored.filter((token) => {
      if (bodyTokens.has(token)) return true
      if (token.length < 4) return false
      const foldedToken = foldedTokenByExact.get(token)
      return Boolean(foldedToken) && folded.tokens.has(foldedToken)
    }).length
    const coverage = exactHits / scored.length
    if (exactHits && distinctive.length >= 3 && coverage >= 0.7) {
      score = 40
      matchedBy = "full_text"
    } else {
      const needles = scored
        .map((token) => foldedTokenByExact.get(token) ?? foldLyricPhonetic(token))
        .filter((token) => token.length >= 5)
      if (needles.length) {
        const openingHits = needles.filter((needle) => fuzzyTokenMatch(needle, folded.openingTokens)).length
        if (openingHits / needles.length >= 0.6) {
          score = 58
          matchedBy = "opening_line"
        } else if (needles.length === 1) {
          const bodyHits = needles.filter((needle) => fuzzyTokenMatch(needle, folded.tokenList)).length
          if (bodyHits / needles.length >= 0.6) {
            score = 42
            matchedBy = "full_text"
          }
        }
      }
      if (!score) {
        if (exactHits && coverage >= 0.6) {
          score = 12 * coverage
          matchedBy = "full_text"
        } else {
          return null
        }
      }
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

export function interpretLyricHits(hits: LyricSearchHit[]): LyricSearchHit[] {
  const confident = confidentLyricHits(hits)
  if (confident.length) return confident
  return hits.filter((hit) => hit.score >= 24)
}

export function searchLyrics(query: string, rows: LyricSearchRow[], limit = 5): LyricSearchHit[] {
  const normalized = normalizeLyricText(query)
  if (normalized.length < 2) return []
  const tokens = normalized.split(" ").filter(Boolean)
  const foldedQuery = foldLyricPhonetic(normalized)
  const foldedTokenByExact = new Map(tokens.map((token) => [token, foldLyricPhonetic(token)]))
  const hits: LyricSearchHit[] = []
  for (const row of rows) {
    const hit = scoreRow(normalized, tokens, row, foldedQuery, foldedTokenByExact)
    if (hit) hits.push(hit)
  }
  hits.sort((left, right) => right.score - left.score || left.number - right.number)
  return hits.slice(0, Math.max(1, limit))
}
