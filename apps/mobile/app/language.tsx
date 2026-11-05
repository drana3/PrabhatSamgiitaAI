import { useCallback } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { DoneButton, Group, LangRow, SheetNote } from "@/components/profile-v2/SheetBlocks"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { protoFor } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { LANGUAGES, LANGUAGE_NATIVE_NAMES, useT, type LanguagePreference } from "@/lib/i18n"
import { useLanguageStore } from "@/stores/languageStore"
import { href } from "@/utils/href"

/**
 * "Language" sheet: the language of the app's own buttons, menus and messages. Automatic follows the
 * device; English, Русский and Español are each written in their own script. The choice applies at
 * once (every screen that calls useT() re-renders); Done and the scrim only close the sheet.
 * Song lyrics, meanings and song translations are a different setting (Script and translations).
 */
export default function LanguageScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const resolved = useResolvedAppearance()
  const t = useT()
  const preference = useLanguageStore((st) => st.language)
  const setLanguage = useLanguageStore((st) => st.setLanguage)

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/today"))
  }, [router])

  const options: readonly { id: LanguagePreference; name: string; sub: string }[] = [
    { id: "auto", name: t("language.auto"), sub: t("language.autoSub") },
    ...LANGUAGES.map((id) => {
      // the language's name in the current interface language, shown under its own name unless identical
      const inCurrent = t(`language.name.${id}`)
      return { id, name: LANGUAGE_NATIVE_NAMES[id], sub: inCurrent === LANGUAGE_NATIVE_NAMES[id] ? "" : inCurrent }
    }),
  ]

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <SheetShell p={p} label={t("language.title")} onClosed={onClosed}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: p.ink800 }]} accessibilityRole="header">
            {t("language.title")}
          </Text>
          <Text style={[styles.intro, { color: p.ink800 }]}>{t("language.intro")}</Text>
        </View>
        <Group p={p}>
          {options.map((option) => (
            <LangRow
              key={option.id}
              p={p}
              name={option.name}
              sub={option.sub}
              control="radio"
              on={preference === option.id}
              onPress={() => setLanguage(option.id)}
            />
          ))}
        </Group>
        <SheetNote p={p}>{t("language.note")}</SheetNote>
        <DoneButton p={p} label={t("common.done")} onPress={onClosed} />
      </SheetShell>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingBottom: 16 },
  title: {
    fontFamily: amFonts.display,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.56,
    textTransform: "uppercase",
  },
  intro: { marginTop: 8, fontFamily: amFonts.regular, fontSize: 15, lineHeight: 23.25 },
})
