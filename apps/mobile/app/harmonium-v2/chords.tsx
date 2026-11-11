import { useCallback, useMemo, useState } from "react"
import { Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpKeyboard, SpChipRow, SpOverlayPage, SpReadout } from "@/components/song-v2/SpHarmonium"
import { SpBlockLabel, SpHowTo, SpPurpose } from "@/components/song-v2/SpGuide"
import { SpChordTokens, SpKeyRow } from "@/components/song-v2/SpSections"
import { bodyT, note, over, secH2 } from "@/components/song-v2/spType"
import { SpCard, SpChip, SpPill } from "@/components/song-v2/SpUi"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useT } from "@/lib/i18n"
import { usePageT } from "@/lib/songPage/pageCopy"
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

const HOW = [1, 2, 3] as const

/**
 * How chords work on the harmonium (prototype `HARMONIUM CHORDS EXPLAINER`, boards ChordHow and chordhowfull): three
 * numbered cards, then "Try it" with the key you sing in, the chord letters of the song, the three keys lit on the
 * keyboard, and the first lines of the song with the letters over the words.
 */
export default function HarmoniumChordsScreen() {
  const router = useRouter()
  const t = useSpTheme()
  const tr = useT()
  const pg = usePageT()
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
    <SpOverlayPage t={t} title={tr("hm.chordsTitle")} onBack={back}>
      <Reveal index={0} style={{ gap: 12 }}>
        <SpPurpose t={t} text={pg("hmGuide.ch.purpose")} />
        <SpHowTo t={t} steps={[pg("hmGuide.ch.step1"), pg("hmGuide.ch.step2"), pg("hmGuide.ch.step3")]} />
      </Reveal>

      <Reveal index={1} style={{ gap: 12 }}>
        <View style={{ paddingHorizontal: 10 }}>
          <Text accessibilityRole="header" style={secH2(t, 40)}>
            {tr("hm.threeKeys")}
          </Text>
          <Text style={[secH2(t, 40), { color: t.ink300 }]}>{tr("hm.atOnce")}</Text>
        </View>
        <SpBlockLabel t={t} text={pg("hmGuide.ch.ideaNote")} />
      </Reveal>

      <Reveal index={2}>
        <View style={{ gap: 10 }}>
          {HOW.map((n, index) => (
            <View
              key={n}
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
              <Text style={[secH2(t, 22), { fontSize: 22, lineHeight: 22 }]}>{tr(`hm.how${n}.title`)}</Text>
              <Text style={[bodyT(t), { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 21.6 }]}>{tr(`hm.how${n}.text`)}</Text>
            </View>
          ))}
        </View>
      </Reveal>

      <Reveal index={3} style={{ gap: 8 }}>
        {/* the label sits in a block with the page line height, so it is taller than the 16px text */}
        <View style={{ paddingHorizontal: 10, minHeight: 23, paddingTop: 3 }}>
          <Text style={over(t)}>{tr("hm.tryIt")}</Text>
        </View>
        <SpBlockLabel t={t} text={pg("hmGuide.ch.tryNote")} />
      </Reveal>

      <Reveal index={4} style={{ gap: 20 }}>
        <SpKeyRow
          t={t}
          label={tr("hm.saIs")}
          noteText={tr("hm.pickKey")}
          value={keyLabel(harmoniumKey)}
          onDown={() => stepKey(-1)}
          onUp={() => stepKey(1)}
          downLabel={tr("songPage.chords.key.lower")}
          upLabel={tr("songPage.chords.key.raise")}
          inset
        />
        <View style={{ gap: 8 }}>
          <SpBlockLabel t={t} text={pg("hmGuide.ch.pickChord")} />
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
        </View>
        <SpReadout t={t} live keepCase big={chord.name} small={chord.kind} />
        <SpKeyboard t={t} whites={whites} blacks={blacks} lit={(key) => keyInChord(key, chord)} />
        <Text style={[note(t), { paddingHorizontal: 10 }]}>{tr("hm.pressedTogether", { equation: chord.equation })}</Text>
      </Reveal>

      <Reveal index={5} style={{ gap: 20 }}>
        <SpCard t={t} style={{ marginHorizontal: 0 }}>
          <Text style={over(t)}>
            {tr("hm.inSong")} · {pg("hmGuide.ch.example")}
          </Text>
          <SpChordTokens t={t} tokens={tokens} />
          <Text style={note(t)}>{pg("hmGuide.ch.exampleNote")}</Text>
        </SpCard>
        <View style={{ gap: 8 }}>
          <SpPill t={t} label={tr("hm.openSong")} onPress={openSong} style={{ width: "100%" }} />
          <SpBlockLabel t={t} text={pg("hmGuide.ch.songNote")} />
        </View>
      </Reveal>
    </SpOverlayPage>
  )
}
