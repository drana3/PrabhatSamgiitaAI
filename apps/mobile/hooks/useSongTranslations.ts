import { useEffect, useState } from "react"

import { apiBaseUrl } from "@/lib/client"
import { fetchSongTranslations } from "@/lib/songTranslations/remote"
import type { SongTranslations } from "@/lib/songTranslations/types"

/** One answer per song and language for the session. `null` is a real "the server has none"; a failed request is not stored. */
const answers = new Map<string, SongTranslations | null>()
const key = (song: number, language: string) => `${song}:${language}`

export type TranslationsState = { remote: SongTranslations | null; loading: boolean }

/**
 * The translations the server has for this song (official, poetic, literal). While it loads, and when the request
 * fails, `remote` is null and the page falls back to the official text of the catalogue (see mergeTranslations).
 * Skipped for the preview's demo songs.
 */
export function useSongTranslations(songNumber: number | undefined, language = "en", skip = false): TranslationsState {
  const [state, setState] = useState<TranslationsState>(() => ({
    remote: songNumber !== undefined && !skip ? (answers.get(key(songNumber, language)) ?? null) : null,
    loading: songNumber !== undefined && !skip && !answers.has(key(songNumber, language)),
  }))
  useEffect(() => {
    if (songNumber === undefined || skip) {
      setState({ remote: null, loading: false })
      return
    }
    const k = key(songNumber, language)
    if (answers.has(k)) {
      setState({ remote: answers.get(k) ?? null, loading: false })
      return
    }
    let active = true
    setState({ remote: null, loading: true })
    void fetchSongTranslations({ baseUrl: apiBaseUrl }, songNumber, language).then((list) => {
      if (list) answers.set(k, list)
      if (active) setState({ remote: list, loading: false })
    })
    return () => {
      active = false
    }
  }, [songNumber, language, skip])
  return state
}
