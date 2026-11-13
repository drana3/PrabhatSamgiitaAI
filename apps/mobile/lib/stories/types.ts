/**
 * A story behind a song, as the Stories pages use it. The API gives a summary list (no body) and a detail
 * (with `paragraphs`); the fixtures (lib/fixtures/stories.ts) give both at once.
 */
export type Story = {
  slug: string
  title: string
  teaser: string
  author: string
  themes: string[]
  /** the PS numbers the story is about; the first one is "the song" of the story */
  songNumbers: number[]
  sourceUrl: string | null
  /** full text; empty on an API list row until the detail is loaded */
  paragraphs: string[]
}

/** The first song a story is about, or null. */
export function primarySong(story: Pick<Story, "songNumbers">): number | null {
  return story.songNumbers.find((n) => Number.isFinite(n) && n > 0) ?? null
}
