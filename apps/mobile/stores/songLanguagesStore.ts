import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { toggleCode } from "@/lib/songPage/languages"

type State = {
  /** languages of the word meanings, in the order they stack; the first one is the one the song page shows */
  wordLanguages: string[]
  /** languages of the translation, in the order chosen */
  translationLanguages: string[]
  toggleWordLanguage: (code: string) => void
  toggleTranslationLanguage: (code: string) => void
}

const codes = (value: unknown, fallback: string[]): string[] =>
  Array.isArray(value) ? value.filter((c): c is string => typeof c === "string") : fallback

/** What the person picked in the language menu of the song page, kept on the device. The storage key stays "song-pdf" so choices made before the rename are kept. */
export const useSongLanguagesStore = create<State>()(
  persist(
    (set) => ({
      wordLanguages: ["en"],
      translationLanguages: ["en"],
      toggleWordLanguage: (code) => set((s) => ({ wordLanguages: toggleCode(s.wordLanguages, code) })),
      toggleTranslationLanguage: (code) => set((s) => ({ translationLanguages: toggleCode(s.translationLanguages, code) })),
    }),
    {
      name: "song-pdf",
      storage: createJSONStorage(() => AsyncStorage),
      merge: (stored, current) => {
        const s = (stored ?? {}) as Partial<State>
        return {
          ...current,
          wordLanguages: codes(s.wordLanguages, current.wordLanguages),
          translationLanguages: codes(s.translationLanguages, current.translationLanguages),
        }
      },
    },
  ),
)
