import { useEffect, useState } from "react"

import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

/**
 * Hints that show once and never again, kept on the phone: the gold dot and the small bubble on the "i" button of the
 * player (About this song), and the captions under the icons of the song page. A hint is "seen" the first time the
 * person does what it points at (opens the sheet, taps an icon) or taps the hint away.
 */
type PageHintsState = {
  aboutHintSeen: boolean
  actionCaptionsSeen: boolean
  markAboutHintSeen: () => void
  markActionCaptionsSeen: () => void
}

export const usePageHintsStore = create<PageHintsState>()(
  persist(
    (set) => ({
      aboutHintSeen: false,
      actionCaptionsSeen: false,
      markAboutHintSeen: () => set({ aboutHintSeen: true }),
      markActionCaptionsSeen: () => set({ actionCaptionsSeen: true }),
    }),
    {
      name: "prabhat-page-hints",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({ aboutHintSeen: s.aboutHintSeen, actionCaptionsSeen: s.actionCaptionsSeen }),
    },
  ),
)

/** True once the saved flags are read; a hint waits for it, so a hint already seen never flashes. */
export function useHintsReady(): boolean {
  const [ready, setReady] = useState(() => usePageHintsStore.persist.hasHydrated())
  useEffect(() => {
    if (usePageHintsStore.persist.hasHydrated()) {
      setReady(true)
      return undefined
    }
    return usePageHintsStore.persist.onFinishHydration(() => setReady(true))
  }, [])
  return ready
}
