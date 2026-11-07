import type { Story } from "@/lib/stories/types"

/**
 * TODO(api): SAMPLE stories for the Stories pages while the stories API is not reachable or under MOCKUP_DATA.
 * Nothing here is reviewed content and none of it is a statement about a song, its author or its history: every
 * story opens with "Sample story, text to be replaced by the editors." and the paragraphs below only describe how
 * a story page reads and how to listen. The real texts come from the editors' team and the stories database.
 * The first three slugs and titles are the ones the Today shelf and the story sheet already show
 * (lib/fixtures/songsMock.ts MOCK_STORIES).
 */

const SAMPLE = "Sample story, text to be replaced by the editors."

/** Generic reading and listening notes: filler that makes a page long enough to read and scroll. */
const NOTES = {
  format:
    "A story on this page is short. It is meant to be read in a few minutes, on a phone, in a quiet moment, and then to send the reader back to the song with fresh ears.",
  listen:
    "One way to use a story is to listen to the song once before reading, without following any words. Then read the story, and listen again. The second listening is often a different experience from the first.",
  words:
    "Songs are made of words and sound together. If the words are new to you, read them slowly, one line at a time, and let the meaning arrive before you try to sing along. There is no hurry.",
  quote: "> A sentence from the story is lifted out here, in larger type. The editors choose it.",
  repeat:
    "Repetition is how a song settles in. Sing a line, rest, sing it again. After a few rounds the tune carries itself and the attention is free to rest on the meaning.",
  morning:
    "Many people keep one song for the start of the day. A few minutes with the same song each morning makes it a familiar room to walk into, and the days begin to share a calm beginning.",
  group:
    "Songs are sung alone and together. Alone, the voice can be quiet and unhurried. Together, the voices find a common pace, and the song becomes something shared by everyone in the room.",
  end: "When the story ends, the song is one tap away. This page keeps your place, so you can come back to the rest of the stories whenever you like.",
} as const

function story(
  index: number,
  title: string,
  teaser: string,
  songNumbers: number[],
  notes: readonly (keyof typeof NOTES)[],
): Story {
  return {
    slug: `mock-story-${index}`,
    title,
    teaser,
    author: "Sample text",
    themes: ["sample"],
    songNumbers,
    sourceUrl: null,
    paragraphs: [SAMPLE, ...notes.map((key) => NOTES[key])],
  }
}

export const FIXTURE_STORIES: readonly Story[] = [
  story(0, "The story behind PS 1", "Sample text. How a story page reads, and how to come back to the song.", [1], ["format", "listen", "quote", "words", "repeat", "end"]),
  story(1, "Why the songs greet the dawn", "Sample text. A few quiet minutes with one song at the start of the day.", [3], ["morning", "listen", "quote", "repeat", "end"]),
  story(2, "Songs sung at the festivals", "Sample text. Songs are sung alone and together.", [4], ["group", "format", "quote", "words", "morning", "listen", "end"]),
  story(3, "The story behind PS 2", "Sample text. Reading the words slowly, one line at a time.", [2], ["words", "repeat", "quote", "format", "end"]),
  story(4, "A first listening of PS 5", "Sample text. Listen once without the words, then once with them.", [5], ["listen", "words", "quote", "group", "repeat", "end"]),
  story(5, "The story behind PS 6", "Sample text. Why a song settles in with repetition.", [6], ["repeat", "morning", "quote", "format", "group", "end"]),
]

export function fixtureStoryBySlug(slug: string): Story | null {
  return FIXTURE_STORIES.find((s) => s.slug === slug) ?? null
}
