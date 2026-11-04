import { useCallback, useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { DoneButton, Group, LangRow, LanguageSearch, SheetNote, SheetTitle } from "@/components/profile-v2/SheetBlocks"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { protoFor } from "@/constants/tokens/amToday"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { SCRIPT_ROWS, languageRows, languageSearchPlaceholder } from "@/lib/languageSheet"
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

  const rows = useMemo(() => languageRows(query), [query])

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
          {SCRIPT_ROWS.map((row) => (
            <LangRow
              key={row.id}
              p={p}
              name={row.name}
              sub={row.sub}
              control="radio"
              on={script === row.id}
              onPress={() => setScript(row.id)}
            />
          ))}
        </Group>

        <SheetTitle p={p} label="Translation under each line" note={`Up to ${MAX_TRANSLATIONS}`} spaced baseline />
        <LanguageSearch p={p} value={query} onChangeText={setQuery} placeholder={languageSearchPlaceholder()} />
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
                onPress={() => toggleTranslation(row.code)}
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
