import { useCallback, useState } from "react"

import type { BlockTab } from "@/lib/songPage/blockTabs"
import { DEFAULT_WORDS_MODE, type WordsMode } from "@/lib/songPage/songTabs"
import type { TextSize } from "@/lib/songPage/settings"
import { useSongPageStore } from "@/stores/songPageStore"

/** Text size of the lyrics: small, medium, large. */
export const TEXT_SCALES = [0.9, 1, 1.2] as const
export type TextScaleIndex = TextSize

export type PageSheet = null | "menu" | "pronounce" | "languages"

/** The sheets of the Chords tab: the capo (or the harmonium key) with its arrows, and the charts members offered. */
export type ChordSheet = null | "capo" | "members"

/** The chords: diagrams of the shapes, or the chord letters set over the lyrics. */
export type ChordView = "diagrams" | "lyrics"

/**
 * The small amount of screen state the page keeps: the page of the text block, the text options popover, the tapped
 * word, the open sheet, requests. Text size, the translation under each line, the kind of the Translation page and
 * the word-by-word language are settings and live in the songPageStore (kept on the device), next to the script.
 */
export function usePageUi() {
  const scaleIndex = useSongPageStore((s) => s.textSize)
  const setScaleIndex = useSongPageStore((s) => s.setTextSize)
  const lineTranslation = useSongPageStore((s) => s.lineTranslation)
  const setLineTranslation = useSongPageStore((s) => s.setLineTranslation)
  const translationKind = useSongPageStore((s) => s.translationKind)
  const setTranslationKind = useSongPageStore((s) => s.setTranslationKind)
  const [blockTab, setBlockTab] = useState<BlockTab>("lyrics")
  /** the text options popover: closed, or open under the "Aa" button whose bottom edge is at `top` (window y); `wordLanguage` adds the choice of the word by word language (the button of that page asked for it) */
  const [options, setOptions] = useState<null | { top: number; wordLanguage: boolean }>(null)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [chordView, setChordView] = useState<ChordView>("diagrams")
  const [chordSheet, setChordSheet] = useState<ChordSheet>(null)
  /** the two pages inside the Words tab: the translation, or the word by word grid */
  const [wordsMode, setWordsMode] = useState<WordsMode>(DEFAULT_WORDS_MODE)
  /** the tapped word of the word-by-word grid, by its key (the same word is lit everywhere in the song) */
  const [selected, setSelected] = useState<string | null>(null)
  const [sheet, setSheet] = useState<PageSheet>(null)
  // TODO(api): send the request to the catalogue; for now it is remembered on this screen only
  const [requested, setRequested] = useState<string[]>([])
  const openOptions = useCallback((top: number, wordLanguage = false) => setOptions({ top, wordLanguage }), [])
  const closeOptions = useCallback(() => setOptions(null), [])
  const request = useCallback((key: string) => setRequested((list) => (list.includes(key) ? list : [...list, key])), [])
  return {
    scale: TEXT_SCALES[scaleIndex],
    scaleIndex,
    setScaleIndex,
    lineTranslation,
    setLineTranslation,
    translationKind,
    setTranslationKind,
    blockTab,
    setBlockTab,
    options,
    openOptions,
    closeOptions,
    translationOpen,
    setTranslationOpen,
    chordView,
    setChordView,
    chordSheet,
    setChordSheet,
    wordsMode,
    setWordsMode,
    selected,
    setSelected,
    sheet,
    setSheet,
    requested,
    request,
  }
}

export type PageUi = ReturnType<typeof usePageUi>
