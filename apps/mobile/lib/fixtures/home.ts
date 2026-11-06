import { fixtureSeconds } from "@/lib/fixtures/songs"
import { MOCK_STORIES } from "@/lib/fixtures/songsMock"
import { previewTitleOrNumber } from "@/lib/previewCatalog"
import { formatClock } from "@/lib/navV2"
import { songSub, type HomeCoverId, type StartRow, type StripTone } from "@/lib/homeShelves"

/**
 * Preview only (MOCKUP_DATA, see lib/mockupMode.ts). Sample content for the shelf-style Home, the
 * Search browse view and Notifications. There is no design board for these
 * screens; the songs are real ones (PS 1 to 7 of the catalog, titles from lib/previewCatalog.ts).
 * TODO(api): every list here is replaced by real data (taste, trends, notifications, playlists).
 */

export type HomeSong = { number: number; title: string; sub: string }

function song(number: number): HomeSong {
  // TODO(api): the length is a fixture value until the API sends one (lib/fixtures/songs.ts).
  return { number, title: previewTitleOrNumber(number), sub: songSub(number, formatClock(fixtureSeconds(number))) }
}
export const homeSong = song

/** Where you stopped, then recent plays; today's songs are added by the screen. */
export const HOME_RESUME: StartRow = { ...song(6), sub: "PS 6 · 1:12 of 5:00" }
export const HOME_RECENT_NUMBERS = [1, 4, 5, 2] as const

export type HomeMix = { id: string; label: string; tone: StripTone; caption: string; numbers: number[]; cover: HomeCoverId; browseId: string }

/** "To get you started": coloured label strip across the bottom of each cover. */
export const HOME_MIXES: readonly HomeMix[] = [
  { id: "today", label: "Songs for today", tone: "orange", caption: "Ándhára Sheśe Álora Deshe, Bandhu He Niye Calo and more", numbers: [3, 1, 5], cover: "garland", browseId: "today" },
  { id: "raga", label: "Raga mix", tone: "sage", caption: "Slow, steady songs for a quiet hour", numbers: [7, 6, 3], cover: "lotus", browseId: "meditation" },
  { id: "festival", label: "Festival mix", tone: "gold", caption: "Songs for the festival days of the year", numbers: [4, 2, 6], cover: "portrait", browseId: "festival" },
  { id: "morning", label: "Morning songs", tone: "forest", caption: "Dawn songs to begin the day with", numbers: [2, 3, 1], cover: "lake", browseId: "morning" },
]

export const HOME_BECAUSE_OF = 3
export const HOME_BECAUSE: readonly HomeSong[] = [1, 5, 2, 6, 4, 7].map(song)

export type HomeTrend = HomeSong & { rank: number }
export const HOME_TRENDING: readonly HomeTrend[] = [4, 1, 6, 3, 5].map((n, i) => ({ ...song(n), rank: i + 1 }))

export type HomeStory = { slug: string; title: string; eyebrow: string; blurb: string; cover: number }
export const HOME_STORIES: readonly HomeStory[] = MOCK_STORIES.map((s, i) => ({
  slug: s.slug,
  title: s.title,
  eyebrow: s.eyebrow,
  blurb: "Who sang it, where, and what it meant to the people who heard it.",
  cover: [1, 3, 4][i] ?? 1,
}))

export type HomeLearnCard = { id: string; title: string; caption: string; tone: StripTone; cover: number; target: string }
export const HOME_LEARN: readonly HomeLearnCard[] = [
  { id: "words", title: "Words to repeat", caption: "3 words are due today", tone: "orange", cover: 6, target: "/learn/words" },
  { id: "quiz", title: "Song quiz", caption: "Five questions, two minutes", tone: "sage", cover: 7, target: "/learn/quiz" },
  { id: "paths", title: "Learning paths", caption: "Pronunciation, meaning, harmonium", tone: "gold", cover: 2, target: "/v2/learn" },
]

export const HOME_DOWNLOADED_NUMBERS = [1, 3, 6] as const

/* ---------------------------------------------------------------------- Search browse */

export type BrowseTile = { id: string; label: string; tone: StripTone; cover: number; target: string; art?: "rotate" }

/** Top 2 x 2 tiles. The Kiirtans tile opens the Kiirtan tab. */
export const SEARCH_TOP_TILES: readonly BrowseTile[] = [
  { id: "songs", label: "Songs", tone: "orange", cover: 3, target: "/songs-v2" },
  { id: "stories", label: "Stories", tone: "sage", cover: 1, target: "/stories" },
  { id: "learn", label: "Learn", tone: "gold", cover: 6, target: "/v2/learn" },
  { id: "kiirtans", label: "Kiirtans", tone: "forest", cover: 2, target: "/v2/kiirtan" },
]

export type DiscoverTag = { id: string; tag: string; cover: number; query: string }
/** "Discover something new": tall photo cards, a tap searches the feeling. */
export const SEARCH_DISCOVER: readonly DiscoverTag[] = [
  { id: "longing", tag: "#longing", cover: 4, query: "longing" },
  { id: "devotion", tag: "#devotion", cover: 1, query: "devotion" },
  { id: "surrender", tag: "#surrender", cover: 3, query: "surrender" },
  { id: "morning", tag: "#morning", cover: 2, query: "morning" },
  { id: "kirtan", tag: "#kiirtan", cover: 6, query: "kiirtan" },
]
