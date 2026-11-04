import { create } from "zustand"

import type { MixItem } from "@/lib/kirtan/mix"
import { playNext as queueFront } from "@/lib/kirtan/queue"

/**
 * What the kirtan player is on, in memory only (a kirtan plays in the YouTube player of its
 * screen; nothing is cached or kept for later). Also remembers the last Songs source segment.
 */
export type SongsSource = "ps" | "kirtan" | "mixes"

export type MixSession = {
  mixId: string
  /** the playable items of the mix, in order */
  items: MixItem[]
  index: number
}

type KirtanPlayerState = {
  /** last chosen segment of the Songs tab (memory only) */
  source: SongsSource
  setSource: (source: SongsSource) => void
  /** the list the current kirtan was opened from, for previous and next */
  context: string[]
  queued: string[]
  mix: MixSession | null
  /** open a kirtan from a list */
  start: (id: string, context: readonly string[]) => void
  playNext: (id: string) => void
  takeQueued: (id: string) => void
  startMix: (session: MixSession) => void
  setMixIndex: (index: number) => void
  endMix: () => void
}

export const useKirtanPlayerStore = create<KirtanPlayerState>((set, get) => ({
  source: "ps",
  setSource: (source) => set({ source }),
  context: [],
  queued: [],
  mix: null,
  start: (_id, context) => set({ context: [...context], mix: null }),
  playNext: (id) => set({ queued: queueFront(get().queued, id) }),
  takeQueued: (id) => set({ queued: get().queued.filter((q) => q !== id) }),
  startMix: (session) => set({ mix: session }),
  setMixIndex: (index) => {
    const mix = get().mix
    if (mix) set({ mix: { ...mix, index } })
  },
  endMix: () => set({ mix: null }),
}))
