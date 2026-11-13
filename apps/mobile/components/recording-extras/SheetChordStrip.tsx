import { useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ChordStrip } from "@/components/chords/ChordCard"
import { ChordCardSheet } from "@/components/chords/ChordCardSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import type { ChordInstrument } from "@/lib/chordCard/instrument"
import { useT } from "@/lib/i18n"

/**
 * The chords of a chart as small pictures (guitar fingers, piano keys, harmonium keys), one for each different chord. A tap
 * opens the big card in a sheet. The pictures are the shared `ChordCard` (docs/chord-card.md): this file draws nothing
 * itself, it hands the chords and the instrument the author chose to that component. The reader can look at the
 * same chord on another instrument inside the sheet; that choice is theirs and is not saved.
 */
export function SheetChordStrip({ t, chords, instrument }: { t: SpTheme; chords: readonly string[]; instrument: ChordInstrument }) {
  const tr = useT()
  const [open, setOpen] = useState<string | null>(null)
  const [looking, setLooking] = useState<ChordInstrument | null>(null)
  if (chords.length === 0) return null
  const shown = looking ?? instrument
  return (
    <View style={s.root} testID="sheet-chord-strip">
      <Text style={[s.title, { color: t.ink900 }]} accessibilityRole="header">
        {tr("chordStrip.title")}
      </Text>
      <Text style={[s.hint, { color: t.ink500 }]}>{tr("chordStrip.hint")}</Text>
      <ChordStrip chords={chords} instrument={shown} onOpen={setOpen} t={t} />
      <ChordCardSheet
        t={t}
        chord={open}
        chords={chords}
        instrument={shown}
        onInstrument={setLooking}
        onChord={setOpen}
        onClose={() => {
          setOpen(null)
          setLooking(null)
        }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 8 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
