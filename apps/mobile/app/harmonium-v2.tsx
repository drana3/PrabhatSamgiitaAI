import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { harmoniumKeyboardLayout, type HarmoniumKeyboardKey } from "@prabhat/core"

import { HarmoniumKeyboard } from "@/components/harmonium-v2/Keyboard"
import { Overline, PillButton, SaStepper, SubHeader } from "@/components/harmonium-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { noteName, swaraNoteRow } from "@/lib/harmonium-v2/chords"
import { sliceKeyboard } from "@/lib/harmonium-v2/keyboardWindow"
import { startHarmoniumDrone, stopHarmoniumDrone } from "@/lib/harmoniumPlayback"
import { href } from "@/utils/href"

type Octave = "lower" | "middle"

/**
 * Harmonium with notation (spec SCR-23 and the keyboard of SCR-16): the on-screen
 * keyboard with the swara and note on every key, the key (Sa) control, and a swara
 * to note row. Sound comes from the existing harmonium engine.
 */
export default function HarmoniumV2Screen() {
  const router = useRouter()
  const theme = useAmTheme()
  const { width: screenWidth } = useWindowDimensions()
  const [saPitchClass, setSaPitchClass] = useState(0)
  const [octave, setOctave] = useState<Octave>("middle")
  const [droneOn, setDroneOn] = useState(false)
  const [last, setLast] = useState<HarmoniumKeyboardKey | null>(null)

  const saName = noteName(saPitchClass)
  const keyboardWidth = screenWidth - amGap.gutter * 2

  const fullLayout = useMemo(() => harmoniumKeyboardLayout(saName), [saName])
  const windowKeys = useMemo(
    () => sliceKeyboard(fullLayout, octave === "lower" ? 0 : 12, 13).keys,
    [fullLayout, octave],
  )
  const noteRow = useMemo(() => swaraNoteRow(saPitchClass), [saPitchClass])

  useEffect(() => {
    if (!droneOn) return
    void startHarmoniumDrone(saName).catch(() => undefined)
    return () => {
      void stopHarmoniumDrone()
    }
  }, [droneOn, saName])

  useEffect(() => () => void stopHarmoniumDrone(), [])

  const stepSa = useCallback((direction: -1 | 1) => {
    setSaPitchClass((current) => (current + direction + 12) % 12)
    setLast(null)
  }, [])

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/learn"))
  }

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
        showsVerticalScrollIndicator={false}
      >
        <SubHeader theme={theme} title="HARMONIUM" onBack={back} />

        <Reveal index={0} style={styles.stack}>
          <SaStepper theme={theme} value={saName} onStep={stepSa} />
          <View style={[styles.readout, { backgroundColor: amColors.sage700 }]}>
            <Overline color={amColors.gold300}>YOU PLAYED</Overline>
            <Text style={styles.readoutSwara} accessibilityLiveRegion="polite">
              {last ? last.latin : "Tap a key"}
            </Text>
            <Text style={styles.readoutNote}>{last ? last.keyLabel : `Sa is ${saName}`}</Text>
          </View>
        </Reveal>

        <Reveal index={1} style={styles.stack}>
          <View style={styles.octaveRow}>
            <PillButton
              theme={theme}
              label="Lower octave"
              variant={octave === "lower" ? "brand" : "sand"}
              accessibilityState={{ selected: octave === "lower" }}
              onPress={() => setOctave("lower")}
              style={styles.flex}
            />
            <PillButton
              theme={theme}
              label="Middle octave"
              variant={octave === "middle" ? "brand" : "sand"}
              accessibilityState={{ selected: octave === "middle" }}
              onPress={() => setOctave("middle")}
              style={styles.flex}
            />
          </View>
          <HarmoniumKeyboard
            theme={theme}
            keys={windowKeys}
            width={keyboardWidth}
            tonic={saName}
            onKeyDown={(key) => setLast(key)}
          />
          <Text style={[amType.label, { color: theme.textBody }]}>
            Capital letters are natural swaras, small letters are flat. The orange dot is Sa.
          </Text>
        </Reveal>

        <Reveal index={2} style={styles.stack}>
          <Overline color={theme.eyebrow}>{`SA IS ${saName}`}</Overline>
          <View style={[styles.noteRow, { backgroundColor: theme.card, borderColor: theme.line }]}>
            {noteRow.map((entry) => (
              <View key={entry.name} style={styles.noteCell}>
                <Text style={[styles.noteSwara, { color: theme.textHeading }]}>{entry.name}</Text>
                <Text style={[styles.noteName, { color: theme.textBody }]}>{entry.note}</Text>
              </View>
            ))}
          </View>
        </Reveal>

        <Reveal index={3} style={styles.stack}>
          <PillButton
            theme={theme}
            label={droneOn ? "Drone on" : "Drone off"}
            variant={droneOn ? "dark" : "sand"}
            accessibilityState={{ selected: droneOn }}
            onPress={() => setDroneOn((on) => !on)}
          />
          <PillButton
            theme={theme}
            label="How chords work"
            onPress={() => router.push(href(`/harmonium-v2/chords?sa=${encodeURIComponent(saName)}`))}
          />
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 96, gap: amGap.section / 2 },
  stack: { gap: amGap.block },
  flex: { flex: 1 },
  octaveRow: { flexDirection: "row", gap: amGap.grid },
  readout: { borderRadius: amRadius.panel, padding: amGap.padPanel, gap: 4 },
  readoutSwara: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 44, color: amColors.white },
  readoutNote: { fontFamily: amFonts.medium, fontSize: 19, lineHeight: 24, color: amColors.sage300 },
  noteRow: {
    flexDirection: "row",
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  noteCell: { flex: 1, alignItems: "center", gap: 2 },
  noteSwara: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16 },
  noteName: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 16 },
})
