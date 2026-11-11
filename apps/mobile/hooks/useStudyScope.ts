import { useCallback, useMemo } from "react"

import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import { learnWordList } from "@/lib/learn/verified"
import { mineNumbers, normalizeScope, scopeSummary, scopeWords, type StudyScope } from "@/lib/learn/scope"
import { songNumbersFromIds, type LearnWord } from "@/lib/learn/words"
import { useLearnStore } from "@/stores/learnStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

/**
 * "What to study" as React state: the saved scope, the words it names and the deck line numbers.
 * The word cards and the quiz without ?song read their words from here, so one choice drives both.
 *
 *   const { scope, words, summary, setScope } = useStudyScope()
 */
export function useStudyScope() {
  const stored = useLearnStore((s) => s.scope)
  const songs = useLearnStore((s) => s.songs)
  const saveScope = useLearnStore((s) => s.setScope)
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)

  const scope = useMemo(() => normalizeScope(stored), [stored])
  const mine = useMemo(() => mineNumbers(songs.map((song) => song.number), songNumbersFromIds(savedSongIds)), [songs, savedSongIds])
  const all = learnWordList()
  const words = useMemo<LearnWord[]>(() => scopeWords(scope, all, mine), [scope, all, mine])
  const summary = useMemo(() => scopeSummary(scope, all, mine, PS_SONG_COUNT), [scope, all, mine])
  const setScope = useCallback((next: StudyScope) => saveScope(next), [saveScope])
  return { scope, mine, words, summary, setScope }
}
