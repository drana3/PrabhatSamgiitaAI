import {
  isCatalogNumberQuery,
  normalizeLyricText,
  withinLyricEdits,
} from "@prabhat/core"
import { t } from "@/lib/i18n"

/**
 * Pure logic of the unified search (spec SCR-13): what a typed query is,
 * how the Today `hint` / `q` / `focus` / `listen` parameters prefill the
 * field, and the words shown under it. No React, no network.
 */

export const SONG_NUMBER_MIN = 1
export const SONG_NUMBER_MAX = 5018

export type SearchHint = "number" | "words" | "feeling"

/** Mood list ids that exist in the bundled category lists (constants/categories). */
export type FeelingMoodId =
  | "peace"
  | "devotional"
  | "love"
  | "festival"
  | "meditation"
  | "guru"
  | "morning"
  | "rain"
  | "nature"

export type Feeling = {
  /** shown on the chip and in the `Feeling: peaceful` tag */
  label: string
  moodId: FeelingMoodId
  /** plain words that name this feeling; matched diacritic- and typo-tolerantly */
  words: readonly string[]
}

/**
 * The feelings of the empty state, as a cloud of chips. Each one points at a
 * bundled mood list, so a guest gets results with no sign-in and no network.
 * The word-to-list mapping is an editorial guess (open question 8 in SPEC).
 */
export const FEELINGS: readonly Feeling[] = [
  { label: "peaceful", moodId: "peace", words: ["peace", "peaceful", "calm", "calming", "quiet", "relief", "relax", "relaxed", "serene", "serenity", "stress", "stressed", "anxious", "worried"] },
  { label: "devoted", moodId: "devotional", words: ["devotion", "devotional", "devoted", "bhakti", "prayer", "pray", "worship", "reverence", "faith"] },
  { label: "longing", moodId: "love", words: ["longing", "yearning", "love", "loving", "beloved", "missing", "tender", "tenderness", "affection"] },
  { label: "joyful", moodId: "festival", words: ["joy", "joyful", "happy", "happiness", "delight", "celebrate", "celebration", "cheerful", "glad"] },
  { label: "still", moodId: "meditation", words: ["still", "stillness", "meditation", "meditative", "meditate", "silence", "focus", "concentration", "bliss"] },
  { label: "grateful", moodId: "guru", words: ["grateful", "gratitude", "thankful", "guru", "teacher", "baba", "surrender", "trust"] },
  { label: "hopeful", moodId: "morning", words: ["hope", "hopeful", "dawn", "morning", "awakening", "fresh", "renewal"] },
  { label: "sorrowful", moodId: "rain", words: ["sad", "sorrow", "sorrowful", "tears", "grief", "lonely", "loneliness", "melancholy", "rain"] },
  { label: "in awe", moodId: "nature", words: ["awe", "wonder", "beauty", "beautiful", "nature", "wild"] },
] as const

export type QueryKind = "empty" | "number" | "question" | "feeling" | "words"

export type QueryClass = {
  kind: QueryKind
  /** the song number, for `number` */
  number?: number
  /** true when a number is typed but outside 1..5018 */
  outOfRange?: boolean
  /** the strongest feeling found, for `feeling` and for question/words that mention one */
  feeling?: Feeling
  /** every feeling found, in query order */
  feelings: Feeling[]
  /** the query reads as a question for the Answer card */
  isQuestion: boolean
}

function contentTokens(query: string): string[] {
  return normalizeLyricText(query)
    .split(" ")
    .filter((token) => token.length > 0)
}

function tokenIsFeelingWord(token: string, word: string): boolean {
  if (token === word) return true
  if (token.length < 5 || word.length < 5) return false
  // typo tolerance: one edit, same first letter (the core helper allows more on long words)
  return token[0] === word[0] && withinLyricEdits(token, word, 1)
}

/** Feelings named in the query, in the order they appear. */
export function detectFeelings(query: string): Feeling[] {
  const tokens = contentTokens(query)
  const found: Feeling[] = []
  for (const token of tokens) {
    const match = FEELINGS.find((feeling) =>
      feeling.words.some((word) => tokenIsFeelingWord(token, word)),
    )
    if (match && !found.includes(match)) found.push(match)
  }
  return found
}

const QUESTION_START =
  /^(?:which|what|how|why|who|where|when|can|could|should|is|are|do|does|tell me|help me|i (?:need|want|feel|am)|i'm|recommend|suggest|give me|find me|songs? (?:that|which|to help))\b/i

/** Spec SCR-13: a question mark, or an interrogative opening. Long free text is handled with hit counts. */
export function looksLikeQuestion(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (/\?\s*$/.test(trimmed)) return true
  if (isCatalogNumberQuery(trimmed)) return false
  return QUESTION_START.test(trimmed)
}

/** More than six words and nothing found by lexical search: show the Answer card too. */
export function wordCount(query: string): number {
  return query.trim().split(/\s+/).filter(Boolean).length
}

export function shouldShowAnswer(query: string, lexicalHitCount: number): boolean {
  if (!query.trim()) return false
  if (looksLikeQuestion(query)) return true
  return wordCount(query) > 6 && lexicalHitCount === 0
}

export function classifyQuery(query: string): QueryClass {
  const trimmed = query.trim()
  if (!trimmed) return { kind: "empty", feelings: [], isQuestion: false }

  if (isCatalogNumberQuery(trimmed)) {
    const number = Number.parseInt(trimmed.replace(/\D+/g, ""), 10)
    return {
      kind: "number",
      number,
      outOfRange: number < SONG_NUMBER_MIN || number > SONG_NUMBER_MAX,
      feelings: [],
      isQuestion: false,
    }
  }

  const feelings = detectFeelings(trimmed)
  const isQuestion = looksLikeQuestion(trimmed)
  if (isQuestion) {
    return { kind: "question", feeling: feelings[0], feelings, isQuestion: true }
  }

  // A feeling query: the feeling words make up at least half of what was typed.
  const tokens = contentTokens(trimmed)
  const feelingTokens = tokens.filter((token) =>
    feelings.some((feeling) => feeling.words.some((word) => tokenIsFeelingWord(token, word))),
  )
  if (feelings.length && tokens.length && feelingTokens.length * 2 >= tokens.length) {
    return { kind: "feeling", feeling: feelings[0], feelings, isQuestion: false }
  }

  return { kind: "words", feeling: feelings[0], feelings, isQuestion: false }
}

/* ---------- hints from the Today screen ---------- */

/** Spec SCR-13: three tappable examples that fill the field. */
export const SEARCH_EXAMPLES = ["3", "bandhu he niye calo", "peaceful"] as const

/** What a Today "Find a song your way" row prefills. */
export const HINT_EXAMPLES: Record<SearchHint, string> = {
  number: SEARCH_EXAMPLES[0],
  words: SEARCH_EXAMPLES[1],
  feeling: SEARCH_EXAMPLES[2],
}

export type SearchParams = {
  q?: string | string[]
  hint?: string | string[]
  focus?: string | string[]
  listen?: string | string[]
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseHint(value: string | string[] | undefined): SearchHint | null {
  const raw = firstParam(value)?.trim().toLowerCase()
  return raw === "number" || raw === "words" || raw === "feeling" ? raw : null
}

export type ParsedSearchParams = {
  hint: SearchHint | null
  /** text the field starts with */
  query: string
  /** true when the field holds an example from a hint, not something the person typed or asked for */
  prefilled: boolean
  focus: boolean
  listen: boolean
}

/**
 * Today opens `/search?focus=1&hint=number|words|feeling`. An explicit `q` always wins
 * over a hint's example. A hint implies focus. `listen=1` starts the microphone.
 */
export function parseSearchParams(params: SearchParams): ParsedSearchParams {
  const hint = parseHint(params.hint)
  const q = firstParam(params.q)
  const explicit = typeof q === "string" && q.trim().length > 0
  const query = explicit ? (q as string) : hint ? HINT_EXAMPLES[hint] : ""
  return {
    hint,
    query,
    prefilled: !explicit && hint !== null,
    focus: firstParam(params.focus) === "1" || hint !== null,
    listen: firstParam(params.listen) === "1",
  }
}

/* ---------- words shown around the field ---------- */

export const SEARCH_PLACEHOLDER_V2 = "Search a number, a name or a feeling"
export const EMPTY_SENTENCE = "A number, a name or first line, or how you feel. No need to choose first."

function hintLineFor(hint: SearchHint): string {
  if (hint === "number") return t("search.hint.number", { min: String(SONG_NUMBER_MIN), max: String(SONG_NUMBER_MAX) })
  return hint === "words" ? t("search.hint.words") : t("search.hint.feeling")
}

/** The line under the field: it changes once the person types (spec SCR-13). */
export function hintLine(query: string, hint: SearchHint | null = null): string {
  if (query.trim()) return t("search.hint.searching")
  return hint ? hintLineFor(hint) : t("search.hint.idle")
}

/* ---------- why a result matched ---------- */

export type MatchReason =
  | { kind: "number" }
  | { kind: "first_line" }
  | { kind: "word" }
  | { kind: "feeling"; feeling: string }
  | { kind: "meaning" }
  | { kind: "collection"; label: string }

type FeelingKey =
  | "search.feel.peaceful"
  | "search.feel.devoted"
  | "search.feel.longing"
  | "search.feel.joyful"
  | "search.feel.still"
  | "search.feel.grateful"
  | "search.feel.hopeful"
  | "search.feel.sorrowful"
  | "search.feel.awe"

const FEELING_KEYS: Record<string, FeelingKey> = {
  peaceful: "search.feel.peaceful",
  devoted: "search.feel.devoted",
  longing: "search.feel.longing",
  joyful: "search.feel.joyful",
  still: "search.feel.still",
  grateful: "search.feel.grateful",
  hopeful: "search.feel.hopeful",
  sorrowful: "search.feel.sorrowful",
  "in awe": "search.feel.awe",
}

/** The feeling's name in the screen language (the search words stay English). */
function feelingName(label: string): string {
  const key = FEELING_KEYS[label]
  return key ? t(key) : label
}

export function reasonLabel(reason: MatchReason): string {
  switch (reason.kind) {
    case "number":
      return t("search.why.number")
    case "first_line":
      return t("search.why.firstLine")
    case "word":
      return t("search.why.word")
    case "feeling":
      return t("search.why.feeling", { feeling: feelingName(reason.feeling) })
    case "meaning":
      return t("search.why.meaning")
    case "collection":
      return reason.label
  }
}

/** Core hit types to reasons. A `meaning` hit comes from the word glosses, so it is a word match. */
export function reasonFromHit(matchedBy: "opening_line" | "full_text" | "meaning"): MatchReason {
  return matchedBy === "opening_line" ? { kind: "first_line" } : { kind: "word" }
}

export function outOfRangeMessage(): string {
  return t("search.outOfRange", { min: String(SONG_NUMBER_MIN), max: String(SONG_NUMBER_MAX) })
}

/* ---------- recent searches ---------- */

export function withoutRecent(recents: readonly string[], item: string): string[] {
  const key = item.trim().toLowerCase()
  return recents.filter((value) => value.trim().toLowerCase() !== key)
}
