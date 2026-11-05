import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { DEFAULT_VARIANT, parseVariant, type SongPageVariant } from "@/lib/songPageVariants/variant"

type State = {
  /** the variant of the song page the preview switcher picked (B until Dada picks) */
  variant: SongPageVariant
  setVariant: (variant: SongPageVariant) => void
}

/** Key `song-page-variant`. Only the preview's switcher writes it; a real build always shows B. */
export const SONG_PAGE_VARIANT_KEY = "song-page-variant"

export const useSongPageVariantStore = create<State>()(
  persist(
    (set) => ({
      variant: DEFAULT_VARIANT,
      setVariant: (variant) => set({ variant: parseVariant(variant) ?? DEFAULT_VARIANT }),
    }),
    {
      name: SONG_PAGE_VARIANT_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({ variant: s.variant }),
      // a saved value that is no longer a variant falls back to the default
      merge: (persisted, current) => ({
        ...current,
        variant: parseVariant((persisted as { variant?: unknown } | undefined)?.variant) ?? DEFAULT_VARIANT,
      }),
    },
  ),
)
