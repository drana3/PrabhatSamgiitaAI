import { readMinutes, storyEyebrow } from "./collections"

/** Spec SCR-19: three to six short paragraphs. */
export const STORY_MIN_PARAGRAPHS = 3
export const STORY_MAX_PARAGRAPHS = 6

export type StorySheetContent = {
  slug: string
  eyebrow: string
  title: string
  paragraphs: string[]
  readMinutes: number
  /** the song the "Open the song" button opens; null when the story has none */
  songNumber: number | null
  songHref: string | null
  sourceUrl: string | null
}

function clean(paragraphs: readonly string[]): string[] {
  return paragraphs.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean)
}

/**
 * Brings a story body to at most six paragraphs by joining the shortest
 * neighbouring pair until it fits. Nothing is cut: every word stays.
 * With no body at all, the teaser stands in as the only paragraph.
 */
export function shapeParagraphs(body: readonly string[], teaser = ""): string[] {
  let list = clean(body)
  if (!list.length) list = clean([teaser])
  while (list.length > STORY_MAX_PARAGRAPHS) {
    let at = 0
    let best = Number.POSITIVE_INFINITY
    for (let i = 0; i < list.length - 1; i += 1) {
      const size = list[i].length + list[i + 1].length
      if (size < best) {
        best = size
        at = i
      }
    }
    list = [...list.slice(0, at), `${list[at]} ${list[at + 1]}`, ...list.slice(at + 2)]
  }
  return list
}

export function songHrefFor(songNumber: number | null): string | null {
  return songNumber && songNumber > 0 ? `/song-v2/ps-${songNumber}` : null
}

export function buildStorySheet(story: {
  slug: string
  title: string
  teaser?: string
  body?: readonly string[]
  songNumbers?: readonly number[]
  sourceUrl?: string | null
}): StorySheetContent {
  const paragraphs = shapeParagraphs(story.body ?? [], story.teaser ?? "")
  const minutes = readMinutes(paragraphs)
  const songNumber = story.songNumbers?.find((n) => Number.isFinite(n) && n > 0) ?? null
  return {
    slug: story.slug,
    eyebrow: storyEyebrow(minutes),
    title: story.title,
    paragraphs,
    readMinutes: minutes,
    songNumber,
    songHref: songHrefFor(songNumber),
    sourceUrl: story.sourceUrl?.trim() || null,
  }
}
