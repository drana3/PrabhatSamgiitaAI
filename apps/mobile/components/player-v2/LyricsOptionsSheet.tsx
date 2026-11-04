import { Sheet } from "@/components/player-v2/Sheet"
import { SheetGroup, SheetNote, SheetRow } from "@/components/player-v2/Rows"
import type { AmTheme } from "@/constants/tokens/amColors"
import type { LyricScript, TranslationLang } from "@/stores/playerV2Store"

type Props = {
  visible: boolean
  theme: AmTheme
  script: LyricScript
  translation: TranslationLang
  wordMeanings: boolean
  /** What the current song actually has; the choice is kept, the panel falls back and the note says why. */
  hasDevanagari: boolean
  hasTranslation: boolean
  hasWordMeanings: boolean
  onCycleScript: () => void
  onCycleTranslation: () => void
  onToggleWordMeanings: () => void
  onClose: () => void
}

const TRANSLATION_LABEL: Record<TranslationLang, string> = {
  en: "English",
  ru: "Русский",
  off: "No translation",
}

/** The `Aa` sheet (prototype LYRICS DISPLAY): Script, Translation, Word meanings; each row steps through its options. */
export function LyricsOptionsSheet(props: Props) {
  const { theme } = props
  const missing: string[] = []
  if (props.script === "devanagari" && !props.hasDevanagari) missing.push("Devanagari is not available for this song yet, so it shows in Roman letters.")
  if (props.translation !== "off" && !props.hasTranslation) missing.push(`${TRANSLATION_LABEL[props.translation]} translation is not available for this song yet.`)
  if (props.wordMeanings && !props.hasWordMeanings) missing.push("Word meanings are not available for this song yet.")
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title="Lyrics display" theme={theme}>
      <SheetGroup theme={theme}>
        <SheetRow
          theme={theme}
          title="Script"
          meta="Roman letters or Devanagari"
          value={props.script === "devanagari" ? "देवनागरी" : "Roman"}
          onPress={props.onCycleScript}
        />
        <SheetRow
          theme={theme}
          title="Translation"
          meta="The language shown under each line"
          value={TRANSLATION_LABEL[props.translation]}
          onPress={props.onCycleTranslation}
        />
        <SheetRow
          theme={theme}
          title="Word meanings"
          meta="A short gloss under every word"
          value={props.wordMeanings ? "On" : "Off"}
          onPress={props.onToggleWordMeanings}
          last
        />
      </SheetGroup>
      <SheetNote theme={theme}>
        These change only what you see in the lyrics panel. The recording does not change.
        {missing.length ? `\n${missing.join(" ")}` : ""}
      </SheetNote>
    </Sheet>
  )
}
