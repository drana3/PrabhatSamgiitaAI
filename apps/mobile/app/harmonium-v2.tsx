import { useCallback, useMemo, useState } from "react"
import { Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpBlockLabel, SpHowTo, SpPurpose } from "@/components/song-v2/SpGuide"
import { SpCardButton, SpKeyRow } from "@/components/song-v2/SpSections"
import { SpKeyboard, SpOverlayPage, SpReadout } from "@/components/song-v2/SpHarmonium"
import { note } from "@/components/song-v2/spType"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { Reveal } from "@/components/today/motion"
import { useSpTheme } from "@/hooks/useSpTheme"
import { PRACTISE_SONGS } from "@/lib/fixtures/harmonium"
import { usePageT } from "@/lib/songPage/pageCopy"
import { keyLabel, keyPitch } from "@/lib/songPage/spChords"
import { spKeys, type SpKey } from "@/lib/songPage/spKeyboard"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

/**
 * Harmonium keyboard (prototype `HARMONIUM KEYBOARD`, boards Harm and HarmDark): the key you sing in (Sa), a readout of the
 * last key touched, the keyboard with the swara and note on every key, and two songs to practise on.
 * Sa is the same setting the song page uses for harmonium chords. Keys sound as in the harmonium engine.
 */
export default function HarmoniumV2Screen() {
  const router = useRouter()
  const t = useSpTheme()
  const tr = useT()
  const pg = usePageT()
  const harmoniumKey = useSongPageStore((s) => s.harmoniumKey)
  const stepKey = useSongPageStore((s) => s.stepHarmoniumKey)
  const setInstrument = useSongPageStore((s) => s.setInstrument)
  // MOCKUP_DATA: the prototype board opens with the second white key (Re) lit
  const [selected, setSelected] = useState<string | null>(MOCKUP_DATA ? "w2" : null)

  const saPitch = keyPitch(harmoniumKey)
  const { whites, blacks } = useMemo(() => spKeys(saPitch), [saPitch])
  const current = [...whites, ...blacks].find((key) => key.id === selected) ?? null

  const back = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/v2/learn"))
  }, [router])

  const practise = (number: number) => {
    setInstrument("harmonium")
    router.push(href(`/song-v2/ps-${number}?tab=chords`))
  }

  return (
    <SpOverlayPage t={t} title={tr("hm.title")} onBack={back}>
      <Reveal index={0} style={{ gap: 12 }}>
        <SpPurpose t={t} text={pg("hmGuide.hm.purpose")} />
        <SpHowTo t={t} steps={[pg("hmGuide.hm.step1"), pg("hmGuide.hm.step2"), pg("hmGuide.hm.step3")]} />
      </Reveal>
      <Reveal index={1}>
        <SpKeyRow
          t={t}
          label={tr("hm.saIs")}
          noteText={pg("hmGuide.hm.saNote")}
          value={keyLabel(harmoniumKey)}
          onDown={() => stepKey(-1)}
          onUp={() => stepKey(1)}
          downLabel={tr("songPage.chords.key.lower")}
          upLabel={tr("songPage.chords.key.raise")}
          inset
        />
      </Reveal>
      <Reveal index={2} style={{ gap: 8 }}>
        <SpBlockLabel t={t} text={pg("hmGuide.hm.last")} />
        <SpReadout
          t={t}
          live
          big={current ? current.swara : "—"}
          small={current ? tr("hm.noteOn", { note: current.note }) : tr("hm.tapKey")}
        />
      </Reveal>
      <Reveal index={3} style={{ gap: 8 }}>
        <SpBlockLabel t={t} title={pg("hmGuide.hm.keys")} text={pg("hmGuide.hm.keysNote")} />
        <SpKeyboard
          t={t}
          interactive
          whites={whites}
          blacks={blacks}
          selected={selected}
          onPressKey={(key: SpKey) => setSelected(key.id)}
          tonic={harmoniumKey}
        />
      </Reveal>
      <Reveal index={4}>
        <Text style={[note(t), { paddingHorizontal: 0 }]}>
          {tr("hm.marked")}
          {MOCKUP_DATA ? ` ${tr("hm.noSound")}` : ""}
        </Text>
      </Reveal>
      <Reveal index={5}>
        <View style={{ gap: 10 }}>
          <SpBlockLabel t={t} title={tr("hm.practiseOn")} text={pg("hmGuide.hm.practiseNote")} />
          {PRACTISE_SONGS.map((song) => (
            <SpCardButton
              key={song.number}
              t={t}
              eyebrow={`PS ${song.number}`}
              title={song.title}
              onPress={() => practise(song.number)}
            />
          ))}
        </View>
      </Reveal>
    </SpOverlayPage>
  )
}
