import { useCallback, useMemo } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { DoneButton, Group, LangRow, SheetNote, SheetTitle } from "@/components/profile-v2/SheetBlocks"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { protoFor } from "@/constants/tokens/amToday"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { SCRIPT_ROWS, lyricLanguageRows } from "@/lib/languageSheet"
import { TRANSLATION_COVERAGE_FIXTURE } from "@/lib/fixtures/translations"
import { useLanguage } from "@/lib/i18n"
import { effectiveTranslations } from "@/lib/songPage/lyricLanguages"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { MAX_TRANSLATIONS } from "@/lib/songPage/translations"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

/**
 * "Script and translations" sheet (prototype LANGUAGE SHEET, Main.dc.html 2289-2313): which script the
 * lyrics are shown in and up to two translation languages under each line. Reached from the profile
 * sheet, which it replaces. Done and the scrim close it.
 */
export default function ScriptTranslationsScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const resolved = useResolvedAppearance()
  const script = useSongPageStore((st) => st.script)
  const setScript = useSongPageStore((st) => st.setScript)
  const savedTranslations = useSongPageStore((st) => st.translations)
  const toggleTranslation = useSongPageStore((st) => st.toggleTranslation)
  const appLanguage = useLanguage()
  // nothing chosen yet means the language of the app, and that is what the check shows
  const translations = useMemo(() => effectiveTranslations(savedTranslations, appLanguage), [savedTranslations, appLanguage])
  // The list is the one list of the player and the song page. What a language covers is per song, so the
  // sheet claims nothing about it (the preview shows its sample coverage).
  const rows = useMemo(() => lyricLanguageRows(MOCKUP_DATA ? TRANSLATION_COVERAGE_FIXTURE : undefined), [])

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/today"))
  }, [router])

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <SheetShell p={p} label="Script and translations" onClosed={onClosed}>
        <SheetTitle p={p} label="Script" baseline />
        <Group p={p}>
          {SCRIPT_ROWS.filter((row) => (row.id !== "both" || script === "both") && !(MOCKUP_DATA && row.id === "both")).map((row) => {
            // The prototype has no Bengali script yet: it reads "not added yet" and cannot be picked.
            const notAdded = MOCKUP_DATA && row.id === "bengali"
            return (
              <LangRow
                key={row.id}
                p={p}
                name={row.name}
                sub={notAdded ? "Bengali, not added yet" : row.sub}
                control="radio"
                on={!notAdded && script === row.id}
                dim={notAdded}
                onPress={() => (notAdded ? undefined : setScript(row.id))}
              />
            )
          })}
        </Group>

        <SheetTitle p={p} label="Translation under each line" note={`Up to ${MAX_TRANSLATIONS}`} spaced baseline />
        <Group p={p}>
          {rows.map((row, i) => (
            <LangRow
              key={row.code}
              last={i === rows.length - 1}
              p={p}
              name={row.name}
              sub={row.sub}
              control="check"
              on={translations.includes(row.code)}
              dim={row.pending}
              onPress={() => toggleTranslation(row.code)}
            />
          ))}
        </Group>
        <SheetNote p={p}>
          A song that does not have the language yet shows English and says so. Word meanings have their own language: pick it on the Words card of a song or in the player.
        </SheetNote>
        <DoneButton p={p} onPress={onClosed} />
      </SheetShell>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
