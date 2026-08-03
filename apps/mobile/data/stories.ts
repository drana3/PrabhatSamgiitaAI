export type StorySummary = {
  slug: string
  title: string
  author: string
  url: string
  teaser: string
  themes: string[]
  songNumbers: number[]
}

export function mapApiStory(story: {
  slug: string
  title: string
  author: string
  teaser: string
  source_url?: string | null
  themes: string[]
  song_numbers: number[]
}): StorySummary {
  return {
    slug: story.slug,
    title: story.title,
    author: story.author,
    url: story.source_url || `https://prabhatasamgiita.net/${story.slug}.html`,
    teaser: story.teaser,
    themes: story.themes,
    songNumbers: story.song_numbers,
  }
}
