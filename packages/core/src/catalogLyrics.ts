import {
  extractTrailingEnglishTheme,
  isEnglishThemeLine,
} from "./lyricsTheme"

const LANGUAGE_ALIASES: Record<string, readonly string[]> = {
  sanskrit: ["sanskrit", "samskrta", "samskrt", "samskrto"],
  bengali: ["bengali", "bangla"],
  hindi: ["hindi"],
  english: ["english"],
  urdu: ["urdu"],
  maithili: ["maithili"],
  angika: ["angika"],
  magahi: ["magahi"],
  roman: ["roman"],
}

const ALL_LANGUAGE_LABEL_FOLDS = new Set<string>([
  ...Object.keys(LANGUAGE_ALIASES),
  ...Object.values(LANGUAGE_ALIASES).flat(),
])

function foldLabel(value: string): string {
  const decomposed = value.normalize("NFKD")
  let out = ""
  for (const character of decomposed) {
    const code = character.charCodeAt(0)
    if (code >= 0x0300 && code <= 0x036f) continue
    if (/[a-z]/i.test(character)) out += character.toLowerCase()
  }
  return out
}

function expandLanguageFolds(language: string | null | undefined, extra: string[] = []): Set<string> {
  const folds = new Set<string>()
  const tokens = [
    ...(language || "")
      .split(/[,;/]+/)
      .map((part) => part.trim())
      .filter(Boolean),
    ...extra,
  ]
  for (const token of tokens) {
    const folded = foldLabel(token)
    if (!folded) continue
    folds.add(folded)
    for (const [canonical, aliases] of Object.entries(LANGUAGE_ALIASES)) {
      if (folded === canonical || aliases.includes(folded)) {
        folds.add(canonical)
        for (const alias of aliases) folds.add(alias)
      }
    }
  }
  return folds
}

/** Scrape artifact lines that are only lengthened Á / A vowels — not real lyrics. */
export function isCorruptLyricPaddingLine(line: string): boolean {
  const text = line.trim()
  if (text.length < 8) return false
  let letters = ""
  for (const character of text.normalize("NFKD")) {
    const code = character.charCodeAt(0)
    if (code >= 0x0300 && code <= 0x036f) continue
    if (/\p{L}/u.test(character)) letters += character
  }
  if (letters.length < 8) return false
  const compact = text.replace(/\s/g, "")
  if (letters.length < compact.length * 0.5) return false
  const upper = letters.toUpperCase()
  if ([...upper].every((ch) => ch === "A")) return true
  const unique = new Set([...letters])
  if (unique.size === 1) return true
  const counts = new Map<string, number>()
  for (const letter of letters) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1)
  }
  const top = Math.max(...counts.values())
  return top >= 8 && top >= letters.length * 0.85
}

export function isCatalogLanguageLabelLine(
  line: string,
  language: string | null | undefined,
  extraLanguages: string[] = [],
): boolean {
  const text = line.trim()
  if (!text || text.length > 48) return false
  if (isEnglishThemeLine(text)) return false
  const folded = foldLabel(text)
  if (!folded) return false
  const folds = expandLanguageFolds(language, extraLanguages)
  if (folds.has(folded)) return true
  if (folded === "samskrta" && folds.has("sanskrit")) return true
  if (folded === "sanskrit" && folds.has("samskrta")) return true
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length > 2) return false
  if (words.length === 1 && ALL_LANGUAGE_LABEL_FOLDS.has(folded)) return true
  for (const candidate of folds) {
    if (folded === candidate) return true
    if (folded.length >= 4 && candidate.length >= 4) {
      if (folded.startsWith(candidate) || candidate.startsWith(folded)) return true
    }
  }
  return false
}

function trimmedLine(line: string): string {
  return line.trim()
}

function hasPreservedStanzaGaps(lines: readonly string[]): boolean {
  return lines.some((line) => !line.trim())
}

function maxConsecutiveBlankRun(lines: readonly string[]): number {
  let best = 0
  let index = 0
  while (index < lines.length) {
    if (lines[index]!.trim()) {
      index += 1
      continue
    }
    let run = 0
    while (index + run < lines.length && !lines[index + run]!.trim()) {
      run += 1
    }
    best = Math.max(best, run)
    index += run
  }
  return best
}

function needsOfficialBrNormalization(lines: readonly string[]): boolean {
  const maxRun = maxConsecutiveBlankRun(lines)
  if (maxRun >= 3) return true
  const gapCount = lines.filter((line) => !line.trim()).length
  return maxRun >= 2 && gapCount >= 8
}

/**
 * prabhatasamgiita.net uses pairs of &lt;br&gt; between lines and longer runs between stanzas.
 * Collapse 1–2 blank lines (line breaks); keep 3+ as a single stanza gap.
 */
export function normalizeOfficialBrParagraphGaps(lines: readonly string[]): string[] {
  const out: string[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    if (line.trim()) {
      out.push(line)
      index += 1
      continue
    }
    let blankRun = 0
    while (index + blankRun < lines.length && !lines[index + blankRun]!.trim()) {
      blankRun += 1
    }
    if (blankRun >= 3) {
      if (out.length && out[out.length - 1]!.trim()) out.push("")
    }
    index += blankRun
  }
  return out
}

/** Two consecutive lyric lines that repeat as a stanza boundary (e.g. PS 100 refrain couplet). */
function findBestRepeatingPair(lines: readonly string[]): [string, string] | null {
  const counts = new Map<string, number>()
  for (let index = 0; index < lines.length - 1; index += 1) {
    const left = trimmedLine(lines[index]!)
    const right = trimmedLine(lines[index + 1]!)
    if (!left || !right) continue
    const key = `${left}\u0000${right}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: [string, string] | null = null
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count < 2 || count <= bestCount) continue
    const splitAt = key.indexOf("\u0000")
    best = [key.slice(0, splitAt), key.slice(splitAt + 1)]
    bestCount = count
  }
  return best
}

function insertBlanksBeforeRepeatingPair(lines: readonly string[], pair: readonly [string, string]): string[] {
  const [left, right] = pair
  let seenFirst = false
  const out: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const isPairStart =
      trimmedLine(lines[index]!) === left && trimmedLine(lines[index + 1] ?? "") === right
    if (isPairStart && seenFirst && out.length && out[out.length - 1]!.trim()) {
      out.push("")
    }
    if (isPairStart) seenFirst = true
    out.push(lines[index]!)
  }
  return out
}

function insertBlanksBeforeRefrainLine(lines: readonly string[], refrain: string): string[] {
  const out: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const trimmed = trimmedLine(line)
    if (
      index > 0 &&
      trimmed &&
      trimmed === refrain &&
      out.length > 0 &&
      out[out.length - 1]!.trim() &&
      trimmedLine(out[out.length - 1]!) !== refrain
    ) {
      out.push("")
    }
    out.push(line)
  }
  return out
}

/**
 * Insert blank lines between stanzas like prabhatasamgiita.net (paragraph breaks).
 * Preserves existing blanks from the catalogue scrape; infers gaps when lyrics are a single block.
 */
export function inferStanzaBlankLines(lines: readonly string[]): string[] {
  if (lines.length < 3) return [...lines]
  if (hasPreservedStanzaGaps(lines)) return [...lines]

  const pair = findBestRepeatingPair(lines)
  if (pair) {
    const withPair = insertBlanksBeforeRepeatingPair(lines, pair)
    if (withPair.some((line) => !line.trim())) return withPair
  }

  const refrain = trimmedLine(lines.find((line) => line.trim()) ?? "")
  if (refrain) return insertBlanksBeforeRefrainLine(lines, refrain)
  return [...lines]
}

const DEVANAGARI_LANGUAGE_HEADERS = new Set([
  "संस्कृत",
  "संस्क्र्त",
  "हिन्दी",
  "हिंदी",
  "बंगला",
  "बन्ग्ला",
  "मैथिली",
  "उर्दू",
  "अंगिका",
  "मगही",
])

function devanagariHeaderToken(line: string): string {
  return line.trim().replace(/[：:]+$/, "").trim()
}

export function isDevanagariLanguageHeaderLine(line: string): boolean {
  const token = devanagariHeaderToken(line)
  if (!token || token.length > 48) return false
  if (DEVANAGARI_LANGUAGE_HEADERS.has(token)) return true
  return isCatalogLanguageLabelLine(token, null, [])
}

export function devanagariContentLines(
  devanagari: string,
  options: { language?: string | null; languageLabels?: string[] } = {},
): string[] {
  let lines = devanagari
    .split("\n")
    .filter((line) => line.trim() && !isCorruptLyricPaddingLine(line))
  while (
    lines.length &&
    (isCatalogLanguageLabelLine(lines[0]!, options.language, options.languageLabels) ||
      isDevanagariLanguageHeaderLine(lines[0]!))
  ) {
    lines.shift()
  }
  return lines
}

function alignDevanagariByRomanStanzas(romanLines: string[], devContent: string[]): string {
  const out: string[] = []
  let devIndex = 0
  for (const romanLine of romanLines) {
    if (!romanLine.trim()) {
      if (out.length && out[out.length - 1]!.trim()) out.push("")
      continue
    }
    if (devIndex < devContent.length) {
      out.push(devContent[devIndex]!)
      devIndex += 1
    }
  }
  return out.join("\n").trim()
}

/** Mirror Roman stanza gaps onto Devanagari (rule-converted lyrics). */
export function alignDevanagariStanzaGaps(
  romanWithGaps: string,
  devanagari: string,
  options: { language?: string | null; languageLabels?: string[] } = {},
): string {
  const romanLines = romanWithGaps.split("\n")
  const devContent = devanagariContentLines(devanagari, options)
  if (!devContent.length) return ""
  const romanContentCount = romanLines.filter((line) => line.trim()).length
  const hasRomanStanzaGaps = romanLines.some((line) => !line.trim())
  if (devContent.length === romanContentCount) {
    const out: string[] = []
    let devIndex = 0
    for (const romanLine of romanLines) {
      if (!romanLine.trim()) {
        out.push("")
        continue
      }
      out.push(devContent[devIndex]!)
      devIndex += 1
    }
    return out.join("\n").trim()
  }
  if (hasRomanStanzaGaps && devContent.length <= romanContentCount) {
    return alignDevanagariByRomanStanzas(romanLines, devContent)
  }
  return inferStanzaBlankLines(devContent).join("\n").trim()
}

export function sanitizeCatalogLyricsText(
  lyrics: string | null | undefined,
  options: {
    language?: string | null
    languageLabels?: string[]
    preserveTrailingNewline?: boolean
  } = {},
): string {
  if (!lyrics?.trim()) return ""
  const endsWithNewline = lyrics.endsWith("\n")
  let lines = lyrics.split("\n").filter((line) => !isCorruptLyricPaddingLine(line))

  while (lines.length && lines[0]!.trim() && isCatalogLanguageLabelLine(lines[0]!, options.language, options.languageLabels)) {
    lines.shift()
    while (lines.length && !lines[0]!.trim()) lines.shift()
  }

  lines = lines.filter((line) => !line.trim() || !isEnglishThemeLine(line))
  // Mid-block theme labels from HTML must not appear as lyric lines.
  if (needsOfficialBrNormalization(lines)) {
    lines = normalizeOfficialBrParagraphGaps(lines)
  } else if (hasPreservedStanzaGaps(lines)) {
    lines = [...lines]
  } else {
    lines = inferStanzaBlankLines(lines)
  }

  const collapsed: string[] = []
  for (const line of lines) {
    if (!line.trim() && collapsed.length && !collapsed[collapsed.length - 1]!.trim()) continue
    collapsed.push(line)
  }

  let cleaned = collapsed.join("\n").trim()
  if (!cleaned) return ""
  if (endsWithNewline || options.preserveTrailingNewline) cleaned += "\n"
  return cleaned
}

export function resolveCatalogSongHeading(options: {
  title?: string | null
  firstLine?: string | null
  lyrics?: string | null
  language?: string | null
  languageLabels?: string[]
}): { title: string; firstLine: string } | null {
  const firstLyric =
    (options.lyrics || "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || ""
  if (!firstLyric) return null

  const titleBad =
    !options.title?.trim() ||
    isCorruptLyricPaddingLine(options.title) ||
    isCatalogLanguageLabelLine(options.title, options.language, options.languageLabels)
  const firstBad =
    !options.firstLine?.trim() ||
    isCorruptLyricPaddingLine(options.firstLine) ||
    isCatalogLanguageLabelLine(options.firstLine, options.language, options.languageLabels)

  if (!titleBad && !firstBad) return null
  return { title: firstLyric, firstLine: firstLyric }
}

export function languageLabelsFromMetadata(metadata: Record<string, unknown> | null | undefined): string[] {
  const labels: string[] = []
  const meta = metadata ?? {}
  const assignment = meta.canonical_theme_assignments as { languages?: string[] } | undefined
  if (Array.isArray(assignment?.languages)) {
    labels.push(...assignment.languages.filter((value): value is string => typeof value === "string"))
  }
  if (typeof meta.category === "string" && meta.category.trim()) {
    labels.push(meta.category.trim())
  }
  return labels
}

export function prepareCatalogLyricsFields(row: {
  lyrics_original?: string | null
  title?: string | null
  first_line?: string | null
  language?: string | null
  metadata_json?: Record<string, unknown> | null
}): {
  lyrics_original: string | null
  title: string | null | undefined
  first_line: string | null | undefined
  peeled_theme: string | null
} {
  const languageLabels = languageLabelsFromMetadata(row.metadata_json)
  const raw = row.lyrics_original || ""
  const { lyrics: withoutTheme, theme } = extractTrailingEnglishTheme(raw)
  const lyrics = sanitizeCatalogLyricsText(withoutTheme, {
    language: row.language,
    languageLabels,
  })
  const heading = resolveCatalogSongHeading({
    title: row.title,
    firstLine: row.first_line,
    lyrics,
    language: row.language,
    languageLabels,
  })
  return {
    lyrics_original: lyrics || null,
    title: heading?.title ?? row.title,
    first_line: heading?.firstLine ?? row.first_line,
    peeled_theme: theme,
  }
}