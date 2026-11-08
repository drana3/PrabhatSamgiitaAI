import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { SA_NAMES } from "@/lib/pianoNotes/keys"

type PianoReaderState = {
  /** Easy keys: Sa on C, so the shuddha swaras are the white keys. ON by default (the owner's decision). */
  easy: boolean
  /** The Sa used while easy keys are off. */
  sa: string
  /** Show the left hand as well, for sheets that have one. */
  twoHands: boolean
  /** Beats per minute of the "play" button. */
  bpm: number
  setEasy: (easy: boolean) => void
  setSa: (sa: string) => void
  setTwoHands: (twoHands: boolean) => void
  setBpm: (bpm: number) => void
}

export const BPM_MIN = 40
export const BPM_MAX = 140

/** How the member reads piano notes. Kept on the device. */
export const usePianoReaderStore = create<PianoReaderState>()(
  persist(
    (set) => ({
      easy: true,
      sa: "C",
      twoHands: false,
      bpm: 72,
      setEasy: (easy) => set({ easy }),
      setSa: (sa) => set({ sa: SA_NAMES.includes(sa) ? sa : "C" }),
      setTwoHands: (twoHands) => set({ twoHands }),
      setBpm: (bpm) => set({ bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm))) }),
    }),
    { name: "piano-reader-v1", storage: createJSONStorage(() => AsyncStorage) },
  ),
)
