/**
 * TODO(api): sample stories of the design prototype (`STO` and `stCur` in Main.dc.html). They stand in when the
 * stories API cannot be reached (offline, dev without a backend), so the sheet is never empty. Nothing here is
 * reviewed content: the paragraphs are the prototype's own placeholder text.
 */
import { buildStorySheet, type StorySheetContent } from "@/lib/songsV2/storySheet"

type FixtureStory = { title: string; minutes: number; song: number }

const STORIES: FixtureStory[] = [
  { title: "The story behind PS 1", minutes: 4, song: 1 },
  { title: "Why the songs greet the dawn", minutes: 3, song: 3 },
  { title: "Songs sung at the festivals", minutes: 5, song: 4 },
]

const PARAGRAPHS = [
  "Placeholder. The story text comes from the stories database.",
  "A story is short. It says who sang the song, where, and what it meant to the people who heard it.",
  "It ends with the song it belongs to, so the reader can listen right away.",
]

/** The prototype story a slug stands for: stable by the slug text, so the same link shows the same sample. */
export function fixtureStory(slug: string | null): StorySheetContent {
  let hash = 0
  for (const ch of slug ?? "") hash = (hash * 31 + ch.charCodeAt(0)) % 9973
  const story = STORIES[hash % STORIES.length]!
  const content = buildStorySheet({
    slug: slug ?? "sample",
    title: story.title,
    body: PARAGRAPHS,
    songNumbers: [story.song],
  })
  return { ...content, eyebrow: `Story · ${story.minutes} min read`, readMinutes: story.minutes }
}
