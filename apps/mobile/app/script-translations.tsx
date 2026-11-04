import { useCallback, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { DoneButton, Group, LangRow, LanguageSearch, SheetNote, SheetTitle } from "@/components/profile-v2/SheetBlocks"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { protoFor } from "@/constants/tokens/amToday"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { SCRIPT_ROWS, languageRows, languageSearchPlaceholder, sampleLanguageRows } from "@/lib/languageSheet"
import { SAMPLE_LANGUAGE_COUNT } from "@/lib/fixtures/translations"
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
  const translations = useSongPageStore((st) => st.translations)
  const toggleTranslation = useSongPageStore((st) => st.toggleTranslation)
  const [query, setQuery] = useState("")

  const [requested, setRequested] = useState<ReadonlySet<string>>(new Set())
  const rows = useMemo(
    () =>
      MOCKUP_DATA
        ? sampleLanguageRows(query, requested)
        : languageRows(query).map((row) => ({ code: row.code, name: row.name, native: row.native, pending: false, action: "" })),
    [query, requested],
  )

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
        <LanguageSearch p={p} value={query} onChangeText={setQuery} placeholder={MOCKUP_DATA ? languageSearchPlaceholder(SAMPLE_LANGUAGE_COUNT) : languageSearchPlaceholder()} />
        {rows.length > 0 ? (
          <Group p={p}>
            {rows.map((row) => (
              <LangRow
                key={row.code}
                p={p}
                name={row.name}
                sub={row.native}
                control="check"
                on={translations.includes(row.code)}
                action={row.action || undefined}
                dim={row.pending}
                onPress={() =>
                  row.pending ? setRequested((prev) => new Set(prev).add(row.code)) : toggleTranslation(row.code)
                }
              />
            ))}
          </Group>
        ) : (
          <SheetNote p={p}>No language matches your search.</SheetNote>
        )}
        <SheetNote p={p}>
          Word meanings can be shown in the same languages. Where a language has lines only, word meanings stay in English.
        </SheetNote>
        <DoneButton p={p} onPress={onClosed} />
      </SheetShell>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
