import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  DEFAULT_LIST_TRANSITION_SECONDS,
  DEFAULT_RADIO_TRANSITION_SECONDS,
  clampTransitionSeconds,
  sanitizeTrackRates,
  startRateFor,
  withTrackRate,
  type TrackRates,
} from "@/lib/playerV2/playbackPrefs"
import { clampRate } from "@/lib/playerV2/playbackSpeed"

export const PLAYBACK_PREFS_VERSION = 1

type PlaybackPrefsState = {
  /** The speed a recording starts at when it has none of its own. */
  defaultRate: number
  /** Speeds the listener chose "for this recording". */
  rateByTrack: TrackRates
  /** On (default): the tone stays the same at any speed. Off: the pitch follows the speed (iOS only). */
  keepPitch: boolean
  /** "Smooth transitions" in the Radio and in lists and queues, seconds (0 = off). */
  transitionRadioSeconds: number
  transitionListSeconds: number
  setDefaultRate: (rate: number) => void
  /** `rate` null forgets the track's own speed. */
  setTrackRate: (key: string, rate: number | null, now?: number) => void
  setKeepPitch: (keep: boolean) => void
  setTransitionRadioSeconds: (seconds: number) => void
  setTransitionListSeconds: (seconds: number) => void
}

export const usePlaybackPrefsStore = create<PlaybackPrefsState>()(
  persist(
    (set, get) => ({
      defaultRate: 1,
      rateByTrack: {},
      keepPitch: true,
      transitionRadioSeconds: DEFAULT_RADIO_TRANSITION_SECONDS,
      transitionListSeconds: DEFAULT_LIST_TRANSITION_SECONDS,
      setDefaultRate: (rate) => set({ defaultRate: clampRate(rate) }),
      setTrackRate: (key, rate, now = Date.now()) => set({ rateByTrack: withTrackRate(get().rateByTrack, key, rate, now) }),
      setKeepPitch: (keepPitch) => set({ keepPitch }),
      setTransitionRadioSeconds: (s) => set({ transitionRadioSeconds: clampTransitionSeconds(s, DEFAULT_RADIO_TRANSITION_SECONDS) }),
      setTransitionListSeconds: (s) => set({ transitionListSeconds: clampTransitionSeconds(s, DEFAULT_LIST_TRANSITION_SECONDS) }),
    }),
    {
      name: "ps-playback-prefs-v1",
      version: PLAYBACK_PREFS_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        defaultRate: s.defaultRate,
        rateByTrack: s.rateByTrack,
        keepPitch: s.keepPitch,
        transitionRadioSeconds: s.transitionRadioSeconds,
        transitionListSeconds: s.transitionListSeconds,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PlaybackPrefsState>
        return {
          ...current,
          defaultRate: clampRate(typeof p.defaultRate === "number" ? p.defaultRate : 1),
          rateByTrack: sanitizeTrackRates(p.rateByTrack),
          keepPitch: p.keepPitch === false ? false : true,
          transitionRadioSeconds: clampTransitionSeconds(p.transitionRadioSeconds, DEFAULT_RADIO_TRANSITION_SECONDS),
          transitionListSeconds: clampTransitionSeconds(p.transitionListSeconds, DEFAULT_LIST_TRANSITION_SECONDS),
        }
      },
    },
  ),
)

/** The speed a track starts at, read outside React (the player). */
export function startRateOf(key: string): number {
  const s = usePlaybackPrefsStore.getState()
  return startRateFor({ key, rates: s.rateByTrack, defaultRate: s.defaultRate })
}
