import { StyleSheet, Text, View } from "react-native"

import { Chip, ChipRow, SectionLabel } from "@/components/player-v2/Rows"
import { Sheet } from "@/components/player-v2/Sheet"
import { amSpace } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import type { AmTheme } from "@/constants/tokens/amColors"
import type { LyricScript, TranslationLang } from "@/stores/playerV2Store"

type Props = {
  visible: boolean
  theme: AmTheme
  script: LyricScript
  translation: TranslationLang
  wordMeanings: boolean
  /** What the current song actually has. Options without data are shown but disabled, with the reason. */
  hasDevanagari: boolean
  hasLineTranslation: boolean
  hasWordMeanings: boolean
  onScript: (script: LyricScript) => void
  onTranslation: (lang: TranslationLang) => void
  onWordMeanings: (on: boolean) => void
  onClose: () => void
}

/** The `Aa` sheet: Script, Translation, Word meanings (SCR-31). */
export function LyricsOptionsSheet(props: Props) {
  const { theme } = props
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title="Lyrics" theme={theme} heightShare={0.52}>
      <SectionLabel theme={theme}>Script</SectionLabel>
      <ChipRow>
        <Chip theme={theme} label="Roman" selected={props.script === "roman"} onPress={() => props.onScript("roman")} />
        <Chip
          theme={theme}
          label="Devanagari"
          selected={props.script === "devanagari"}
          disabled={!props.hasDevanagari}
          onPress={() => props.onScript("devanagari")}
        />
      </ChipRow>

      <SectionLabel theme={theme}>Translation</SectionLabel>
      <ChipRow>
        <Chip
          theme={theme}
          label="English"
          selected={props.translation === "en"}
          disabled={!props.hasLineTranslation}
          onPress={() => props.onTranslation("en")}
        />
        <Chip theme={theme} label="Off" selected={props.translation === "off"} onPress={() => props.onTranslation("off")} />
      </ChipRow>
      {!props.hasLineTranslation ? (
        <Text style={[amType.body, styles.note, { color: theme.textBody }]}>
          Line-by-line translation is not available for this song yet.
        </Text>
      ) : null}

      <SectionLabel theme={theme}>Word meanings</SectionLabel>
      <ChipRow>
        <Chip
          theme={theme}
          label="On"
          selected={props.wordMeanings}
          disabled={!props.hasWordMeanings}
          onPress={() => props.onWordMeanings(true)}
        />
        <Chip theme={theme} label="Off" selected={!props.wordMeanings} onPress={() => props.onWordMeanings(false)} />
      </ChipRow>
      {!props.hasWordMeanings ? (
        <View>
          <Text style={[amType.body, styles.note, { color: theme.textBody }]}>
            Word meanings need word-level data (API-11) and are not available yet.
          </Text>
        </View>
      ) : null}
    </Sheet>
  )
}

const styles = StyleSheet.create({
  note: { marginTop: amSpace.s2 },
})
