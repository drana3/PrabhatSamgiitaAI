import { useCallback, useState } from "react"

/** Text size of the lyrics: small, medium, large. */
export const TEXT_SCALES = [0.9, 1, 1.2] as const
export type TextScaleIndex = 0 | 1 | 2

export type PageSheet = null | "script" | "language" | "menu"

/** How the lyrics are drawn: line by line, or with the real meaning of each word (where it exists). */
export type LyricsView = "lines" | "words"

/** The chords: diagrams of the shapes, or the chord letters set over the lyrics. */
export type ChordView = "diagrams" | "lyrics"

/** The small amount of screen state the page keeps: text size, lyrics view, open translation, tapped word, open sheet, requests. */
export function usePageUi() {
  const [scaleIndex, setScaleIndex] = useState<TextScaleIndex>(1)
  const [view, setView] = useState<LyricsView>("lines")
  const [translationOpen, setTranslationOpen] = useState(false)
  const [chordView, setChordView] = useState<ChordView>("diagrams")
  const [selected, setSelected] = useState<string | null>(null)
  const [sheet, setSheet] = useState<PageSheet>(null)
  // TODO(api): send the request to the catalogue; for now it is remembered on this screen only
  const [requested, setRequested] = useState<string[]>([])
  const request = useCallback((key: string) => setRequested((list) => (list.includes(key) ? list : [...list, key])), [])
  return {
    scale: TEXT_SCALES[scaleIndex],
    scaleIndex,
    setScaleIndex,
    view,
    setView,
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
