import type { MockSong } from "@/data/mock"
import type { StorySummary } from "@/data/stories"
import type { RecentPlay } from "@/stores/preferencesStore"

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

/** Rows of "Find a song your way". They open search; `hint` lets search prefill its field. */
export const TODAY_FIND_ROWS = [
  { id: "number", title: "By number", hint: "PS 1 to PS 5018", href: "/search?focus=1&hint=number" },
  { id: "words", title: "By words", hint: "A line you remember", href: "/search?focus=1&hint=words" },
  { id: "feeling", title: "By feeling", hint: "Peace, longing, joy", href: "/search?focus=1&hint=feeling" },
] as const

export type TodayResume =
  | { kind: "resume"; song: MockSong }
  | { kind: "songOfDay"; song: MockSong }

export type TodayView = {
  hero: MockSong | null
  resume: TodayResume | null
  recent: MockSong[]
}

export function formatTodayEyebrow(now: Date): string {
  return `TODAY'S SONG / ${now.getDate()} ${MONTHS[now.getMonth()]}`
}

export function recentPlayToSong(play: RecentPlay): MockSong {
  return {
    id: play.id,
    number: play.number,
    title: play.title,
    shortDescription: play.title,
    imageUrl: play.thumbnailUrl,
    thumbnailUrl: play.thumbnailUrl,
    themes: play.themes.length ? play.themes : ["Prabhat Samgiita"],
    meaning: "",
    lyrics: "",
    translation: "",
    durationSeconds: 300,
    performer: "Prabhat Samgiita Collection",
    videos: [],
  }
}

/** Played share of the current song, 0..1. */
export function resumeProgress(positionSeconds: number, durationSeconds: number): number {
  if (!(durationSeconds > 0)) return 0
  return Math.min(1, Math.max(0, positionSeconds / durationSeconds))
}

/**
 * What the Today screen shows (spec SCR-10).
 * - hero: song of the day, else the last played song
 * - resume: last played song, else the song of the day; null when nothing is loaded
 * - recent: three songs after the one being resumed; empty without history
 */
export function buildTodayView(input: {
  recommended: MockSong[]
  recentPlays: RecentPlay[]
  now: Date
}): TodayView {
  const recentSongs = input.recentPlays.map(recentPlayToSong)
  const songOfDay = input.recommended[0] ?? null
  const hero = songOfDay ?? recentSongs[0] ?? null

  let resume: TodayResume | null = null
  if (recentSongs.length) resume = { kind: "resume", song: recentSongs[0] }
  else if (songOfDay) resume = { kind: "songOfDay", song: songOfDay }

  return { hero, resume, recent: recentSongs.slice(1, 4) }
}

/** Week number since 1 Jan 1970 (Thursday-based), stable across the whole week. */
function weekIndex(now: Date): number {
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000)
  return Math.floor((day + 3) / 7)
}

/** One story that stays the same all week and changes on Monday. */
export function storyOfTheWeek(stories: StorySummary[], now: Date): StorySummary | null {
  if (!stories.length) return null
  return stories[weekIndex(now) % stories.length]
}
