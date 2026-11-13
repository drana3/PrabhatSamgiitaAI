import type { Story } from "./types"

type ApiStory = {
  slug: string
  title: string
  author: string
  teaser: string
  source_url?: string | null
  themes?: string[]
  song_numbers?: number[]
  body_paragraphs?: string[]
}

/** An API story (list row or detail) as a `Story`. A list row has no body: `paragraphs` is empty. */
export function storyFromApi(row: ApiStory): Story {
  return {
    slug: row.slug,
    title: row.title.trim(),
    teaser: row.teaser.trim(),
    author: row.author,
    themes: row.themes ?? [],
    songNumbers: (row.song_numbers ?? []).filter((n) => Number.isFinite(n) && n > 0),
    sourceUrl: row.source_url?.trim() || null,
    paragraphs: (row.body_paragraphs ?? []).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean),
  }
}
