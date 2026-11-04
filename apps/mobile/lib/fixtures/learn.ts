/**
 * TODO(api): placeholder content of the Learn area, copied from the design prototype
 * (Main.dc.html: `_songs`, LIBD, QZ, RAGA, TALA). The catalog API has no word glosses,
 * quiz bank, raga or tala index yet. Replace each export when its endpoint exists.
 */
import { newCard, type WordCard } from "@/lib/learn/srs"
import { EMPTY_PATH, type LearningSong, type PathState } from "@/lib/learn/progress"
import { wordId } from "@/lib/learn/words"
import type { LearnQuizQuestion } from "@/lib/learn/quiz"

/** PS 1 to 7: the catalog's own titles, as in the prototype. */
export const LEARN_SONG_TITLES: Record<number, string> = {
  1: "Bandhu He Niye Calo",
  2: "E Gán Ámár, Álor Jharańá Dhárá",
  3: "Ándhára Sheśe Álora Deshe",
  4: "Sakal Maner Viińá Ek Sure Báje Áj",
  5: "Elo, Anek Juger Sei Ajáná Pathik",
  6: "Bandhu Ámár",
  7: "Niiravatá Májhe Ke Go Tumi Ele",
}

export function learnSongTitle(number: number): string {
  return LEARN_SONG_TITLES[number] ?? `Song ${number}`
}

/**
 * The sample library of the prototype: PS 2, 4 and 6 learned (memory strength 1 to 5,
 * PS 4 due today), PS 1 and 3 in progress. Song-level review strength and the "next
 * review" line do not exist in the logic yet, only word cards do.
 */
export const LIBRARY_DEMO: ReadonlyArray<{
  number: number
  learned: boolean
  strength?: 1 | 2 | 3 | 4 | 5
  next?: string
  due?: boolean
}> = [
  { number: 2, learned: true, strength: 4, next: "Next review in 6 days" },
  { number: 4, learned: true, strength: 3, next: "Review due today", due: true },
  { number: 6, learned: true, strength: 5, next: "Next review in 12 days" },
  { number: 1, learned: false },
  { number: 3, learned: false },
]

export function demoLibraryEntry(number: number) {
  return LIBRARY_DEMO.find((entry) => entry.number === number)
}

/** Level 1 sample quiz: three questions. The real quiz has 10 and a pass mark of 7. */
export const SAMPLE_QUIZ_PASS_MARK = 2
export const SAMPLE_QUIZ: LearnQuizQuestion[] = [
  {
    id: "q1",
    prompt: 'What does "Bandhu" mean?',
    options: [
      { id: "a", text: "Friend" },
      { id: "b", text: "River" },
      { id: "c", text: "Morning" },
      { id: "d", text: "Song" },
    ],
    correctOptionId: "a",
    explanation: "Bandhu is friend. PS 1 opens with it.",
  },
  {
    id: "q2",
    prompt: 'What does "Álo" mean?',
    options: [
      { id: "a", text: "Darkness" },
      { id: "b", text: "Path" },
      { id: "c", text: "Light" },
      { id: "d", text: "Land" },
    ],
    correctOptionId: "c",
    explanation: "Álo is light.",
  },
  {
    id: "q3",
    prompt: 'What does "Ándhára" mean?',
    options: [
      { id: "a", text: "Darkness" },
      { id: "b", text: "Hand" },
      { id: "c", text: "Dawn" },
      { id: "d", text: "Friend" },
    ],
    correctOptionId: "a",
    explanation: "Ándhára is darkness. PS 3 starts there.",
  },
]

/** name, time of day, songs */
export const RAGAS: ReadonlyArray<readonly [string, string, number]> = [
  ["Bhairavii", "Morning", 14],
  ["Yaman", "Evening", 9],
  ["Bhairav", "Dawn", 11],
  ["Káfi", "Night", 8],
  ["Khamáj", "Night", 7],
  ["Desh", "Rainy season", 6],
  ["Bilával", "Morning", 10],
  ["Pilu", "Any time", 12],
]

/** name, beats. The song counts are placeholders: 14, 12, 10, 8, 6, 4. */
export const TALAS: ReadonlyArray<readonly [string, string]> = [
  ["Keharva", "8 beats"],
  ["Dádrá", "6 beats"],
  ["Rúpak", "7 beats"],
  ["Jhaptál", "10 beats"],
  ["Ektál", "12 beats"],
  ["Tintál", "16 beats"],
]

export type IndexKind = "raga" | "tala"

export function indexRows(kind: IndexKind): Array<{ name: string; meta: string }> {
  if (kind === "raga") return RAGAS.map(([name, time, songs]) => ({ name, meta: `${time} · ${songs} songs` }))
  return TALAS.map(([name, beats], i) => ({ name, meta: `${beats} · ${14 - i * 2} songs` }))
}

export const INDEX_SUMMARY = { ragas: RAGAS.length, talas: TALAS.length } as const

const DAY_MS = 24 * 60 * 60 * 1000

function reviewCard(id: string, now: number, dueInDays: number, intervalDays: number): WordCard {
  return {
    ...newCard(id, now),
    status: "review",
    intervalDays,
    step: 0,
    reps: 3,
    lastReviewedAt: now - intervalDays * DAY_MS,
    dueAt: now + dueInDays * DAY_MS,
  }
}

export type LearnDemoSeed = {
  songs: LearningSong[]
  paths: Record<string, PathState>
  cards: Record<string, WordCard>
}

/**
 * First-run sample state so the Learn tab is not empty before the API and real
 * progress exist: the prototype's library of five songs, six learned words and two
 * word cards due today (the last two words of the ten-word starter deck).
 */
export function buildLearnDemoSeed(now: number): LearnDemoSeed {
  const songs: LearningSong[] = LIBRARY_DEMO.map((entry, index) => ({
    songId: `ps-${entry.number}`,
    number: entry.number,
    title: learnSongTitle(entry.number),
    startedAt: now - (10 - index) * DAY_MS,
  }))
  const done: PathState = { listen: true, words: true, meaning: true, chords: true }
  const paths: Record<string, PathState> = {
    "ps-2": done,
    "ps-4": done,
    "ps-6": done,
    "ps-1": { ...EMPTY_PATH, listen: true },
    "ps-3": { ...EMPTY_PATH, listen: true, words: true },
  }
  const cards: Record<string, WordCard> = {}
  // two PS 1 words due now: they are the "Due" cards of the first practice
  for (const roman of ["dáo", "Tomár"]) {
    const id = wordId(1, roman)
    cards[id] = reviewCard(id, now, -0.05, 3)
  }
  // four PS 3 words already learned, back in a few days
  const future: Array<[string, number]> = [["Ándhára", 2], ["sheśe", 4], ["álora", 6], ["deshe", 9]]
  for (const [roman, days] of future) {
    const id = wordId(3, roman)
    cards[id] = reviewCard(id, now, days, days + 1)
  }
  return { songs, paths, cards }
}
