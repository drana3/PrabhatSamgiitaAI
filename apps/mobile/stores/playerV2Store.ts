import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { nextRepeatMode, type RepeatMode } from "@/lib/playerV2/controller"
import type { PlayMode } from "@/lib/playerV2/versionMode"
import { FOLLOW_APP, migratePlayerLanguages, normalizeLyricChoice } from "@/lib/songPage/lyricLanguages"
import { SLEEP_OFF, startSleepEndOfSong, startSleepMinutes, type SleepTimer } from "@/lib/playerV2/sleepTimer"

export type LyricScript = "roman" | "devanagari"
/**
 * "auto" follows the language of the app, "off" shows nothing, otherwise a language code of
 * lib/songPage/lyricLanguages.ts. The two settings are separate on purpose: the language of the
 * lines under the lyrics and the language of the word meanings do not change each other.
 */
export type LyricChoice = string

type PlayerV2State = {
  /** Persisted: "This version" or "All N versions". */
  playMode: PlayMode
  repeatMode: RepeatMode
  script: LyricScript
  translation: LyricChoice
  wordLanguage: LyricChoice
  /** Version chosen per song (by version id), because the playing URL can be a local copy. */
  versionByNumber: Record<string, string>
  /** Not persisted. */
  shuffleOriginal: number[] | null
  sleep: SleepTimer
  setPlayMode: (mode: PlayMode) => void
  cycleRepeat: () => RepeatMode
  setScript: (script: LyricScript) => void
  setTranslation: (choice: LyricChoice) => void
  setWordLanguage: (choice: LyricChoice) => void
  rememberVersion: (songNumber: number, versionId: string) => void
  setShuffleOriginal: (queue: number[] | null) => void
  startSleepMinutes: (minutes: number, now?: number) => void
  startSleepEndOfSong: (songNumber: number) => void
  cancelSleep: () => void
}

export const usePlayerV2Store = create<PlayerV2State>()(
  persist(
    (set, get) => ({
      playMode: "this",
      repeatMode: "off",
      script: "roman",
      translation: FOLLOW_APP,
      // The prototype opens with the word meanings on.
      wordLanguage: FOLLOW_APP,
      versionByNumber: {},
      shuffleOriginal: null,
      sleep: SLEEP_OFF,
      setPlayMode: (playMode) => set({ playMode }),
      cycleRepeat: () => {
        const next = nextRepeatMode(get().repeatMode)
        set({ repeatMode: next })
        return next
      },
      setScript: (script) => set({ script }),
      setTranslation: (translation) => set({ translation: normalizeLyricChoice(translation) }),
      setWordLanguage: (wordLanguage) => set({ wordLanguage: normalizeLyricChoice(wordLanguage) }),
      rememberVersion: (songNumber, versionId) =>
        set({ versionByNumber: { ...get().versionByNumber, [String(songNumber)]: versionId } }),
      setShuffleOriginal: (shuffleOriginal) => set({ shuffleOriginal }),
      startSleepMinutes: (minutes, now = Date.now()) => set({ sleep: startSleepMinutes(minutes, now) }),
      startSleepEndOfSong: (songNumber) => set({ sleep: startSleepEndOfSong(songNumber) }),
      cancelSleep: () => set({ sleep: SLEEP_OFF }),
    }),
    {
      name: "ps.player-v2",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        playMode: s.playMode,
        repeatMode: s.repeatMode,
        script: s.script,
        translation: s.translation,
        wordLanguage: s.wordLanguage,
        versionByNumber: s.versionByNumber,
      }),
      version: 2,
      // v1 stored translation "en" | "ru" | "off" and wordMeanings true | false. The old default "en"
      // and the old default "On" mean "follow the app"; an explicit Russian or Off stays.
      migrate: (persisted) => migratePlayerLanguages(persisted),
    },
  ),
)
