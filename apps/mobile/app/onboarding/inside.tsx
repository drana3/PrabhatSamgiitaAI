import { useCallback } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import {
  OnbButton,
  OnbEyebrow,
  OnbGroup,
  OnbHeading,
  OnbIcon,
  OnbPage,
  OnbReveal,
  OnbScroll,
  OnbTopBar,
  type OnbIconName,
} from "@/components/onboarding/OnboardingUi"
import { useFinishOnboarding } from "@/components/onboarding/useFinishOnboarding"
import { RevealClock, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { useResolvedAppearance } from "@/hooks/useAmTheme"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { useT } from "@/lib/i18n"
import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import { ONBOARDING_ROUTES, TOTAL_STEPS, stepNumber } from "@/lib/onboarding/flow"
import { href } from "@/utils/href"

const ROWS: readonly { icon: OnbIconName; key: "listen" | "chords" | "learn" | "kiirtan" | "radio" | "translations" }[] = [
  { icon: "listen", key: "listen" },
  { icon: "chords", key: "chords" },
  { icon: "learn", key: "learn" },
  { icon: "kiirtan", key: "kiirtan" },
  { icon: "radio", key: "radio" },
  { icon: "translate", key: "translations" },
]

/**
 * Step 3 of 3: what is inside the app, as six rows. Nothing to choose, no Skip: Continue ends the
 * onboarding and lands on the Kiirtan tab, where a one-time hint waits (components/onboarding/KiirtanHintHost).
 */
export default function OnboardingInsideScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const resolved = useResolvedAppearance()
  const openedAt = useRevealClock()
  const finish = useFinishOnboarding()

  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace(href(ONBOARDING_ROUTES.signin))), [router])

  return (
    <RevealClock.Provider value={openedAt}>
      <OnbPage theme={theme}>
        <StatusBar style={statusBarStyleFor(resolved)} />
        <OnbTopBar theme={theme} step={stepNumber("inside")} onBack={back} />
        <OnbScroll>
          <OnbReveal index={0}>
            <OnbEyebrow theme={theme}>{t("onb.step", { step: 3, total: TOTAL_STEPS })}</OnbEyebrow>
            <OnbHeading theme={theme} first={t("onb.inside.h1")} second={t("onb.inside.h2")} />
          </OnbReveal>
          <OnbReveal index={1}>
            <OnbGroup theme={theme} style={styles.group}>
              {ROWS.map((row, index) => (
                <View
                  key={row.key}
                  style={[styles.row, index < ROWS.length - 1 ? { borderBottomColor: theme.line, borderBottomWidth: StyleSheet.hairlineWidth } : null]}
                >
                  <View style={[styles.tile, { backgroundColor: theme.peach }]}>
                    <OnbIcon name={row.icon} size={24} color={theme.dark ? theme.accentBright : theme.brand} />
                  </View>
                  <View style={styles.text}>
                    <Text style={[styles.name, { color: theme.textHeading }]}>{t(`onb.inside.${row.key}`)}</Text>
                    <Text style={[styles.body, { color: theme.textBody }]}>{t(`onb.inside.${row.key}.body`, { count: PS_SONG_COUNT })}</Text>
                  </View>
                </View>
              ))}
            </OnbGroup>
          </OnbReveal>
          <View style={styles.grow} />
          <OnbReveal index={2}>
            <OnbButton theme={theme} label={t("onb.continue")} onPress={finish} />
          </OnbReveal>
        </OnbScroll>
      </OnbPage>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  group: { marginTop: 24 },
  grow: { flex: 1, minHeight: 24 },
  row: { paddingHorizontal: 16, paddingVertical: 8, minHeight: 60, flexDirection: "row", alignItems: "center", gap: 16 },
  tile: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  body: { marginTop: 2, fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
})
