import { useCallback, useMemo, useState } from "react"
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { harmoniumKeyboardLayout } from "@prabhat/core"

import { HarmoniumKeyboard } from "@/components/harmonium-v2/Keyboard"
import { SwaraLine } from "@/components/harmonium-v2/SwaraLine"
import { Overline, PillButton, PressBox, SaStepper, SubHeader } from "@/components/harmonium-v2/ui"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { SAMPLE_HARMONIUM_SONG } from "@/data/harmoniumSample"
import { useAmTheme } from "@/hooks/useAmTheme"
import { chordKeyIndexes, noteName, parseChord, pitchClassOf, windowAround } from "@/lib/harmonium-v2/chords"
import { sliceKeyboard } from "@/lib/harmonium-v2/keyboardWindow"
import { buildHarmoniumLine, chordChips } from "@/lib/harmonium-v2/lines"
import { href } from "@/utils/href"

const STEPS = [
  { title: "Start on the root", text: "A chord is named for its first key. C starts on C. Press that key first." },
  {
    title: "Add the third",
    text: "Count four keys up for a major chord, three for a minor chord. This one note decides if it sounds bright or sad.",
  },
  { title: "Add the fifth", text: "Count seven keys up from the root. It is the same for every chord, and it makes the sound full." },
] as const

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * How chords work on the harmonium (spec SCR-23). Three numbered cards, a "Try it"
 * block where a chord lights its keys on the keyboard, and the chords of a song line.
 * Query: ?sa=D&chords=C,Am,F,G
 */
export default function HarmoniumChordsScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const params = useLocalSearchParams<{ sa?: string; chords?: string }>()
  const { width: screenWidth } = useWindowDimensions()

  const [saPitchClass, setSaPitchClass] = useState(() => pitchClassOf(firstParam(params.sa) ?? "C") ?? 0)
  const chordNames = useMemo(() => {
    const fromQuery = (firstParam(params.chords) ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => parseChord(part))
    return fromQuery.length ? fromQuery : SAMPLE_HARMONIUM_SONG.chords
  }, [params.chords])
  const [selected, setSelected] = useState<string>(() => chordNames[0] ?? "C")

  const saName = noteName(saPitchClass)
  const chips = useMemo(() => chordChips(chordNames, saName), [chordNames, saName])
  const readout = chips.find((chip) => chip.chord.name === selected) ?? chips[0]

  const lit = useMemo(() => {
    const keys = readout ? chordKeyIndexes(readout.chord, saPitchClass) : []
    if (!keys.length) return { keys: [] as ReturnType<typeof sliceKeyboard>["keys"], lit: new Set<number>() }
    const win = windowAround(keys)
    const sliced = sliceKeyboard(harmoniumKeyboardLayout(saName), win.start, win.length)
    const set = new Set(keys.map((index) => index - sliced.firstIndex).filter((i) => i >= 0 && i < sliced.keys.length))
    return { keys: sliced.keys, lit: set }
  }, [readout, saPitchClass, saName])

  const stepSa = useCallback((direction: -1 | 1) => setSaPitchClass((current) => (current + direction + 12) % 12), [])

  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/harmonium-v2"))
  }

  const keyboardWidth = screenWidth - amGap.gutter * 2
  const lines = useMemo(() => SAMPLE_HARMONIUM_SONG.lines.map((line) => buildHarmoniumLine(line)), [])

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: theme.page }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingHorizontal: amGap.gutter }]}
        showsVerticalScrollIndicator={false}
      >
        <SubHeader theme={theme} title="HOW CHORDS WORK" onBack={back} />

        <Reveal index={0} style={styles.stack}>
          <Text style={[amType.title, { color: theme.textHeading }]}>THREE KEYS AT ONCE</Text>
          <Text style={[amType.body, { color: theme.textBody }]}>
            Songs on the harmonium are played with the melody on the right hand and chords under it. A chord is three keys
            pressed together.
          </Text>
        </Reveal>

        <Reveal index={1} style={styles.stack}>
          {STEPS.map((step, index) => (
            <View key={step.title} style={[styles.step, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <View style={[styles.stepNumber, { backgroundColor: amColors.sage700 }]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={[amType.lead, { color: theme.textHeading }]}>{step.title}</Text>
                <Text style={[amType.body, { color: theme.textBody }]}>{step.text}</Text>
              </View>
            </View>
          ))}
        </Reveal>

        <Reveal index={2} style={styles.stack}>
          <Overline color={theme.eyebrow}>TRY IT</Overline>
          <SaStepper theme={theme} value={saName} onStep={stepSa} />
          <View style={styles.chips}>
            {chips.map((chip) => {
              const active = chip.chord.name === readout?.chord.name
              return (
                <PressBox
                  key={chip.chord.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Chord ${chip.chord.name}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setSelected(chip.chord.name)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? amColors.orange500 : theme.card,
                      borderColor: active ? amColors.orange500 : theme.line,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? amColors.white : theme.textHeading }]}>
                    {chip.chord.name}
                  </Text>
                </PressBox>
              )
            })}
          </View>

          {readout ? (
            <View style={[styles.readout, { backgroundColor: amColors.sage700 }]}>
              <Text style={styles.readoutTitle}>
                {readout.chord.name} {readout.kindLabel}
              </Text>
              <Text style={styles.readoutSwaras}>{readout.swaraLine}</Text>
              <Text style={styles.readoutNotes}>{readout.noteLine}</Text>
            </View>
          ) : null}

          {lit.keys.length ? (
            <HarmoniumKeyboard theme={theme} keys={lit.keys} width={keyboardWidth} lit={lit.lit} tonic={saName} />
          ) : null}
          {readout ? (
            <Text style={[amType.label, { color: theme.textBody }]}>{`From the root: ${readout.formula}`}</Text>
          ) : null}
        </Reveal>

        <Reveal index={3} style={styles.stack}>
          <Overline color={theme.eyebrow}>IN THE SONG</Overline>
          <Text style={[amType.body, { color: theme.textBody }]}>
            {`Tap a chord above a word to see its keys. Sample line from PS ${SAMPLE_HARMONIUM_SONG.number}, ${SAMPLE_HARMONIUM_SONG.title}.`}
          </Text>
          <View style={[styles.song, { backgroundColor: theme.card, borderColor: theme.line }]}>
            {lines.map((line, index) => (
              <SwaraLine
                key={index}
                theme={theme}
                words={line}
                activeChord={readout?.chord.name}
                onChordPress={(chord) => {
                  if (chips.some((chip) => chip.chord.name === chord)) setSelected(chord)
                }}
              />
            ))}
          </View>
          <PillButton theme={theme} label="Open the harmonium" onPress={() => router.push(href("/harmonium-v2"))} />
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 96, gap: amGap.section / 2 },
  stack: { gap: amGap.block },
  step: {
    flexDirection: "row",
    gap: amGap.block,
    borderRadius: amRadius.card,
    borderWidth: 1,
    padding: amGap.padCard,
  },
  stepNumber: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontFamily: amFonts.bold, fontSize: 16, color: amColors.white },
  stepBody: { flex: 1, gap: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: amGap.grid },
  chip: {
    minWidth: 56,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20 },
  readout: { borderRadius: amRadius.panel, padding: amGap.padPanel, gap: 4 },
  readoutTitle: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, color: amColors.gold300, letterSpacing: 1 },
  readoutSwaras: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 34, color: amColors.white },
  readoutNotes: { fontFamily: amFonts.medium, fontSize: 19, lineHeight: 24, color: amColors.sage300 },
  song: { borderRadius: amRadius.card, borderWidth: 1, padding: amGap.padCard, gap: amGap.block },
})
