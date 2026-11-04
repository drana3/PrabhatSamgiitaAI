import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  EMPTY_PATH,
  markPathPart,
  type LearningSong,
  type PathPart,
  type PathState,
} from "@/lib/learn/progress"
import { buildLearnDemoSeed } from "@/lib/fixtures/learn"
import { mergeBest, type LearnQuizLevel, type QuizBest, type QuizBestMap } from "@/lib/learn/quiz"
import {
  DEFAULT_REVIEW_STYLE,
  gradeCard,
  newCard,
  type Grade,
  type ReviewStyle,
  type WordCard,
} from "@/lib/learn/srs"

/**
 * Learn state, stored on the phone first (spec SCR-22: "cards and review history
 * are stored locally first"). The shape follows API-13 so it can sync later:
 * lpath per song, card state per word, review style.
 */
type LearnState = {
  reviewStyle: ReviewStyle
  cards: Record<string, WordCard>
  songs: LearningSong[]
  paths: Record<string, PathState>
  quizBest: QuizBestMap
  /** true once the sample library of the prototype has been put in (TODO(api): remove with the fixtures) */
  demoSeeded: boolean
  /** put the prototype's sample library in an empty store, once */
  seedDemo: (now?: number) => void
  setReviewStyle: (style: ReviewStyle) => void
  /** grade one word card; the first grade creates the card */
  grade: (wordId: string, grade: Grade, now?: number) => void
  startLearning: (song: { songId: string; number: number; title: string }, now?: number) => void
  stopLearning: (songId: string) => void
  markPart: (songId: string, part: PathPart) => void
  /** keep the better result for a level */
  recordQuiz: (level: LearnQuizLevel, result: { score: number; total: number; passed: boolean }, now?: number) => void
  resetAll: () => void
}

const INITIAL = {
  reviewStyle: DEFAULT_REVIEW_STYLE,
  cards: {} as Record<string, WordCard>,
  songs: [] as LearningSong[],
  paths: {} as Record<string, PathState>,
  quizBest: {} as QuizBestMap,
  demoSeeded: false,
}

export const useLearnStore = create<LearnState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setReviewStyle: (reviewStyle) => set({ reviewStyle }),

      seedDemo: (now = Date.now()) => {
        const { demoSeeded, songs, cards } = get()
        if (demoSeeded) return
        if (songs.length > 0 || Object.keys(cards).length > 0) {
          set({ demoSeeded: true })
          return
        }
        set({ ...buildLearnDemoSeed(now), demoSeeded: true })
      },

      grade: (wordId, grade, now = Date.now()) => {
        const { cards, reviewStyle } = get()
        const current = cards[wordId] ?? newCard(wordId, now)
        set({ cards: { ...cards, [wordId]: gradeCard(current, grade, reviewStyle, now) } })
      },

      startLearning: (song, now = Date.now()) => {
        const { songs, paths } = get()
        if (songs.some((entry) => entry.songId === song.songId)) return
        set({
          songs: [...songs, { ...song, startedAt: now }],
          paths: { ...paths, [song.songId]: paths[song.songId] ?? EMPTY_PATH },
        })
      },

      stopLearning: (songId) =>
        set({ songs: get().songs.filter((entry) => entry.songId !== songId) }),

      markPart: (songId, part) => set({ paths: markPathPart(get().paths, songId, part) }),

      recordQuiz: (level, result, now = Date.now()) => {
        const best: QuizBest = { ...result, at: now }
        set({ quizBest: { ...get().quizBest, [level]: mergeBest(get().quizBest[level], best) } })
      },

      resetAll: () => set({ ...INITIAL }),
    }),
    {
      name: "prabhat-learn",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({
        reviewStyle: state.reviewStyle,
        cards: state.cards,
        songs: state.songs,
        paths: state.paths,
        quizBest: state.quizBest,
        demoSeeded: state.demoSeeded,
      }),
    },
  ),
)
