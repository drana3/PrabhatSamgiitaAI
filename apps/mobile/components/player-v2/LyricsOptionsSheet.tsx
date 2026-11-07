import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { Sheet } from "@/components/player-v2/Sheet"
import { Radio, SheetGroup, SheetNote, SheetPill, SheetRow } from "@/components/player-v2/Rows"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import {
  LYRIC_LANGUAGES,
  OFF,
  REQUESTED_LABEL,
  REQUEST_LABEL,
  lyricGaps,
  lyricLanguage,
  lyricLanguageName,
} from "@/lib/songPage/lyricLanguages"
import type { LyricScript } from "@/stores/playerV2Store"
import { t, useT } from "@/lib/i18n"

type Props = {
  visible: boolean
  theme: AmTheme
  script: LyricScript
  /** "off" or a language code (the saved choice with "follow the app" already resolved) */
  translation: string
  wordLanguage: string
  /** What the current song actually has; the choice is kept, the panel falls back and the note says why. */
  hasDevanagari: boolean
  hasTranslationIn: (code: string) => boolean
  hasWordMeaningsIn: (code: string) => boolean
  /** languages the person already asked for (kept by the screen, like the song page) */
  requested: readonly string[]
  onCycleScript: () => void
  onPickTranslation: (choice: string) => void
  onPickWordLanguage: (choice: string) => void
  onRequest: (code: string) => void
  onClose: () => void
}

type Page = "main" | "translation" | "words"

/** What a row of the main page shows on the right: the language in its own script, or Off. */
function valueOf(choice: string): string {
  return choice === OFF ? t("common.off") : (lyricLanguage(choice)?.native ?? choice)
}

/**
 * The `Aa` sheet (prototype LYRICS DISPLAY): Script, Translation, Word meanings. Script steps
 * through its two options; Translation and Word meanings open a list of the same languages (the
 * one list of lib/songPage/lyricLanguages.ts) plus Off. A language the current song does not have
 * can still be chosen: the choice is kept for the songs that have it, and this song says plainly
 * that it shows English instead (and offers Request), never another language under the wrong name.
 */
export function LyricsOptionsSheet(props: Props) {
  const t = useT()
  const { theme } = props
  const [page, setPage] = useState<Page>("main")
  useEffect(() => {
    if (!props.visible) setPage("main")
  }, [props.visible])

  const gaps = lyricGaps({
    translation: props.translation,
    wordLanguage: props.wordLanguage,
    hasTranslationIn: props.hasTranslationIn,
    hasWordMeaningsIn: props.hasWordMeaningsIn,
  })

  if (page !== "main") {
    const isTranslation = page === "translation"
    const current = isTranslation ? props.translation : props.wordLanguage
    const has = isTranslation ? props.hasTranslationIn : props.hasWordMeaningsIn
    const choose = (choice: string) => {
      if (isTranslation) props.onPickTranslation(choice)
      else props.onPickWordLanguage(choice)
      setPage("main")
    }
    return (
      <Sheet visible={props.visible} onClose={props.onClose} title={isTranslation ? t("player.lyrics.translation") : t("player.lyrics.words")} theme={theme}>
        <SheetGroup theme={theme}>
          <SheetRow theme={theme} title={t("player.lyrics.back")} onPress={() => setPage("main")} />
          {LYRIC_LANGUAGES.map((language) => {
            const missing = !has(language.code)
            const english = language.native === language.name ? "" : language.name
            const meta = [english, missing ? t("player.lyrics.missing") : ""].filter(Boolean).join(" · ")
            return (
              <SheetRow
                key={language.code}
                theme={theme}
                title={language.native}
                meta={meta || undefined}
                accessibilityRole="radio"
                selected={current === language.code}
                trailing={<Radio theme={theme} on={current === language.code} />}
                onPress={() => choose(language.code)}
              />
            )
          })}
          <SheetRow
            theme={theme}
            title={t("common.off")}
            meta={isTranslation ? t("player.lyrics.noTranslation") : t("player.lyrics.noGloss")}
            accessibilityRole="radio"
            selected={current === OFF}
            trailing={<Radio theme={theme} on={current === OFF} />}
            onPress={() => choose(OFF)}
            last
          />
        </SheetGroup>
        <SheetNote theme={theme}>
          {t("player.lyrics.kept")}
        </SheetNote>
      </Sheet>
    )
  }

  const note: string[] = []
  if (props.script === "devanagari" && !props.hasDevanagari) note.push(t("player.lyrics.noDeva"))
  return (
    <Sheet visible={props.visible} onClose={props.onClose} title={t("player.lyrics.title")} theme={theme}>
      <SheetGroup theme={theme}>
        <SheetRow
          theme={theme}
          title={t("player.lyrics.script")}
          meta={t("player.lyrics.scriptMeta")}
          value={props.script === "devanagari" ? "देवनागरी" : t("songs.script.roman")}
          onPress={props.onCycleScript}
        />
        <SheetRow
          theme={theme}
          title={t("player.lyrics.translation")}
          meta={t("player.lyrics.translationMeta")}
          value={valueOf(props.translation)}
          onPress={() => setPage("translation")}
        />
        <SheetRow
          theme={theme}
          title={t("player.lyrics.words")}
          meta={t("player.lyrics.wordsMeta")}
          value={valueOf(props.wordLanguage)}
          onPress={() => setPage("words")}
          last
        />
      </SheetGroup>
      {gaps.map((gap) => {
        const asked = props.requested.includes(gap.wanted)
        return (
          <View key={gap.kind} style={styles.gap}>
            <Text style={[styles.gapText, { color: theme.textBody }]}>
              {gap.kind === "translation" ? t("player.lyrics.translation") : t("player.lyrics.words")}: {gap.text}
            </Text>
            {asked ? (
              <Text style={[styles.requested, { color: theme.textMuted }]}>{REQUESTED_LABEL}</Text>
            ) : (
              <SheetPill
                theme={theme}
                tone="sand"
                label={`${REQUEST_LABEL} ${lyricLanguageName(gap.wanted)}`}
                onPress={() => props.onRequest(gap.wanted)}
              />
            )}
          </View>
        )
      })}
      <SheetNote theme={theme}>
        {t("player.lyrics.only")}
        {note.length ? `\n${note.join(" ")}` : ""}
      </SheetNote>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  gap: { paddingHorizontal: 20, paddingTop: 12, gap: 8, alignItems: "flex-start" },
  gapText: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 19 },
  requested: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 19 },
})
