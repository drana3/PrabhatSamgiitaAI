import { create } from "zustand"

/** "Continue from 12:40" for a long recording: set when it starts and a place was saved. Memory only. */
type LongResumeOffer = {
  songNumber: number | null
  at: number
  show: (songNumber: number, at: number) => void
  clear: () => void
}

export const useLongResumeOffer = create<LongResumeOffer>()((set) => ({
  songNumber: null,
  at: 0,
  show: (songNumber, at) => set({ songNumber, at }),
  clear: () => set({ songNumber: null, at: 0 }),
}))
