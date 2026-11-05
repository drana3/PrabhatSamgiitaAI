import { getActiveLanguage, translatorFor, type TranslateFn } from "@/lib/i18n"

import { isRead, type ReadMap } from "./readState"
import { primarySong, type Story } from "./types"

export type StoryFilter = "all" | "unread"

export const STORY_CHIPS: readonly { id: StoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
]

export const EMPTY_STORIES_TEXT = "No stories match. Try a title, a PS number or a song name."

/** Song order (lowest PS number first), stories without a song last; ties by title. */
export function sortStories(stories: readonly Story[]): Story[] {
  const key = (s: Story) => primarySong(s) ?? Number.POSITIVE_INFINITY
  return [...stories].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function words(value: string): string[] {
  return fold(value).split(/[^a-z0-9]+/).filter(Boolean)
}

/**
 * Search by title, PS number ("ps 3", "3") and song title. Every word of the query has to match: a word of
 * letters matches the start of a word, a number matches a number exactly (so "3" finds PS 3, not PS 30).
 */
export function matchesStory(story: Story, query: string, songTitle: (n: number) => string | undefined): boolean {
  const tokens = words(query)
  if (tokens.length === 0) return true
  const hay = [
    ...words(story.title),
    ...story.songNumbers.flatMap((n) => ["ps", String(n), ...words(songTitle(n) ?? "")]),
  ]
  return tokens.every((token) =>
    /^\d+$/.test(token) ? hay.includes(token) : hay.some((word) => word.startsWith(token)),
  )
}

export function filterStories(
  stories: readonly Story[],
  opts: { query: string; filter: StoryFilter; read: ReadMap; songTitle?: (n: number) => string | undefined },
): Story[] {
  const songTitle = opts.songTitle ?? (() => undefined)
  return stories.filter(
    (s) => (opts.filter === "all" || !isRead(opts.read, s.slug)) && matchesStory(s, opts.query, songTitle),
  )
}

/** The story to put first: the first one not read yet, or the first when everything is read. */
export function featuredStory(sorted: readonly Story[], read: ReadMap): Story | null {
  return sorted.find((s) => !isRead(read, s.slug)) ?? sorted[0] ?? null
}

/**
 * The story after `slug`: the next unread one going forward (and around the end), or simply the next one when
 * everything is read. Null when there is no other story.
 */
export function nextStory(sorted: readonly Story[], slug: string, read: ReadMap): Story | null {
  const at = sorted.findIndex((s) => s.slug === slug)
  if (sorted.length < 2) return null
  const start = at < 0 ? 0 : at + 1
  const order = sorted.map((_, i) => sorted[(start + i) % sorted.length]).filter((s) => s.slug !== slug)
  return order.find((s) => !isRead(read, s.slug)) ?? order[0] ?? null
}

export function storiesCountLabel(
  shown: number,
  total: number,
  filter: StoryFilter,
  unread: number,
  t: TranslateFn = translatorFor(getActiveLanguage()),
): string {
  if (total === 0) return ""
  if (filter === "unread") return t("stories.unreadCount", { count: unread })
  return shown === total ? t("stories.count", { count: total }) : t("stories.shownOf", { shown, total })
}
