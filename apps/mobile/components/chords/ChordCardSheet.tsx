import { useRef } from "react"
import { StyleSheet, View } from "react-native"

import { ChordCard, ChordStrip, InstrumentPicker } from "@/components/chords/ChordCard"
import { SpSheet } from "@/components/song-v2/SpSheet"
import type { SpTheme } from "@/constants/tokens/amSong"
import { useT } from "@/lib/i18n"
import type { ChordInstrument } from "@/lib/chordCard/instrument"

/**
 * A chord card in a bottom sheet (docs/chord-card.md): the chord large, the instrument picker over it, and, when the
 * tune's chords are given, the strip of all of them under it so one tap moves to another chord. The screen owns which chord is
 * open and which instrument is chosen.
 */
export function ChordCardSheet({
  t,
  chord,
  chords,
  instrument,
  onInstrument,
  onChord,
  onClose,
}: {
  t: SpTheme
  /** the chord shown; null keeps the sheet closed */
  chord: string | null
  /** every chord of the tune, for the strip under the card */
  chords?: ReadonlyArray<string | null | undefined>
  instrument: ChordInstrument
  onInstrument: (next: ChordInstrument) => void
  onChord?: (chord: string) => void
  onClose: () => void
}) {
  const tr = useT()
  // while the sheet slides away the card keeps the chord it showed, instead of going blank
  const last = useRef<string | null>(chord)
  if (chord) last.current = chord
  const shown = chord ?? last.current
  return (
    <SpSheet t={t} visible={chord !== null} onClose={onClose} label={tr("chordCard.sheet", { chord: shown ?? "" })} testID="chord-card-sheet">
      <View style={styles.body}>
        <InstrumentPicker value={instrument} onChange={onInstrument} t={t} />
        {shown ? <ChordCard chord={shown} instrument={instrument} t={t} /> : null}
        {chords && chords.length > 1 ? <ChordStrip chords={chords} instrument={instrument} onOpen={onChord} t={t} /> : null}
      </View>
    </SpSheet>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, gap: 16, paddingBottom: 8 },
})
