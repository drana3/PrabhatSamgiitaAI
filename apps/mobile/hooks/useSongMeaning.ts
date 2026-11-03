import { useEffect, useMemo, useState } from "react"

import { localeLabel } from "@/constants/languages"
import type { MockSong } from "@/data/mock"
import { deriveMeaningView, needsMeaningFetch, type FetchedMeaning, type MeaningView } from "@/lib/songPage/meaning"
import { fetchSongMeaningLocalization } from "@/lib/songLocalization"
import { peekSongLocalization } from "@/lib/songCache"

/**
 * Meaning and Central idea of a song in one language. Uses stored text first,
 * the local cache second, and the translation service last (the same fast path
 * as the current song screen). Texts that need the slower generation step are
 * not requested here.
 */
export function useSongMeaning(song: MockSong | null, language: string): MeaningView & { loading: boolean } {
  const [fetched, setFetched] = useState<{ key: string; value: FetchedMeaning } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const key = song ? `${song.number}:${language}` : ""

  useEffect(() => {
    if (!song || !language) return
    let active = true
    const label = localeLabel(language)
    const peeked = language === "en" ? null : peekSongLocalization(song.number, label)
    if (peeked?.localized_meaning?.trim()) {
      setFetched({
        key,
        value: { meaning: peeked.localized_meaning.trim(), explanation: peeked.localized_explanation?.trim() || null },
      })
      return
    }
    if (!needsMeaningFetch(song, language)) return
    void fetchSongMeaningLocalization(song.number, language)
      .then((result) => {
        if (!active) return
        setFetched({
          key,
          value: {
            meaning: result?.localized_meaning?.trim() || null,
            explanation: result?.localized_explanation?.trim() || null,
          },
        })
      })
      .catch(() => {
        if (active) setFailedKey(key)
      })
    return () => {
      active = false
    }
  }, [song, language, key])

  return useMemo(() => {
    if (!song) return { meaning: { status: "unavailable" as const }, centralIdea: null, loading: false }
    const current = fetched && fetched.key === key ? fetched.value : null
    // Loading from the first frame: nothing stored, nothing fetched yet, no failure.
    const loading = !current && failedKey !== key && needsMeaningFetch(song, language)
    return { ...deriveMeaningView(song, language, current, loading), loading }
  }, [song, language, fetched, key, failedKey])
}
