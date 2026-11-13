import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"

import { SpPill, SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { usePageT } from "@/lib/songPage/pageCopy"
import { href } from "@/utils/href"

import { Segmented } from "./ui"

/** The scripts the words under the chord letters can be in: Roman always, Devanagari when the song has a Devanagari text. */
export type ChordScript = "roman" | "devanagari"

/** One version of the chords the reader can choose: the song's own, a colleague's page, a member's chart. */
export type ChordVersion = { id: string; label: string; a11y: string }

/**
 * THE VERSION SWITCH at the top of the Chords tab: one round chip for each version of the chords this song has (the
 * main chart, the colleagues' pages, every chart a member offered). It is not drawn when there is only one version. The
 * "Offer chords" chip at its end is the way in for members; it is always there.
 */
export function ChordVersionChips({
  t,
  songNumber,
  versions,
  value,
  onChange,
}: {
  t: SpTheme
  songNumber: number | null
  versions: readonly ChordVersion[]
  value: string
  onChange: (id: string) => void
}) {
  const tr = usePageT()
  const tm = useT()
  const router = useRouter()
  const offer = songNumber === null ? null : (
    <SpPill t={t} variant="sand" icon="plus" label={tm("chordSong.offer")} style={styles.offer} onPress={() => router.push(href(`/upload-chords?song=${songNumber}`))} />
  )
  return (
    <View style={styles.row}>
      {versions.length > 1 ? (
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={tr("songChords.version.a11y")}>
          {versions.map((v) => {
            const on = v.id === value
            return (
              <SpPress
                key={v.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={v.a11y}
                onPress={() => onChange(v.id)}
                pressedScale={0.96}
                style={[styles.chip, { backgroundColor: on ? t.ink900 : t.white, borderColor: on ? t.ink900 : t.sand300 }]}
              >
                <Text style={[styles.chipText, { color: on ? t.onInk : t.ink800 }]} numberOfLines={1}>
                  {v.label}
                </Text>
              </SpPress>
            )
          })}
        </View>
      ) : null}
      {offer}
    </View>
  )
}

/** The small Roman / Devanagari switch next to "Chords over the words"; drawn only when the song has a Devanagari text. */
export function ChordScriptSwitch({ t, value, onChange }: { t: SpTheme; value: ChordScript; onChange: (script: ChordScript) => void }) {
  const tr = usePageT()
  return (
    <Segmented
      t={t}
      compact
      items={[
        { id: "roman", label: tr("songChords.script.roman") },
        { id: "devanagari", label: tr("songChords.script.devanagari") },
      ]}
      value={value}
      onChange={onChange}
      label={tr("songChords.script.a11y")}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  offer: { height: 44 },
  chipText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
})
