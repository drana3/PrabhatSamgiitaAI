export type LyricSearchRow = {
  n: number
  t: string
  o: string
  /** Normalized romanized lyrics / transliteration — never English meaning. */
  b: string
  /** Optional normalized English meaning (separate from `b`). */
  e?: string
}

export type LyricSearchHit = {
  number: number
  title: string
  firstLine: string
  snippet: string
  score: number
  matchedBy: "opening_line" | "full_text" | "meaning"
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

/** One typo from 4 letters, two from 6 — voice and typing often miss the first letter. */
export function maxLyricEdits(length: number) {
  if (length < 4) return 0
  if (length < 6) return 1
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
  if (!needle || needle.length < 4) return false
  const max = maxLyricEdits(needle.length)
  if (max <= 0) return false
  for (const token of tokens) {
    if (!token || token.length < 3) continue
    const gap = Math.abs(token.length - needle.length)
    if (token === needle) return true
    if (token.startsWith(needle) && token.length - needle.length <= max + 1) return true
    if (needle.startsWith(token) && needle.length - token.length <= max + 1) return true
    if (gap > max) continue
    if (withinLyricEdits(needle, token, max)) return true
  }
  return false
}

/** Match romanized tokens that differ by compound endings (tomake ≈ tomakei). */
export function lyricTokensMatch(left: string, right: string) {
  if (!left || !right) return false
  if (left === right) return true
  const a = foldLyricPhonetic(left)
  const b = foldLyricPhonetic(right)
  if (!a || !b) return false
  if (a === b) return true
  // Compound / elongated endings only (tomake → tomakei), not soft near-misses like tomake≈tomar.
  if (a.length >= 5 && b.length > a.length && b.startsWith(a) && b.length - a.length <= 2) return true
  if (b.length >= 5 && a.length > b.length && a.startsWith(b) && a.length - b.length <= 2) return true
  if (a.length < 5 || b.length < 5) return false
  if (a.slice(0, 4) !== b.slice(0, 4)) return false
  return withinLyricEdits(a, b, 1)
}

/**
 * Fraction of query tokens found nearly consecutively in the haystack.
 * Prefers real lyric lines over bag-of-words title hits on common words like "ami".
 */
export function orderedLyricCoverage(queryTokens: string[], haystackTokens: string[]) {
  if (!queryTokens.length || !haystackTokens.length) return 0
  let best = 0
  const maxGap = queryTokens.length >= 4 ? 1 : 2
  const first = queryTokens[0]
  for (let start = 0; start < haystackTokens.length; start += 1) {
    if (!lyricTokensMatch(first, haystackTokens[start])) continue
    let qi = 1
    let gaps = 0
    for (let hi = start + 1; hi < haystackTokens.length && qi < queryTokens.length; hi += 1) {
      if (lyricTokensMatch(queryTokens[qi], haystackTokens[hi])) {
        qi += 1
        gaps = 0
        continue
      }
      gaps += 1
      if (gaps > maxGap) break
    }
    best = Math.max(best, qi / queryTokens.length)
    if (best === 1) return 1
  }
  return best
}

/** Ordered coverage for already-folded tokens (no re-folding per comparison). */
export function orderedFoldedLyricCoverage(queryTokens: string[], haystackTokens: string[]) {
  if (!queryTokens.length || !haystackTokens.length) return 0
  let best = 0
  const maxGap = queryTokens.length >= 4 ? 1 : 2
  const first = queryTokens[0]
  for (let start = 0; start < haystackTokens.length; start += 1) {
    if (!foldedTokenNearMatch(first, haystackTokens[start])) continue
    let qi = 1
    let gaps = 0
    for (let hi = start + 1; hi < haystackTokens.length && qi < queryTokens.length; hi += 1) {
      if (foldedTokenNearMatch(queryTokens[qi], haystackTokens[hi])) {
        qi += 1
        gaps = 0
        continue
      }
      gaps += 1
      if (gaps > maxGap) break
    }
    best = Math.max(best, qi / queryTokens.length)
    if (best === 1) return 1
  }
  return best
}

function foldedTokenNearMatch(left: string, right: string) {
  if (!left || !right) return false
  if (left === right) return true
  if (left.length >= 5 && right.length > left.length && right.startsWith(left) && right.length - left.length <= 2) {
    return true
  }
  if (right.length >= 5 && left.length > right.length && left.startsWith(right) && left.length - right.length <= 2) {
    return true
  }
  if (left.length < 5 || right.length < 5 || left.slice(0, 4) !== right.slice(0, 4)) return false
  return withinLyricEdits(left, right, 1)
}

function hasLyricPhraseAnchor(anchors: string[], folded: FoldedLyric) {
  // Require two distinctive exact folded hits — a single token like "pane" gates
  // hundreds of songs and makes ordered coverage too slow on the full catalog.
  const distinctive = anchors.filter((anchor) => anchor.length >= 4 && !COMMON_LYRIC_TOKENS.has(anchor))
  if (!distinctive.length) return false
  const hits = distinctive.filter(
    (anchor) => folded.tokens.has(anchor) || folded.openingTokenSet.has(anchor),
  ).length
  return hits >= Math.min(2, distinctive.length)
}


const COMMON_LYRIC_TOKENS = new Set(
  "ami tumi tomar tomay tomake tomakei mora mor mama go re se oi ei ar na ki kii he ogo prabhu more moreke amay amake".split(
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
  const foldedQuery = foldLyricPhonetic(query)
  if (foldedQuery.length >= 4) {
    const words = body.split(" ").filter(Boolean)
    const needle = foldedQuery.split(" ")[0] ?? ""
    const index = words.findIndex((word) => {
      const folded = foldLyricPhonetic(word)
      return (
        folded.includes(needle) ||
        (needle.length >= 4 && (fuzzyTokenMatch(needle, [folded]) || fuzzyTokenMatch(needle, [word])))
      )
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
  openingTokenSet: Set<string>
  openingTokens: string[]
  tokenList: string[]
  rawOpeningTokens: string[]
  rawTokenList: string[]
}

const foldedCache = new WeakMap<LyricSearchRow, FoldedLyric>()

function uniqueTokens(value: string, minLength = 3) {
  return Array.from(new Set(value.split(" ").filter((token) => token.length >= minLength)))
}

function foldedLyric(row: LyricSearchRow): FoldedLyric {
  const cached = foldedCache.get(row)
  if (cached) return cached
  const rawTitle = normalizeLyricText(row.t)
  const rawOpening = normalizeLyricText(row.o)
  const title = foldLyricPhonetic(rawTitle)
  const opening = foldLyricPhonetic(rawOpening)
  const body = foldLyricPhonetic(row.b)
  const tokens = new Set(body.split(" ").filter(Boolean))
  const openingTokens = uniqueTokens(`${title} ${opening}`)
  const next = {
    title,
    opening,
    body,
    tokens,
    openingTokenSet: new Set(openingTokens),
    openingTokens,
    tokenList: Array.from(tokens),
    rawOpeningTokens: uniqueTokens(`${rawTitle} ${rawOpening}`),
    rawTokenList: uniqueTokens(row.b),
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
  } else if (foldedQuery.length >= 3 && folded.openingTokenSet.has(foldedQuery)) {
    score = 64
    matchedBy = "opening_line"
  } else if (foldedQuery.length >= 4 && folded.body.includes(foldedQuery)) {
    score = 44
    matchedBy = "full_text"
  } else if (foldedQuery.length >= 3 && folded.tokens.has(foldedQuery)) {
    score = 44
    matchedBy = "full_text"
  } else if (tokens.length >= 3) {
    const foldedQueryTokens = tokens.map((token) => foldedTokenByExact.get(token) ?? foldLyricPhonetic(token))
    if (hasLyricPhraseAnchor(foldedQueryTokens, folded)) {
      const openingCoverage = orderedFoldedLyricCoverage(
        foldedQueryTokens,
        `${folded.title} ${folded.opening}`.split(" ").filter(Boolean),
      )
      const bodyCoverage = orderedFoldedLyricCoverage(
        foldedQueryTokens,
        folded.body.split(" ").filter(Boolean),
      )
      const bestCoverage = Math.max(openingCoverage, bodyCoverage)
      if (bestCoverage >= 0.8) {
        score = Math.round(70 + bestCoverage * 18)
        matchedBy = openingCoverage >= bodyCoverage ? "opening_line" : "full_text"
      }
    }
  }

  if (!score && tokens.length) {
    const distinctive = tokens.filter((token) => !STOP.has(token))
    const scored = distinctive.length ? distinctive : tokens
    let openingHits = 0
    let bodyHits = 0
    const unmatched: Array<{ token: string; foldedToken: string }> = []
    for (const token of scored) {
      const foldedToken = foldedTokenByExact.get(token) ?? foldLyricPhonetic(token)
      if (
        folded.rawOpeningTokens.includes(token) ||
        (foldedToken.length >= 3 && folded.openingTokenSet.has(foldedToken))
      ) {
        openingHits += 1
        continue
      }
      if (bodyTokens.has(token) || (foldedToken.length >= 3 && folded.tokens.has(foldedToken))) {
        bodyHits += 1
        continue
      }
      unmatched.push({ token, foldedToken })
    }
    const matched = openingHits + bodyHits
    // Multi-word queries rely on exact + ordered phrase scoring; fuzzy is for short typos.
    if (
      unmatched.length &&
      scored.length <= 2 &&
      matched / scored.length < 0.6 &&
      (matched + unmatched.length) / scored.length >= 0.6
    ) {
      for (const { token, foldedToken } of unmatched) {
        if (
          fuzzyTokenMatch(token, folded.rawOpeningTokens) ||
          fuzzyTokenMatch(foldedToken, folded.openingTokens)
        ) {
          openingHits += 1
          continue
        }
        if (
          fuzzyTokenMatch(token, folded.rawTokenList) ||
          fuzzyTokenMatch(foldedToken, folded.tokenList)
        ) {
          bodyHits += 1
        }
      }
    }
    const coverage = (openingHits + bodyHits) / scored.length
    const rareOpeningHits = scored.filter((token) => {
      if (COMMON_LYRIC_TOKENS.has(token) || COMMON_LYRIC_TOKENS.has(foldLyricPhonetic(token))) {
        return false
      }
      const foldedToken = foldedTokenByExact.get(token) ?? foldLyricPhonetic(token)
      return (
        folded.rawOpeningTokens.includes(token) ||
        (foldedToken.length >= 3 && folded.openingTokenSet.has(foldedToken))
      )
    }).length
    if (openingHits && openingHits / scored.length >= 0.6) {
      // Multi-word lyric queries: common title words ("ami", "jani") alone must not
      // outrank a real in-verse phrase match.
      if (scored.length >= 3 && rareOpeningHits === 0) {
        score = 36
        matchedBy = "opening_line"
      } else {
        score = scored.length === 1 ? 64 : scored.length >= 3 ? 52 : 58
        matchedBy = "opening_line"
      }
    } else if (openingHits + bodyHits && coverage >= 0.6) {
      score = scored.length === 1 ? 44 : 42
      matchedBy = "full_text"
    } else {
      return null
    }
  } else if (!score) {
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
  return hits.filter(
    (hit) =>
      hit.matchedBy === "opening_line" ||
      hit.matchedBy === "meaning" ||
      hit.score >= 40,
  )
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

const MEANING_PHRASE_SCORE = 36
const MEANING_TOKEN_SCORE = 30

function meaningSnippet(query: string, tokens: string[], meaning: string, opening: string) {
  const at = meaning.indexOf(query)
  if (at >= 0) {
    const start = Math.max(0, at - 24)
    const end = Math.min(meaning.length, at + Math.max(query.length, 56) + 24)
    let slice = meaning.slice(start, end).trim()
    if (start > 0) slice = `…${slice}`
    if (end < meaning.length) slice = `${slice}…`
    return slice
  }
  const distinctive = tokens.filter((token) => !STOP.has(token) && meaning.includes(token))
  if (distinctive.length) {
    const first = meaning.indexOf(distinctive[0])
    const start = Math.max(0, first - 16)
    const end = Math.min(meaning.length, first + 80)
    let slice = meaning.slice(start, end).trim()
    if (start > 0) slice = `…${slice}`
    if (end < meaning.length) slice = `${slice}…`
    return slice
  }
  return opening
}

function scoreMeaningRow(query: string, tokens: string[], row: LyricSearchRow): LyricSearchHit | null {
  const meaning = normalizeLyricText(row.e)
  if (!meaning || meaning.length < 8) return null
  let score = 0
  if (meaning === query || meaning.startsWith(query) || query.startsWith(meaning.slice(0, Math.min(meaning.length, 48)))) {
    score = MEANING_PHRASE_SCORE + 4
  } else if (meaning.includes(query) && query.length >= 8) {
    score = MEANING_PHRASE_SCORE
  } else if (tokens.length) {
    const distinctive = tokens.filter((token) => !STOP.has(token) && token.length >= 3)
    const scored = distinctive.length ? distinctive : tokens.filter((token) => token.length >= 3)
    if (!scored.length) return null
    const meaningTokens = new Set(meaning.split(" ").filter(Boolean))
    let hits = 0
    for (const token of scored) {
      if (meaningTokens.has(token)) hits += 1
    }
    const coverage = hits / scored.length
    if (coverage < 0.6 || hits < 2) return null
    score = MEANING_TOKEN_SCORE + Math.min(6, hits)
  } else {
    return null
  }
  return {
    number: row.n,
    title: row.t,
    firstLine: row.o,
    snippet: meaningSnippet(query, tokens, meaning, row.o || row.t),
    score,
    matchedBy: "meaning",
  }
}

/** Lexical search over the separate English-meaning field (`e`). Never searches `b`. */
export function searchMeanings(query: string, rows: LyricSearchRow[], limit = 5): LyricSearchHit[] {
  const normalized = normalizeLyricText(query)
  if (normalized.length < 4) return []
  const tokens = normalized.split(" ").filter(Boolean)
  if (tokens.length < 2 && normalized.length < 10) return []
  const hits: LyricSearchHit[] = []
  for (const row of rows) {
    const hit = scoreMeaningRow(normalized, tokens, row)
    if (hit) hits.push(hit)
  }
  hits.sort((left, right) => right.score - left.score || left.number - right.number)
  return hits.slice(0, Math.max(1, limit))
}

/** Merge lyric + meaning hits; opening-line lyrics stay above meaning matches. */
export function mergeLyricAndMeaningHits(
  lyricHits: LyricSearchHit[],
  meaningHits: LyricSearchHit[],
  limit = 5,
): LyricSearchHit[] {
  const byNumber = new Map<number, LyricSearchHit>()
  for (const hit of [...lyricHits, ...meaningHits]) {
    const prior = byNumber.get(hit.number)
    if (!prior || hit.score > prior.score) byNumber.set(hit.number, hit)
  }
  return Array.from(byNumber.values())
    .sort((left, right) => {
      const leftOpening = left.matchedBy === "opening_line" ? 1 : 0
      const rightOpening = right.matchedBy === "opening_line" ? 1 : 0
      if (leftOpening !== rightOpening) return rightOpening - leftOpening
      return right.score - left.score || left.number - right.number
    })
    .slice(0, Math.max(1, limit))
}

/** English prose that can match the meaning field — not song numbers or feeling asks. */
export function isMeaningCatalogQuery(value: string) {
  const trimmed = value.trim()
  if (trimmed.length < 8) return false
  if (isCatalogNumberQuery(trimmed)) return false
  if (/^search prabhat samgiita for\s+/i.test(trimmed)) return false
  if (/\?/.test(trimmed)) return false
  if (/^(?:songs?|song)\s+(?:for|about|on)\b/i.test(trimmed)) return false
  if (
    /\b(?:i(?:'m| am)|we are|feel(?:ing)?|help me|recommend|suggest|what|why|how|should i|can you|please)\b/i.test(
      trimmed,
    )
  ) {
    return false
  }
  const normalized = normalizeLyricText(trimmed)
  const words = normalized.split(" ").filter(Boolean)
  if (words.length < 4) return false
  const latin = words.filter((word) => /^[a-z]+$/.test(word))
  return latin.length / words.length >= 0.7
}
