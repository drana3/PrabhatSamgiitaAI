import { useCallback } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { DoneButton, Group, SheetNote } from "@/components/profile-v2/SheetBlocks"
import { ReviewStyleRow } from "@/components/profile-v2/ReviewStyleRow"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { protoFor } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { useT } from "@/lib/i18n"
import { REVIEW_STYLE_OPTIONS } from "@/lib/reviewStyleCopy"
import { useAppearanceStore } from "@/stores/appearanceStore"
import { href } from "@/utils/href"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"

/**
 * "Word review style" sheet (prototype REVIEW STYLE SHEET, Main.dc.html 2314-2331): the three rhythms at
 * which learned words come back. The choice is saved at once; Done and the scrim only close it.
 */
export default function ReviewStyleScreen() {
  const router = useRouter()
  const t = useT()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const resolved = useResolvedAppearance()
  const reviewStyle = useAppearanceStore((st) => st.reviewStyle)
  const setReviewStyle = useAppearanceStore((st) => st.setReviewStyle)

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href(NAV_V2_HOME_ROUTE))
  }, [router])

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <SheetShell p={p} label={t("reviewStyle.sheet.a11y")} onClosed={onClosed}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: p.ink800 }]} accessibilityRole="header">
            {t("reviewStyle.title")}
          </Text>
          <Text style={[styles.intro, { color: p.ink800 }]}>{t("reviewStyle.intro")}</Text>
        </View>
        <Group p={p}>
          {REVIEW_STYLE_OPTIONS.map((option) => (
            <ReviewStyleRow
              key={option.id}
              p={p}
              option={option}
              on={reviewStyle === option.id}
              onPress={() => setReviewStyle(option.id)}
            />
          ))}
        </Group>
        <SheetNote p={p}>{t("reviewStyle.note")}</SheetNote>
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
