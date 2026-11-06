import { memo } from "react"
import { StyleSheet, Text, View } from "react-native"

import { KPress } from "@/components/kirtan/KPress"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import type { Placement } from "@/lib/songChords/draft"
import { splitWords } from "@/lib/songPage/chordChart"

import { CORNER } from "./parts"

export type Slot = { line: number; word: number }

/**
 * The lyric sheet itself: every line of the song, every word a column with an empty chord slot above it. Tap a word
 * to select its slot (the palette opens); the chord then sits over the word exactly as it will on the song page.
 * Chords are shown as the member enters them (shapes for a guitar). The selection is an orange frame, no colour alone:
 * the frame is thick and the slot is named for screen readers.
 */
export function ChordSlotEditor({
  theme,
  lines,
  placements,
  selected,
  onSelect,
}: {
  theme: SongsTheme
  lines: readonly string[]
  placements: ReadonlyArray<ReadonlyArray<Placement>>
  selected: Slot | null
  onSelect: (slot: Slot) => void
}) {
  const t = useT()
  return (
    <View style={s.root}>
      {lines.map((line, li) => (
        <View key={li} style={s.line} accessibilityLabel={t("chordOffer.line.a11y", { line: li + 1 })}>
          <Text style={[s.gutter, { color: theme.textMuted }]} importantForAccessibility="no" accessibilityElementsHidden>
            {li + 1}
          </Text>
          <View style={s.words}>
            {splitWords(line).map((word, wi) => {
              const chord = placements[li]?.find((p) => p.word === wi)?.chord ?? null
              const on = selected?.line === li && selected.word === wi
              return <Column key={wi} theme={theme} line={li} word={wi} text={word} chord={chord} on={on} onSelect={onSelect} />
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

const Column = memo(function Column({
  theme,
  line,
  word,
  text,
  chord,
  on,
  onSelect,
}: {
  theme: SongsTheme
  line: number
  word: number
  text: string
  chord: string | null
  on: boolean
  onSelect: (slot: Slot) => void
}) {
  const t = useT()
  return (
    <KPress
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={chord ? t("chordOffer.slot.chord.a11y", { line: line + 1, word: word + 1, text, chord }) : t("chordOffer.slot.empty.a11y", { line: line + 1, word: word + 1, text })}
      onPress={() => onSelect({ line, word })}
      pressedScale={0.94}
      style={[s.col, { borderColor: on ? theme.accent : "transparent", backgroundColor: on ? theme.peach : "transparent" }]}
    >
      <View style={[s.slot, { borderBottomColor: chord ? "transparent" : theme.line }]}>
        <Text style={[s.chord, { color: theme.accent }]} numberOfLines={1}>
          {chord ?? ""}
        </Text>
      </View>
      <Text style={[s.word, { color: theme.textHeading }]}>{text}</Text>
    </KPress>
  )
})

const s = StyleSheet.create({
  root: { gap: 12 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  gutter: { width: 22, paddingTop: 26, fontFamily: amFonts.medium, fontSize: 11, lineHeight: 14, textAlign: "right" },
  words: { flex: 1, flexDirection: "row", flexWrap: "wrap", rowGap: 4, columnGap: 2 },
  col: { minWidth: 44, minHeight: 56, paddingHorizontal: 6, paddingTop: 2, paddingBottom: 4, borderRadius: 14, borderWidth: 2, justifyContent: "flex-end" },
  slot: { minHeight: 24, justifyContent: "flex-end", borderBottomWidth: 1, marginBottom: 2 },
  chord: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20 },
  word: { fontFamily: amFonts.medium, fontSize: 17, lineHeight: 22 },
})
