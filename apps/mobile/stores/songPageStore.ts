import AsyncStorage from "@react-native-async-storage/async-storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import { clampCapo, stepHarmoniumKey } from "@/lib/songPage/chords"
import type { ChordInstrument, ChordMode } from "@/lib/songPage/chordChart"
import { DEFAULT_SONG_PAGE_SETTINGS, normalizeSettings, type SongPageSettings } from "@/lib/songPage/settings"
import type { ScriptChoice } from "@/lib/songPage/scripts"
import { setPrimaryTranslation, toggleTranslation } from "@/lib/songPage/translations"

type SongPageState = SongPageSettings & {
  /** songs the reader started to learn; the Learn branch will own the full path state */
  learning: Record<string, true>
  setScript: (script: ScriptChoice) => void
  toggleTranslation: (code: string) => void
  setPrimaryTranslation: (code: string) => void
  /** Replace the chosen translation languages (the Words chips pick exactly one). */
  setTranslations: (codes: string[]) => void
  setChordsOn: (on: boolean) => void
  setInstrument: (instrument: ChordInstrument) => void
  setCapo: (capo: number) => void
  setChordMode: (mode: ChordMode) => void
  stepHarmoniumKey: (direction: 1 | -1) => void
  markLearning: (songId: string) => void
}

/**
 * Reading and playing settings of the redesigned song page (SCR-16, 25, 26).
 * The Player karaoke view reads the same store so the two stay in step.
 */
export const useSongPageStore = create<SongPageState>()(
  persist(
    (set) => ({
      ...DEFAULT_SONG_PAGE_SETTINGS,
      learning: {},
      setScript: (script) => set({ script }),
      toggleTranslation: (code) => set((s) => ({ translations: toggleTranslation(s.translations, code) })),
      setPrimaryTranslation: (code) => set((s) => ({ translations: setPrimaryTranslation(s.translations, code) })),
      setTranslations: (codes) => set({ translations: codes.length ? codes.slice(0, 2) : ["en"] }),
      setChordsOn: (chordsOn) => set({ chordsOn }),
      setInstrument: (instrument) => set({ instrument }),
      setCapo: (capo) => set({ capo: clampCapo(capo) }),
      setChordMode: (chordMode) => set({ chordMode }),
      stepHarmoniumKey: (direction) => set((s) => ({ harmoniumKey: stepHarmoniumKey(s.harmoniumKey, direction) })),
      markLearning: (songId) => set((s) => ({ learning: { ...s.learning, [songId]: true } })),
    }),
    {
      name: "prabhat-song-page-v2",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({
        script: s.script,
        translations: s.translations,
        chordsOn: s.chordsOn,
        instrument: s.instrument,
        capo: s.capo,
        chordMode: s.chordMode,
        harmoniumKey: s.harmoniumKey,
        learning: s.learning,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...normalizeSettings(persisted as Partial<SongPageSettings>),
        learning: (persisted as { learning?: Record<string, true> } | undefined)?.learning ?? {},
      }),
    },
  ),
)
