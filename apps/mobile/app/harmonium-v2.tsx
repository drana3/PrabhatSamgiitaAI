import { useCallback, useMemo, useState } from "react"
import { Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpCardButton, SpKeyRow } from "@/components/song-v2/SpSections"
import { SpKeyboard, SpOverlayPage, SpReadout } from "@/components/song-v2/SpHarmonium"
import { note, over } from "@/components/song-v2/spType"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { Reveal } from "@/components/today/motion"
import { useSpTheme } from "@/hooks/useSpTheme"
import { PRACTISE_SONGS } from "@/lib/fixtures/harmonium"
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
    router.push(href(`/song-v2/ps-${number}?section=chords`))
  }

  return (
    <SpOverlayPage t={t} title="Harmonium" onBack={back}>
      <Reveal index={0}>
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
      </Reveal>
      <Reveal index={1}>
        <SpReadout
          t={t}
          live
          big={current ? current.swara : "—"}
          small={current ? `${current.note} on the harmonium` : "Tap a key"}
        />
      </Reveal>
      <Reveal index={2}>
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
      <Reveal index={3}>
        <Text style={[note(t), { paddingHorizontal: 0 }]}>
          Sa and the other swaras are marked on the keys that belong to the key you picked.
          {MOCKUP_DATA ? " Sound is not part of this mockup." : ""}
        </Text>
      </Reveal>
      <Reveal index={4}>
        <View style={{ gap: 10 }}>
          <View style={{ paddingHorizontal: 10 }}>
            <Text style={over(t)}>Practise on</Text>
          </View>
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
