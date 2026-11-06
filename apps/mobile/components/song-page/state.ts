import { useCallback, useState } from "react"

import type { BlockTab } from "@/lib/songPage/blockTabs"
import type { TextSize } from "@/lib/songPage/settings"
import { useSongPageStore } from "@/stores/songPageStore"

/** Text size of the lyrics: small, medium, large. */
export const TEXT_SCALES = [0.9, 1, 1.2] as const
export type TextScaleIndex = TextSize

export type PageSheet = null | "menu"

/** The chords: diagrams of the shapes, or the chord letters set over the lyrics. */
export type ChordView = "diagrams" | "lyrics"

/**
 * The small amount of screen state the page keeps: the tab of the text block, the text options popover, the open
 * translation, the tapped word, the open sheet, requests. Text size and the translation switch are settings and
 * live in the songPageStore (kept on the device), next to the script and the translation language.
 */
export function usePageUi() {
  const scaleIndex = useSongPageStore((s) => s.textSize)
  const setScaleIndex = useSongPageStore((s) => s.setTextSize)
  const translationOn = useSongPageStore((s) => s.translationOn)
  const setTranslationOn = useSongPageStore((s) => s.setTranslationOn)
  const [blockTab, setBlockTab] = useState<BlockTab>("lyrics")
  /** the text options popover: closed, or open under the "Aa" button whose bottom edge is at `top` (window y) */
  const [options, setOptions] = useState<null | { top: number }>(null)
  const [translationOpen, setTranslationOpen] = useState(false)
  const [chordView, setChordView] = useState<ChordView>("diagrams")
  /** the tapped word of the word-by-word grid, by its key (the same word is lit everywhere in the song) */
  const [selected, setSelected] = useState<string | null>(null)
  const [sheet, setSheet] = useState<PageSheet>(null)
  // TODO(api): send the request to the catalogue; for now it is remembered on this screen only
  const [requested, setRequested] = useState<string[]>([])
  const openOptions = useCallback((top: number) => setOptions({ top }), [])
  const closeOptions = useCallback(() => setOptions(null), [])
  const request = useCallback((key: string) => setRequested((list) => (list.includes(key) ? list : [...list, key])), [])
  return {
    scale: TEXT_SCALES[scaleIndex],
    scaleIndex,
    setScaleIndex,
    translationOn,
    setTranslationOn,
    blockTab,
    setBlockTab,
    options,
    openOptions,
    closeOptions,
    translationOpen,
    setTranslationOpen,
    chordView,
    setChordView,
    selected,
    setSelected,
    sheet,
    setSheet,
    requested,
    request,
  }
}

export type PageUi = ReturnType<typeof usePageUi>
