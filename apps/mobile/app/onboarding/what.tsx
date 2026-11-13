import { useCallback } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { DoneButton, Group } from "@/components/profile-v2/SheetBlocks"
import { SheetShell } from "@/components/profile-v2/SheetShell"
import { protoFor } from "@/constants/tokens/amToday"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { useT } from "@/lib/i18n"
import { ONBOARDING_ROUTES } from "@/lib/onboarding/flow"
import { href } from "@/utils/href"

const ITEMS = [1, 2, 3, 4] as const

/**
 * "What happens when you sign in": the answer to the question every sign-in raises, in four short
 * points taken from how the sign-in actually works (docs/onboarding.md). A normal sheet: it springs up,
 * closes by swiping down or with "Got it".
 */
export default function SignInExplainerSheet() {
  const t = useT()
  const router = useRouter()
  const theme = useAmTheme()
  const p = protoFor(theme)
  const resolved = useResolvedAppearance()

  const onClosed = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href(ONBOARDING_ROUTES.signin))
  }, [router])

  return (
    <View style={styles.root}>
      <StatusBar style={statusBarStyleFor(resolved)} />
      <SheetShell p={p} label={`${t("onb.what.h1")} ${t("onb.what.h2")}`} onClosed={onClosed}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: p.ink800 }]} accessibilityRole="header">
            {t("onb.what.h1")}
            {"\n"}
            <Text style={{ color: theme.headingSecond }}>{t("onb.what.h2")}</Text>
          </Text>
        </View>
        <Group p={p}>
          {ITEMS.map((n, i) => (
            <View
              key={n}
              style={[styles.item, i < ITEMS.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line } : null]}
            >
              <Text style={[styles.itemTitle, { color: p.ink800 }]}>{t(`onb.what.${n}.title`)}</Text>
              <Text style={[styles.itemBody, { color: theme.textBody }]}>{t(`onb.what.${n}.body`)}</Text>
            </View>
          ))}
        </Group>
        <DoneButton p={p} label={t("onb.gotIt")} onPress={onClosed} />
      </SheetShell>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontFamily: amFonts.display, fontSize: 28, lineHeight: 28, letterSpacing: -0.56, textTransform: "uppercase" },
  item: { paddingHorizontal: 16, paddingVertical: 10 },
  itemTitle: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 21 },
  itemBody: { marginTop: 0, fontFamily: amFonts.regular, fontSize: 14, lineHeight: 19 },
})
