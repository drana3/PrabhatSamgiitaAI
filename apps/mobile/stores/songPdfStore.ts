import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { toggleCode } from "@/lib/songPdf/languages"
import { DEFAULT_PDF_OPTIONS, PDF_VARIANTS, type PdfVariantId } from "@/lib/songPdf/types"

type State = {
  variant: PdfVariantId
  /** languages of the word meanings, in the order they stack; the first one is the one the song page shows */
  wordLanguages: string[]
  /** languages of the translation in the PDF, in the order chosen */
  translationLanguages: string[]
  setVariant: (variant: PdfVariantId) => void
  toggleWordLanguage: (code: string) => void
  toggleTranslationLanguage: (code: string) => void
}

const codes = (value: unknown, fallback: string[]): string[] =>
  Array.isArray(value) ? value.filter((c): c is string => typeof c === "string") : fallback

/** What the person picked for the song PDF and the word languages, kept on the device. */
export const useSongPdfStore = create<State>()(
  persist(
    (set) => ({
      variant: DEFAULT_PDF_OPTIONS.variant,
      wordLanguages: DEFAULT_PDF_OPTIONS.wordLanguages,
      translationLanguages: DEFAULT_PDF_OPTIONS.translationLanguages,
      setVariant: (variant) => set({ variant }),
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
          variant: PDF_VARIANTS.includes(s.variant as PdfVariantId) ? (s.variant as PdfVariantId) : current.variant,
          wordLanguages: codes(s.wordLanguages, current.wordLanguages),
          translationLanguages: codes(s.translationLanguages, current.translationLanguages),
        }
      },
    },
  ),
)
