/**
 * Routes of the Learn area. Two of them belong to other redesign branches and
 * are linked by path only: the song path (redesign/learn-a-song) and the
 * harmonium screens (redesign/harmonium-notation).
 */
export const LEARN_ROUTES = {
  learn: "/learn",
  words: "/learn/words",
  quiz: "/learn/quiz",
  songs: "/songs-v2",
  /** the learner's own song list: All / Due / Learning / Learned (was the "My songs" tab) */
  mySongs: "/learn/songs",
  /** the picker: every Prabhat Samgiita song, search, tap to add to the Learn list */
  addSong: "/learn/add",
  /** what to study: one song, several, my songs or all (drives the word cards and the quiz) */
  scope: "/learn/scope",
  stories: "/stories",
  about: "/about",
  liveQuiz: "/quiz",
  liveQuizScan: "/quiz/scan",
  harmonium: "/harmonium-v2",
  harmoniumChords: "/harmonium-v2/chords",
  ragaTalaIndex: "/learn/ragas",
} as const

/** Raga and tala index (prototype "Index"), on the Raga or the Tala tab. */
export function indexHref(kind: "raga" | "tala" = "raga"): string {
  return kind === "raga" ? LEARN_ROUTES.ragaTalaIndex : `${LEARN_ROUTES.ragaTalaIndex}?tab=tala`
}

export function songPathHref(songId: string): string {
  return `/learn/song/${songId}`
}

export function songHref(songId: string): string {
  return `/song-v2/${songId}`
}

/** Word cards for one song (SCR-21 step 1), or for all words when no song is given. */
export function wordsHref(options: { song?: number } = {}): string {
  return options.song === undefined ? LEARN_ROUTES.words : `${LEARN_ROUTES.words}?song=${options.song}`
}

/** Quiz level 1 to 3, optionally limited to the words of one song (SCR-21 step 2). */
export function quizHref(options: { level?: number; song?: number } = {}): string {
  const params: string[] = []
  if (options.level && options.level !== 1) params.push(`level=${options.level}`)
  if (options.song !== undefined) params.push(`song=${options.song}`)
  return params.length ? `${LEARN_ROUTES.quiz}?${params.join("&")}` : LEARN_ROUTES.quiz
}

/** Parse a route param that should be a positive integer. */
export function parseNumberParam(value: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return undefined
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}
