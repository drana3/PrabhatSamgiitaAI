import { useCallback, useMemo, useState } from "react"
import { Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpKeyboard, SpChipRow, SpOverlayPage, SpReadout } from "@/components/song-v2/SpHarmonium"
import { SpChordTokens, SpKeyRow } from "@/components/song-v2/SpSections"
import { bodyT, note, over, secH2 } from "@/components/song-v2/spType"
import { SpCard, SpChip, SpPill } from "@/components/song-v2/SpUi"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSpTheme } from "@/hooks/useSpTheme"
import { EXPLAINER_SONG_LINES } from "@/lib/fixtures/harmonium"
import { keyLabel, keyPitch } from "@/lib/songPage/spChords"
import {
  EXPLAINER_CHORDS,
  explainChord,
  explainerTokens,
  keyInChord,
  spKeys,
} from "@/lib/songPage/spKeyboard"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

const HOW = [
  {
    title: "Two hands, two jobs",
    text: "Your right hand plays the keys. Your left hand pumps the bellows with a steady push and pull. If your harmonium has a drone stop, open it: Sa then hums under the whole song.",
  },
  {
    title: "A chord is three keys",
    text: "Press a root key, the key 4 steps above it and the key 7 steps above it, all together. Count every key, black ones too. In a minor chord the middle key is 3 steps above the root, not 4.",
  },
  {
    title: "Letters tell you when",
    text: "The letter above a word is the chord to press on that word. Hold it until the next letter appears.",
  },
] as const

/**
 * How chords work on the harmonium (prototype `HARMONIUM CHORDS EXPLAINER`, boards ChordHow and chordhowfull): three
 * numbered cards, then "Try it" with the key you sing in, the chord letters of the song, the three keys lit on the
 * keyboard, and the first lines of the song with the letters over the words.
 */
export default function HarmoniumChordsScreen() {
  const router = useRouter()
  const t = useSpTheme()
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey)
  const stepKey = useSongPageStore((s) => s.stepHarmoniumKey)
  const setInstrument = useSongPageStore((s) => s.setInstrument)
  // MOCKUP_DATA: the prototype boards open with Am picked
  const [base, setBase] = useState<string>(MOCKUP_DATA ? "Am" : EXPLAINER_CHORDS[0])

  const saPitch = keyPitch(harmoniumKey)
  const chord = useMemo(() => explainChord(base, saPitch), [base, saPitch])
  const { whites, blacks } = useMemo(() => spKeys(saPitch), [saPitch])
  const tokens = useMemo(() => explainerTokens(EXPLAINER_SONG_LINES, saPitch), [saPitch])

  const back = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/v2/learn"))
  }, [router])

  const openSong = () => {
    setInstrument("harmonium")
    router.push(href("/song-v2/ps-1?section=chords"))
  }

  return (
    <SpOverlayPage t={t} title="Harmonium chords" onBack={back}>
      <Reveal index={0}>
        <View style={{ paddingHorizontal: 10 }}>
          <Text accessibilityRole="header" style={secH2(t, 40)}>
            Three keys
          </Text>
          <Text style={[secH2(t, 40), { color: t.ink300 }]}>at once</Text>
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={{ gap: 10 }}>
          {HOW.map((card, index) => (
            <View
              key={card.title}
              style={{
                gap: 12,
                padding: 25,
                borderRadius: 30,
                borderWidth: 1,
                backgroundColor: t.white,
                borderColor: t.sand300,
              }}
            >
              <Text
                style={{ fontFamily: amFonts.display, fontSize: 44, lineHeight: 44, color: t.orange500 }}
              >
                {index + 1}
              </Text>
              <Text style={[secH2(t, 22), { fontSize: 22, lineHeight: 22 }]}>{card.title}</Text>
              <Text style={[bodyT(t), { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 21.6 }]}>{card.text}</Text>
            </View>
          ))}
        </View>
      </Reveal>

      <Reveal index={2}>
        {/* the label sits in a block with the page line height, so it is taller than the 16px text */}
        <View style={{ paddingHorizontal: 10, minHeight: 23, paddingTop: 3 }}>
          <Text style={over(t)}>Try it</Text>
        </View>
      </Reveal>

      <Reveal index={3} style={{ gap: 20 }}>
        <SpKeyRow
          t={t}
          label="Sa is"
          noteText="Pick the key you sing in"
          value={keyLabel(harmoniumKey)}
          onDown={() => stepKey(-1)}
          onUp={() => stepKey(1)}
          downLabel="Lower the key"
          upLabel="Raise the key"
          inset
        />
        <SpChipRow>
          {EXPLAINER_CHORDS.map((name) => (
            <SpChip
              key={name}
              t={t}
              label={explainChord(name, saPitch).name}
              on={name === base}
              onPress={() => setBase(name)}
            />
          ))}
        </SpChipRow>
        <SpReadout t={t} live keepCase big={chord.name} small={chord.kind} />
        <SpKeyboard t={t} whites={whites} blacks={blacks} lit={(key) => keyInChord(key, chord)} />
        <Text style={[note(t), { paddingHorizontal: 10 }]}>{`${chord.equation}. Orange keys are pressed together.`}</Text>
      </Reveal>

      <Reveal index={4} style={{ gap: 20 }}>
        <SpCard t={t} style={{ marginHorizontal: 0 }}>
          <Text style={over(t)}>In the song</Text>
          <SpChordTokens t={t} tokens={tokens} />
          <Text style={note(t)}>
            Press the chord when its letter appears over a word. The swara under each word is the note to hold.
          </Text>
        </SpCard>
        <SpPill t={t} label="Open this song's chords" onPress={openSong} style={{ width: "100%" }} />
      </Reveal>
    </SpOverlayPage>
  )
}
