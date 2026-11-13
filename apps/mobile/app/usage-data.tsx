import { useCallback } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { DoneButton, Group, LangRow, SheetNote } from "@/components/profile-v2/SheetBlocks"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { protoFor } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { track } from "@/lib/analytics"
import type { AnalyticsMode } from "@/lib/analytics/client"
import { statusBarStyleFor } from "@/lib/appearance"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"
import { useAnalyticsConsentStore } from "@/stores/analyticsConsentStore"
import { href } from "@/utils/href"

/**
 * "Usage data" sheet: Anonymous (the default), Shared with a random number, or Off. The choice applies at
 * once; Off also stops crash reports. What is sent and what never is: docs/analytics-flags.md.
 */
export default function UsageDataScreen() {
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const resolved = useResolvedAppearance()
  const t = useT()
  const mode = useAnalyticsConsentStore((st) => st.mode)
  const setMode = useAnalyticsConsentStore((st) => st.setMode)

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href(NAV_V2_HOME_ROUTE))
  }, [router])

  const choose = useCallback(
    (next: AnalyticsMode) => {
      if (next === mode) return
      // The change itself is reported under the NEW choice, so choosing Off sends nothing at all.
      setMode(next)
      track("consent_change", { mode: next })
    },
    [mode, setMode],
  )

  const options: readonly { id: AnalyticsMode; name: string; sub: string }[] = [
    { id: "anonymous", name: t("usageData.anonymous"), sub: t("usageData.anonymous.sub") },
    { id: "shared", name: t("usageData.shared"), sub: t("usageData.shared.sub") },
    { id: "off", name: t("usageData.off"), sub: t("usageData.off.sub") },
  ]

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <SheetShell p={p} label={t("usageData.sheet.a11y")} onClosed={onClosed}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: p.ink800 }]} accessibilityRole="header">
            {t("usageData.title")}
          </Text>
          <Text style={[styles.intro, { color: p.ink800 }]}>{t("usageData.intro")}</Text>
        </View>
        <Group p={p}>
          {options.map((option, index) => (
            <LangRow
              key={option.id}
              p={p}
              name={option.name}
              sub={option.sub}
              control="radio"
              wrap
              on={mode === option.id}
              onPress={() => choose(option.id)}
              last={index === options.length - 1}
            />
          ))}
        </Group>
        <SheetNote p={p}>{t("usageData.note.never")}</SheetNote>
        <SheetNote p={p}>{t("usageData.note.crash")}</SheetNote>
        <SheetNote p={p}>{t("usageData.note.change")}</SheetNote>
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
