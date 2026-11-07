import { useMemo } from "react"

import { splitTranslation, type TranslationSplit } from "@/lib/songPage/readingStrip"

import type { SongPageModel } from "./useSongPageModel"

/**
 * How the translation of the song on screen splits into stanzas (lib/songPage/readingStrip.ts): by stanza when that
 * is honest, whole otherwise, none when the song has no translation text or the reader switched the translation off. The lyrics and the reading strip both
 * read this, so they never disagree about which stanzas have a translation.
 */
export function useReadingSplit(model: SongPageModel, translationOn: boolean): TranslationSplit {
  const meaning = model.meaning
  const pairs = model.align.kind === "pairs" ? model.align.pairs : null
  const blocks = model.structure.blocks
  return useMemo(
    () => (translationOn && meaning.status === "ready" ? splitTranslation({ blocks, raw: meaning.raw, pairs }) : ({ kind: "none" } as const)),
    [blocks, meaning.status, meaning.raw, pairs, translationOn],
  )
}
