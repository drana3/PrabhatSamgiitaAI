import type { StorageItem } from "@/lib/storageCache"
import { REAL_SONGS_1_TO_7 } from "@/lib/fixtures/realSongs"
import { fixtureSeconds } from "@/lib/fixtures/songs"
import { displayTitle } from "@/lib/songsV2/entry"
import type { StorySheetContent } from "@/lib/songsV2/storySheet"

/**
 * Preview only (MOCKUP_DATA, see lib/mockupMode.ts). Sample state of the design prototype for the
 * Songs, Collections, Mine and Storage screens: what is saved, downloaded, in a playlist, played
 * lately, and the sample stories. Never used when the flag is off.
 *
 * THE SONGS THEMSELVES ARE NOT HERE. The catalog (5,018 songs, real numbers, real titles) is loaded
 * from the API by lib/previewCatalog.ts. Every number below is a real song of that catalog, taken
 * from PS 1 to 7, and every title is the catalog's own (lib/fixtures/realSongs.ts).
 * TODO(api): saved, downloads, playlists, stories and play history are replaced by the real ones.
 */

/** The real title of one of PS 1 to 7, as the Songs screens show it ("Bandhu He Niye Calo"). */
function realTitle(number: number): string {
  const row = REAL_SONGS_1_TO_7.find((r) => r.number === number)
  return row ? displayTitle(row.title) : `Prabhat Samgiita ${number}`
}

/** Prototype `saved: { 1, 3 }`; newest heart last, so Mine lists PS 1 then PS 3. */
export const MOCK_SAVED: readonly number[] = [3, 1]

/** Songs with a download: PS 1, 3 and 6 (the prototype `dl` keys 0-0, 2-0, 2-1, 5-2). */
export const MOCK_OFFLINE: readonly number[] = [1, 3, 6]

export const MOCK_PLAYLISTS: readonly { id: string; name: string; songs: number[] }[] = [
  { id: "mock-0", name: "Morning meditation", songs: [1, 3, 5] },
  { id: "mock-1", name: "Evening kiirtan", songs: [2, 4, 6, 7] },
]

export const MOCK_STORIES: readonly { slug: string; title: string; eyebrow: string; song: number }[] = [
  { slug: "mock-story-0", eyebrow: "Story · 4 min read", title: "The story behind PS 1", song: 1 },
  { slug: "mock-story-1", eyebrow: "Story · 3 min read", title: "Why the songs greet the dawn", song: 3 },
  { slug: "mock-story-2", eyebrow: "Story · 5 min read", title: "Songs sung at the festivals", song: 4 },
]

const STORY_PARAGRAPHS = [
  "Placeholder. The story text comes from the stories database.",
  "A story is short. It says who sang the song, where, and what it meant to the people who heard it.",
  "It ends with the song it belongs to, so the reader can listen right away.",
]

export function mockStoryContent(slug: string | null): StorySheetContent | null {
  const story = MOCK_STORIES.find((s) => s.slug === slug)
  if (!story) return null
  return {
    slug: story.slug,
    eyebrow: story.eyebrow,
    title: story.title,
    paragraphs: STORY_PARAGRAPHS,
    readMinutes: 4,
    songNumber: story.song,
    songHref: `/song-v2/ps-${story.song}`,
    sourceUrl: null,
  }
}

/** Prototype `_mb`: 0.0156 MB a second. */
const mb = (secs: number) => secs * 0.0156

/**
 * Prototype downloads (`dl` 0-0, 2-0, 2-1, 5-2): PS 1 Voice, PS 3 Voice and Guitar, PS 6 Harmonium,
 * 16.9 MB in all. `sub` is the prototype's `PS n · label · who`.
 */
export const MOCK_STORAGE: readonly (StorageItem & { title: string; sub: string })[] = [
  { key: "mock-0-0", songNumber: 1, bytes: mb(fixtureSeconds(1)) * 1048576, modifiedMs: 4, title: realTitle(1), sub: "PS 1 · Voice · Performer A" },
  { key: "mock-2-0", songNumber: 3, bytes: mb(fixtureSeconds(3)) * 1048576, modifiedMs: 3, title: realTitle(3), sub: "PS 3 · Voice · Performer A" },
  { key: "mock-2-1", songNumber: 3, bytes: mb(fixtureSeconds(3) + 22) * 1048576, modifiedMs: 2, title: realTitle(3), sub: "PS 3 · Guitar · Performer B" },
  { key: "mock-5-2", songNumber: 6, bytes: mb(fixtureSeconds(6) - 18) * 1048576, modifiedMs: 1, title: realTitle(6), sub: "PS 6 · Harmonium · Performer C" },
]

/** Songs played lately, newest first (preview of "Recently played"). TODO(api): the real play history. */
export const MOCK_RECENT: readonly number[] = [3, 1, 6, 5, 2]
