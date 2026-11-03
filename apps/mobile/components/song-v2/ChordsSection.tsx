import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Minus, Plus } from "lucide-react-native"

import { ChordDiagram } from "@/components/song-v2/ChordDiagram"
import { Card, CircleButton, Pill, SectionHeading } from "@/components/song-v2/common"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amGap, amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import {
  chordsUsed,
  displayChord,
  type ChordChart,
  type ChordInstrument,
  type ChordMode,
} from "@/lib/songPage/chordChart"
import {
  bestCapo,
  capoLabel,
  capoNote,
  fingeringFor,
  HARMONIUM_KEYS,
  MAX_CAPO,
  shapeChord,
  soundingChord,
  swaraNotes,
} from "@/lib/songPage/chords"

const CARD_WIDTH = 160

/**
 * Chords (SCR-16 item 8, SCR-26). Guitar: capo stepper, Best capo, Shapes or
 * Sounding, chord cards with fretboards. Harmonium: Sa key control and the
 * seven swaras as note names of the key. All controls live here; the Lyrics
 * section only shows a one-line summary.
 */
export function ChordsSection({
  theme,
  chart,
  instrument,
  capo,
  mode,
  harmoniumKey,
  onInstrument,
  onCapo,
  onMode,
  onHarmoniumStep,
  onOpenChord,
}: {
  theme: AmTheme
  chart: ChordChart
  instrument: ChordInstrument
  capo: number
  mode: ChordMode
  harmoniumKey: string
  onInstrument: (instrument: ChordInstrument) => void
  onCapo: (capo: number) => void
  onMode: (mode: ChordMode) => void
  onHarmoniumStep: (direction: 1 | -1) => void
  onOpenChord: (shape: string, sounding: string) => void
}) {
  const used = chordsUsed(chart)
  return (
    <View style={styles.section}>
      <SectionHeading theme={theme}>Chords</SectionHeading>
      <View style={styles.row}>
        <Pill theme={theme} label="Guitar" selected={instrument === "guitar"} onPress={() => onInstrument("guitar")} />
        <Pill
          theme={theme}
          label="Harmonium"
          selected={instrument === "harmonium"}
          onPress={() => onInstrument("harmonium")}
        />
      </View>

      {instrument === "guitar" ? (
        <>
          <Card theme={theme} style={styles.controls}>
            <View style={styles.stepper}>
              <CircleButton
                theme={theme}
                label="Capo one fret lower"
                onPress={() => onCapo(capo - 1)}
                disabled={capo <= 0}
              >
                <Minus size={20} color={theme.textHeading} />
              </CircleButton>
              <Text style={[styles.value, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
                {capoLabel(capo)}
              </Text>
              <CircleButton
                theme={theme}
                label="Capo one fret higher"
                onPress={() => onCapo(capo + 1)}
                disabled={capo >= MAX_CAPO}
              >
                <Plus size={20} color={theme.textHeading} />
              </CircleButton>
            </View>
            <View style={styles.row}>
              <Pill theme={theme} tone="sand" label="Best capo" onPress={() => onCapo(bestCapo(used))} />
              <Pill theme={theme} label="Shapes" selected={mode === "shapes"} onPress={() => onMode("shapes")} />
              <Pill theme={theme} label="Sounding" selected={mode === "sounding"} onPress={() => onMode("sounding")} />
            </View>
            <Text style={[amType.body, { color: theme.textBody }]}>
              {capo === 0
                ? "No capo. The letters are the chords as they sound."
                : `${capoNote(capo)}. You play the open shapes, the song sounds as written.`}
            </Text>
            {chart.strum ? (
              <Text style={[amType.body, { color: theme.textBody }]}>{`Strum pattern: ${chart.strum}`}</Text>
            ) : null}
          </Card>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cards}
            style={styles.cardScroll}
          >
            {used.map((chord) => {
              const shape = shapeChord(chord, capo)
              const hasDiagram = Boolean(fingeringFor(shape))
              return (
                <PressScale
                  key={chord}
                  accessibilityRole="button"
                  accessibilityLabel={`${shape}${shape !== chord ? `, sounds as ${chord}` : ""}. Show fingering`}
                  onPress={() => onOpenChord(shape, soundingChord(shape, capo))}
                  style={[styles.chordCard, { backgroundColor: theme.card, borderColor: theme.line }]}
                >
                  <Text style={[styles.chordName, { color: theme.textHeading }]}>{shape}</Text>
                  <Text style={[amType.label, { color: theme.textMuted }]}>
                    {shape !== chord ? `Sounds ${chord}` : "Sounds the same"}
                  </Text>
                  {hasDiagram ? (
                    <ChordDiagram theme={theme} chord={shape} width={CARD_WIDTH - amSpace.s8} />
                  ) : (
                    <Text style={[amType.body, { color: theme.textMuted }]}>No chart yet</Text>
                  )}
                </PressScale>
              )
            })}
          </ScrollView>
        </>
      ) : (
        <>
          <Card theme={theme} style={styles.controls}>
            <View style={styles.stepper}>
              <CircleButton
                theme={theme}
                label="Sa one key lower"
                onPress={() => onHarmoniumStep(-1)}
                disabled={harmoniumKey === HARMONIUM_KEYS[0]}
              >
                <Minus size={20} color={theme.textHeading} />
              </CircleButton>
              <Text
                style={[styles.value, { color: theme.textHeading }]}
                accessibilityLiveRegion="polite"
              >{`Sa = ${harmoniumKey}`}</Text>
              <CircleButton
                theme={theme}
                label="Sa one key higher"
                onPress={() => onHarmoniumStep(1)}
                disabled={harmoniumKey === HARMONIUM_KEYS[HARMONIUM_KEYS.length - 1]}
              >
                <Plus size={20} color={theme.textHeading} />
              </CircleButton>
            </View>
            <View style={styles.swaras}>
              {swaraNotes(harmoniumKey).map(({ swara, note }) => (
                <View key={swara} style={[styles.swara, { backgroundColor: theme.inner, borderColor: theme.line }]}>
                  <Text style={[amType.label, { color: theme.eyebrow }]}>{swara}</Text>
                  <Text style={[styles.note, { color: theme.textHeading }]}>{note}</Text>
                </View>
              ))}
            </View>
            <Text style={[amType.body, { color: theme.textBody }]}>
              {`Chords in this key: ${used.map((c) => displayChord(c, { instrument: "harmonium", capo: 0, mode: "sounding", key: harmoniumKey }, chart.baseKey)).join("  ")}`}
            </Text>
          </Card>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: amSpace.s3 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: amSpace.s2 },
  controls: { gap: amSpace.s4 },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  value: { fontFamily: amFonts.display, fontSize: amFontSize.heading },
  cardScroll: { marginHorizontal: -amGap.gutter },
  cards: { paddingHorizontal: amGap.gutter, gap: amSpace.s3 },
  chordCard: {
    width: CARD_WIDTH,
    borderRadius: amRadius.card,
    borderWidth: 1,
    padding: amSpace.s4,
    alignItems: "center",
    gap: amSpace.s1,
  },
  chordName: { fontFamily: amFonts.display, fontSize: amFontSize.heading },
  swaras: { flexDirection: "row", flexWrap: "wrap", gap: amSpace.s2 },
  swara: {
    borderRadius: amRadius.sm,
    borderWidth: 1,
    paddingHorizontal: amSpace.s3,
    paddingVertical: amSpace.s2,
    alignItems: "center",
    minWidth: 44,
  },
  note: { fontFamily: amFonts.bold, fontSize: amFontSize.lead },
})
