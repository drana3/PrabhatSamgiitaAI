import { buildStorySheet, type StorySheetContent } from "./storySheet"

export type StoryDetailLike = {
  slug: string
  title: string
  teaser: string
  source_url?: string | null
  song_numbers: number[]
  body_paragraphs: string[]
}

/**
 * Loads a story once and remembers it, so the Collections rows can show a
 * read time and the sheet opens with its text already there. A failed load
 * is not cached, so a retry can succeed.
 */
export function createStoryLoader(fetchStory: (slug: string) => Promise<StoryDetailLike | null>) {
  const pending = new Map<string, Promise<StorySheetContent | null>>()
  const done = new Map<string, StorySheetContent>()

  function load(slug: string): Promise<StorySheetContent | null> {
    const cached = done.get(slug)
    if (cached) return Promise.resolve(cached)
    const inflight = pending.get(slug)
    if (inflight) return inflight
    const promise = fetchStory(slug)
      .then((detail) => {
        if (!detail) return null
        const content = buildStorySheet({
          slug: detail.slug,
          title: detail.title,
          teaser: detail.teaser,
          body: detail.body_paragraphs,
          songNumbers: detail.song_numbers,
          sourceUrl: detail.source_url,
        })
        done.set(slug, content)
        return content
      })
      .catch(() => null)
      .finally(() => pending.delete(slug))
    pending.set(slug, promise)
    return promise
  }

  return {
    load,
    peek: (slug: string): StorySheetContent | null => done.get(slug) ?? null,
    peekMinutes: (slug: string): number | null => done.get(slug)?.readMinutes ?? null,
    /** Warms the first `limit` slugs, `concurrency` at a time. */
    async prefetch(slugs: readonly string[], limit = 6, concurrency = 2): Promise<void> {
      const queue = slugs.slice(0, limit)
      const worker = async () => {
        for (let slug = queue.shift(); slug !== undefined; slug = queue.shift()) await load(slug)
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
    },
  }
}
