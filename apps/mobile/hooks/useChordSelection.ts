import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"
import type { ScrollView, View } from "react-native"

import type { Slot } from "@/components/song-chords/ChordSlotEditor"
import { setChord, type Draft } from "@/lib/songChords/draft"
import { revealOffset } from "@/lib/songChords/reveal"
import { splitWords } from "@/lib/songPage/chordChart"

/**
 * The word the member has tapped in the chord editor, and everything that goes with it: the chord sheet that opens for it,
 * the chord it holds, and the scrolling that keeps the word in sight above the sheet. Shared by the two "offer chords"
 * screens (a Prabhat Samgiita song, and a Bhajan or a Spiritual song).
 *
 * - `enabled`: false while the screen is not editing (sending, sent, resuming), which keeps the sheet shut.
 * - `scrollRef`: the form's scroll view, to scroll the selected word clear of the sheet.
 */
export function useChordSelection<D extends Draft>({
  lines,
  setDraft,
  currentDraft,
  enabled,
  scrollRef,
}: {
  lines: readonly string[] | null
  setDraft: Dispatch<SetStateAction<D>>
  currentDraft: D
  enabled: boolean
  scrollRef: RefObject<ScrollView | null>
}) {
  const [entryMode, setEntryMode] = useState<"tap" | "paste">("tap")
  const [selected, setSelected] = useState<Slot | null>(null)
  const [covered, setCovered] = useState(0)
  const coveredRef = useRef(0)
  coveredRef.current = covered
  const areaRef = useRef<View>(null)
  const offsetRef = useRef(0)
  const nodes = useRef<Record<string, View | null>>({})

  const selectedWord = useMemo(() => {
    if (!selected || !lines) return null
    return splitWords(lines[selected.line] ?? "")[selected.word] ?? null
  }, [selected, lines])
  const lastWord = useRef("")
  if (selectedWord) lastWord.current = selectedWord
  const currentChord = selected ? (currentDraft.lines[selected.line]?.find((p) => p.word === selected.word)?.chord ?? null) : null
  const sheetOpen = entryMode === "tap" && selected !== null && lines !== null && selectedWord !== null && enabled

  const pick = (chord: string | null) => {
    if (!selected) return
    setDraft((d) => setChord(d, selected.line, selected.word, chord) as D)
  }
  const closeSheet = useCallback(() => setSelected(null), [])

  // keep the selected word in sight above the sheet
  useEffect(() => {
    if (!selected) return undefined
    const id = setTimeout(() => {
      const node = nodes.current[`${selected.line}:${selected.word}`]
      const area = areaRef.current
      if (!node || !area) return
      area.measureInWindow((_ax, ay, _aw, ah) => {
        node.measureInWindow((_nx, ny, _nw, nh) => {
          const next = revealOffset({ itemTop: ny, itemBottom: ny + nh, viewTop: ay, viewBottom: ay + ah, covered: coveredRef.current, offset: offsetRef.current })
          if (next !== null) scrollRef.current?.scrollTo({ y: next, animated: true })
        })
      })
    }, 80)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, covered])

  return {
    entryMode,
    setEntryMode,
    selected,
    setSelected,
    selectedWord,
    lastWord,
    currentChord,
    sheetOpen,
    pick,
    closeSheet,
    covered,
    setCovered,
    areaRef,
    offsetRef,
    nodes,
  }
}
