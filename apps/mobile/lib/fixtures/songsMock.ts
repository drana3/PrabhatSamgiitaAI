import type { StorageItem } from "@/lib/storageCache"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import type { StorySheetContent } from "@/lib/songsV2/storySheet"

/**
 * Preview only (MOCKUP_DATA, see lib/mockupMode.ts). The sample data of the design prototype,
 * copied from `_songs()`, `renderVals` and `_recs()` in Main.dc.html, so the Songs, Collections,
 * Mine and Storage screens can be put next to the boards. Never used when the flag is off.
 * TODO(api): every list here is replaced by the real catalog, stories, playlists and files.
 */

type MockSong = { n: number; title: string; secs: number; tag: string; tags: string[] }

function buildSongs(): MockSong[] {
  const mk = (n: number, title: string, secs: number, tag: string, tags: string[]): MockSong => ({ n, title, secs, tag, tags })
  const songs = [
    mk(1, "Bandhu He Niye Calo", 238, "Guidance", ["guidance", "devotion", "longing"]),
    mk(2, "E Gán Ámár, Álor Jharańá Dhárá", 252, "Light", ["dawn", "joy", "peaceful"]),
    mk(3, "Ándhára Sheśe Álora Deshe", 271, "Light", ["guidance", "dawn", "peaceful"]),
    mk(4, "Sakal Maner Viińá Ek Sure Báje Áj", 305, "Devotion", ["devotion", "joy"]),
    mk(5, "Elo, Anek Juger Sei Ajáná Pathik", 226, "Longing", ["longing", "guidance"]),
    mk(6, "Bandhu Ámár", 300, "Devotion", ["devotion", "longing", "surrender"]),
    mk(7, "Niiravatá Májhe Ke Go Tumi Ele", 284, "Silence", ["peaceful", "nature", "surrender"]),
  ]
  const A1 = ["Ánanda", "Madhur", "Prem", "Áloke", "Sándhya", "Prabháte", "Sháran", "Bhakti", "Niilá", "Sudhá", "Manera", "Dhyáner", "Karuńá", "Jyotir", "Sargam", "Támasii"]
  const A2 = ["Dháráy", "Gán", "Sure", "Pathe", "Vináy", "Tarańge", "Nikuñje", "Smaran", "Mantre", "Amiyá", "Sparshe", "Bandaná"]
  const TG = ["devotion", "dawn", "nature", "longing", "surrender", "peaceful", "joy", "guidance"]
  const TL = ["Devotion", "Light", "Nature", "Longing", "Surrender", "Silence", "Joy", "Guidance"]
  for (let i = 7; i < 64; i++) {
    const n = Math.round(7 + (i - 6) * (5011 / 57))
    songs.push(mk(n, A1[i % 16] + " " + A2[(i * 5) % 12] + (i % 3 === 0 ? " Áj" : ""), 180 + ((i * 53) % 170), TL[i % 8], [TG[i % 8], TG[(i + 3) % 8]]))
  }
  return songs
}

export const MOCK_SONGS: readonly MockSong[] = buildSongs()

/** The catalog is 5,018 songs; the sample shows 64 of them. */
export const MOCK_TOTAL = 5018

export function mockEntries(): CatalogEntry[] {
  return MOCK_SONGS.map((song, i) => ({
    number: song.n,
    title: song.title,
    firstLine: null,
    category: song.tag,
    language: null,
    durationSeconds: song.secs,
    hasAudio: true,
    hasDevanagari: null,
    // the prototype sorts "Recently added" by (i * 37) % 64 ascending
    addedRank: MOCK_SONGS.length - ((i * 37) % MOCK_SONGS.length),
    plays: (song.n * 7919) % 1000,
  }))
}

/** Category strip of the prototype: All and five moods. */
export const MOCK_STRIP: readonly { id: string; label: string }[] = [
  { id: "all", label: "All" },
  ...["devotion", "dawn", "nature", "longing", "surrender"].map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) })),
]

export function mockChipNumbers(chip: string): Set<number> {
  return new Set(MOCK_SONGS.filter((s) => s.tags.includes(chip)).map((s) => s.n))
}

/** `5,018 songs`, or `N of the sample, devotion` under a chip (prototype `catCount`). */
export function mockCountLabel(chip: string, shown: number): string {
  return chip === "all" ? "5,018 songs" : `${shown} of the sample, ${chip}`
}

/** Prototype `saved: { 1, 3 }`; newest heart last, so Mine lists PS 1 then PS 3. */
export const MOCK_SAVED: readonly number[] = [3, 1]

/** Songs with a download: PS 1, 3 and 6 (the prototype `dl` keys 0-0, 2-0, 2-1, 5-2). */
export const MOCK_OFFLINE: readonly number[] = [1, 3, 6]

export const MOCK_PLAYLISTS: readonly { id: string; name: string; songs: number[] }[] = [
  { id: "mock-0", name: "Morning meditation", songs: [1, 3, 5] },
  { id: "mock-1", name: "Evening kiirtan", songs: [2, 4, 6, 7] },
]

export const MOCK_FESTIVALS: readonly { id: string; label: string; eyebrow: string; count: number; songNumbers: number[] }[] = [
  { label: "Ánanda Púrńimá", count: 8 },
  { label: "Dharma Mahácakra", count: 6 },
  { label: "Dola Púrńimá", count: 5 },
  { label: "Díipávalii", count: 7 },
].map((f, i) => ({
  id: `mock-fest-${i}`,
  label: f.label,
  eyebrow: `Festival · ${f.count} songs`,
  count: f.count,
  songNumbers: [3, 1, 5, 2, 4, 6, 7, 3].slice(0, f.count),
}))

export const MOCK_TILES: readonly { id: string; label: string; tone: "olive" | "white"; countLabel: string }[] = [
  { id: "kiirtan", label: "Kiirtan", tone: "olive", countLabel: "124 songs" },
  { id: "dhyana", label: "Dhyána", tone: "white", countLabel: "86 songs" },
  { id: "morning", label: "Morning", tone: "white", countLabel: "61 songs" },
  { id: "evening", label: "Evening", tone: "olive", countLabel: "54 songs" },
  { id: "nature", label: "Nature", tone: "olive", countLabel: "43 songs" },
  { id: "children", label: "Children", tone: "white", countLabel: "38 songs" },
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
  { key: "mock-0-0", songNumber: 1, bytes: mb(238) * 1048576, modifiedMs: 4, title: "Bandhu He Niye Calo", sub: "PS 1 · Voice · Performer A" },
  { key: "mock-2-0", songNumber: 3, bytes: mb(271) * 1048576, modifiedMs: 3, title: "Ándhára Sheśe Álora Deshe", sub: "PS 3 · Voice · Performer A" },
  { key: "mock-2-1", songNumber: 3, bytes: mb(271 + 22) * 1048576, modifiedMs: 2, title: "Ándhára Sheśe Álora Deshe", sub: "PS 3 · Guitar · Performer B" },
  { key: "mock-5-2", songNumber: 6, bytes: mb(300 - 18) * 1048576, modifiedMs: 1, title: "Bandhu Ámár", sub: "PS 6 · Harmonium · Performer C" },
]

/** Songs played lately, newest first (preview of "Recently played"). TODO(api): the real play history. */
export const MOCK_RECENT: readonly number[] = [3, 1, 6, 5, 2]

/** Preview of the Morning / Evening / Festival / Meditation chips: the prototype tags that fit each. TODO(api). */
const MOCK_CATEGORY_TAG: Record<string, string> = { morning: "dawn", evening: "longing", festival: "joy", meditation: "peaceful" }

export function mockCategoryNumbers(category: string): Set<number> {
  const tag = MOCK_CATEGORY_TAG[category]
  return tag ? mockChipNumbers(tag) : new Set()
}

/**
 * Songs of a collection in the preview. The real ids (morning, festival, a collection label) point at
 * song numbers the 64-song sample does not hold, so the preview takes the sample songs that fit.
 */
export function mockCollectionNumbers(id: string): number[] {
  const key = id.toLowerCase()
  const tag = Object.entries(MOCK_CATEGORY_TAG).find(([name]) => key.includes(name))?.[1]
  const pool = MOCK_SONGS.filter((s) => (tag ? s.tags.includes(tag) : s.tags.includes(key) || s.tag.toLowerCase() === key))
  const picked = pool.length ? pool : MOCK_SONGS.filter((_, i) => i % 3 === (key.length % 3))
  return picked.map((s) => s.n)
}
