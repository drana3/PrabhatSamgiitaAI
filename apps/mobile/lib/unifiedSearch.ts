import type { SongSummary } from "@prabhat/core"

import type { MockSong } from "@/data/mock"
import { allCollections, type CollectionItem } from "@/data/collections"
import {
  collectionForCategory,
  resolveCategoryQuery,
  songNumbersForCategory,
} from "@/lib/categorySongs"
import {
  catalogSongByNumber,
  catalogSongsByNumbers,
  normalizeLyricText,
  searchCatalogGlosses,
  searchCatalogLyrics,
  type LyricSearchHit,
} from "@/lib/lyricSearch"
import { songSummaryToMockSong } from "@/lib/songMap"
import {
  classifyQuery,
  outOfRangeMessage,
  reasonFromHit,
  shouldShowAnswer,
  type MatchReason,
  type QueryClass,
} from "@/lib/unifiedSearchQuery"

/**
 * Local, instant half of the unified search (spec SCR-13). One query goes in;
 * results come out in the spec's group order, each row saying why it matched.
 * Meaning results from the server are merged in later with `mergeMeaningRows`.
 */

export type SearchGroupId = "number" | "lyrics" | "meaning" | "collections"

export const GROUP_ORDER: readonly SearchGroupId[] = ["number", "lyrics", "meaning", "collections"]

export const GROUP_TITLES: Record<SearchGroupId, string> = {
  number: "Exact number",
  lyrics: "Lyrics matches",
  meaning: "Matches by meaning",
  collections: "Collections",
}

export type SearchResultItem = {
  song: MockSong
  reason: MatchReason
  /** the line that matched, or the first line */
  line: string
}

export type CollectionHit = { label: string; count: number }

export type SearchGroup = {
  id: SearchGroupId
  title: string
  items: SearchResultItem[]
  /** collections whose name matches; tapping one fills the field with its name */
  collections?: CollectionHit[]
}

export type AnswerCard = {
  /** the question as typed */
  question: string
  /** source-linked songs, best first */
  sources: SearchResultItem[]
}

export type UnifiedResult = {
  query: string
  cls: QueryClass
  groups: SearchGroup[]
  answer: AnswerCard | null
  total: number
  /** a plain sentence for the empty or out-of-range case, else null */
  message: string | null
  /** true when the server's meaning search is worth asking for (feeling, question, or nothing found) */
  wantsMeaning: boolean
}

export const LYRIC_LIMIT = 8
export const MEANING_LIMIT = 6
export const COLLECTION_SONG_LIMIT = 10
const MAX_COLLECTION_NAMES = 3

function itemFromHit(hit: LyricSearchHit, reason: MatchReason, index: number): SearchResultItem {
  return {
    song: songSummaryToMockSong(
      {
        number: hit.number,
        title: hit.title || hit.firstLine,
        first_line: hit.snippet || hit.firstLine || hit.title,
        is_verified: true,
      },
      index,
    ),
    reason,
    line: hit.snippet || hit.firstLine || hit.title,
  }
}

function itemFromSummary(row: SongSummary, reason: MatchReason, index: number): SearchResultItem {
  return {
    song: songSummaryToMockSong(row, index),
    reason,
    line: row.first_line ?? row.title,
  }
}

function emptyResult(query: string, cls: QueryClass, message: string | null = null): UnifiedResult {
  return { query, cls, groups: [], answer: null, total: 0, message, wantsMeaning: false }
}

/** Collections whose name starts a word like the query does ("krs" finds Krśńa Songs). */
export function matchingCollections(query: string, limit = MAX_COLLECTION_NAMES): CollectionItem[] {
  const needle = normalizeLyricText(query)
  if (needle.length < 3) return []
  return allCollections
    .filter((item) =>
      normalizeLyricText(item.label)
        .split(" ")
        .some((word) => word.startsWith(needle)),
    )
    .slice(0, limit)
}

function exactCollection(query: string): CollectionItem | undefined {
  const id = resolveCategoryQuery(query)
  return collectionForCategory(id ?? query.trim())
}

function total(groups: SearchGroup[]): number {
  return groups.reduce((sum, group) => sum + group.items.length, 0)
}

function sortGroups(groups: SearchGroup[]): SearchGroup[] {
  return [...groups].sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id))
}

export function searchLocal(query: string): UnifiedResult {
  const trimmed = query.trim()
  const cls = classifyQuery(trimmed)
  if (cls.kind === "empty") return emptyResult(trimmed, cls)

  if (cls.kind === "number") {
    if (cls.outOfRange) return emptyResult(trimmed, cls, outOfRangeMessage())
    const hit = catalogSongByNumber(trimmed)
    if (!hit) return emptyResult(trimmed, cls, "No Prabhat Samgiita song has that number.")
    const items = [itemFromHit(hit, { kind: "number" }, 0)]
    return {
      query: trimmed,
      cls,
      groups: [{ id: "number", title: GROUP_TITLES.number, items }],
      answer: null,
      total: 1,
      message: null,
      wantsMeaning: false,
    }
  }

  const seen = new Set<number>()
  const take = (items: SearchResultItem[]): SearchResultItem[] =>
    items.filter((item) => {
      if (seen.has(item.song.number)) return false
      seen.add(item.song.number)
      return true
    })

  // Lyrics: opening lines, full text, and word glosses ("friend" finds PS 1).
  const hits = [
    ...searchCatalogLyrics(trimmed, LYRIC_LIMIT, { interpret: true }),
    ...searchCatalogGlosses(trimmed, MEANING_LIMIT).map(
      (hit): LyricSearchHit => ({ ...hit, matchedBy: "meaning" }),
    ),
  ]
  const meaningIsolated = cls.kind === "feeling" || cls.kind === "question"
  const lyricItems: SearchResultItem[] = []
  const hitMeaningItems: SearchResultItem[] = []
  hits.forEach((hit, index) => {
    const item = itemFromHit(hit, reasonFromHit(hit.matchedBy), index)
    if (hit.matchedBy === "meaning" && meaningIsolated) hitMeaningItems.push(item)
    else lyricItems.push(item)
  })

  // Feelings: bundled mood lists, so a guest gets results with no network.
  const feelingItems: SearchResultItem[] = []
  if (meaningIsolated) {
    for (const feeling of cls.feelings.slice(0, 2)) {
      const numbers = songNumbersForCategory(feeling.moodId)
      const moodHits = catalogSongsByNumbers(numbers, MEANING_LIMIT)
      moodHits.forEach((hit, index) =>
        feelingItems.push(itemFromHit(hit, { kind: "feeling", feeling: feeling.label }, index)),
      )
    }
  }

  // Collections: an exact one lists its songs; partial name matches are tappable names.
  const exact = cls.kind === "words" || cls.kind === "feeling" ? exactCollection(trimmed) : undefined
  const collectionSongs: SearchResultItem[] = exact
    ? catalogSongsByNumbers(exact.songNumbers, COLLECTION_SONG_LIMIT).map((hit, index) =>
        itemFromHit(hit, { kind: "collection", label: exact.label }, index),
      )
    : []
  const nameHits: CollectionHit[] = matchingCollections(trimmed)
    .filter((item) => item.label !== exact?.label)
    .map((item) => ({ label: item.label, count: item.count }))
  if (exact) nameHits.unshift({ label: exact.label, count: exact.count })

  const lyrics = take(lyricItems)
  const meaning = take([...hitMeaningItems, ...feelingItems]).slice(0, MEANING_LIMIT)
  const collectionRows = take(collectionSongs)

  const groups: SearchGroup[] = []
  if (lyrics.length) groups.push({ id: "lyrics", title: GROUP_TITLES.lyrics, items: lyrics })
  if (meaning.length) groups.push({ id: "meaning", title: GROUP_TITLES.meaning, items: meaning })
  if (collectionRows.length || nameHits.length) {
    groups.push({
      id: "collections",
      title: GROUP_TITLES.collections,
      items: collectionRows,
      collections: nameHits,
    })
  }

  const lexical = lyrics.length
  const answer = shouldShowAnswer(trimmed, lexical)
    ? { question: trimmed, sources: [...meaning, ...lyrics].slice(0, 3) }
    : null

  const sorted = sortGroups(groups)
  const count = total(sorted)
  return {
    query: trimmed,
    cls,
    groups: sorted,
    answer,
    total: count,
    message: count === 0 && !answer ? "Nothing matched yet. Try a few words from the song, or how you feel." : null,
    wantsMeaning: meaningIsolated || lexical === 0,
  }
}

/** Merge server meaning matches in after the local results are already on screen. */
export function mergeMeaningRows(
  result: UnifiedResult,
  rows: SongSummary[],
  limit = MEANING_LIMIT,
): UnifiedResult {
  if (!rows.length) return result
  const have = new Set<number>()
  for (const group of result.groups) for (const item of group.items) have.add(item.song.number)

  const feeling = result.cls.feeling
  const reason: MatchReason = feeling ? { kind: "feeling", feeling: feeling.label } : { kind: "meaning" }
  const existing = result.groups.find((group) => group.id === "meaning")
  const room = limit - (existing?.items.length ?? 0)
  if (room <= 0) return result
  const added = rows
    .filter((row) => !have.has(row.number))
    .slice(0, room)
    .map((row, index) => itemFromSummary(row, reason, index))
  if (!added.length) return result

  const meaning: SearchGroup = existing
    ? { ...existing, items: [...existing.items, ...added] }
    : { id: "meaning", title: GROUP_TITLES.meaning, items: added }
  const groups = sortGroups([...result.groups.filter((group) => group.id !== "meaning"), meaning])
  const answer =
    result.answer && result.answer.sources.length === 0
      ? { ...result.answer, sources: added.slice(0, 3) }
      : result.answer
  return { ...result, groups, answer, total: total(groups), message: null }
}
