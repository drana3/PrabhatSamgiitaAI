import { useCallback, useState } from "react"

import { TEXT_SCALES, type TextScaleIndex } from "./Lyrics"

export type PageSheet = null | "script" | "meaning" | "about" | "play" | "watch" | "words"

/** The small amount of screen state the three variants share: text size, the Words switch, the tapped word, the open sheet. */
export function usePageUi() {
  const [scaleIndex, setScaleIndex] = useState<TextScaleIndex>(1)
  const [wordsOn, setWordsOn] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [sheet, setSheet] = useState<PageSheet>(null)
  const cycleScale = useCallback(() => setScaleIndex((i) => (((i + 1) % TEXT_SCALES.length) as TextScaleIndex)), [])
  return { scale: TEXT_SCALES[scaleIndex], scaleIndex, cycleScale, wordsOn, setWordsOn, selected, setSelected, sheet, setSheet }
}

export type PageUi = ReturnType<typeof usePageUi>
