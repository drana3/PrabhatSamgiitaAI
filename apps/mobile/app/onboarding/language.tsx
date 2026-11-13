import { useCallback } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { OnbButton, OnbEyebrow, OnbGroup, OnbHeading, OnbNote, OnbPage, OnbRadio, OnbReveal, OnbScroll, OnbSub, OnbTopBar } from "@/components/onboarding/OnboardingUi"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amOnboarding } from "@/constants/tokens/amOnboarding"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useResolvedAppearance } from "@/hooks/useAmTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { LANGUAGE_NATIVE_NAMES, hiddenLanguages, offeredLanguages, useLanguage, useT } from "@/lib/i18n"
import { ONBOARDING_ROUTES, TOTAL_STEPS, stepNumber } from "@/lib/onboarding/flow"
import { useLanguageStore } from "@/stores/languageStore"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { href } from "@/utils/href"

/**
 * Step 1 of 3: the language of the app's buttons and menus. Only the finished languages are listed (the
 * same list as Profile > Language: lib/i18n/registry.ts), English is chosen at first, and a tap applies at
 * once. No Skip: choosing is one tap and Continue is always there.
 */
export default function OnboardingLanguageScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const resolved = useResolvedAppearance()
  const openedAt = useRevealClock()
  const active = useLanguage()
  const preference = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const goTo = useOnboardingStore((s) => s.goTo)
  const selectedId = preference === "auto" ? active : preference
  const selectedFill = theme.dark ? amOnboarding.dark.selected : amOnboarding.light.selected

  const back = useCallback(() => (router.canGoBack() ? router.back() : router.replace(href(ONBOARDING_ROUTES.welcome))), [router])
  const next = () => {
    goTo("signin")
    router.push(href(ONBOARDING_ROUTES.signin))
  }

  return (
    <RevealClock.Provider value={openedAt}>
      <OnbPage theme={theme}>
        <StatusBar style={statusBarStyleFor(resolved)} />
        <OnbTopBar theme={theme} step={stepNumber("language")} onBack={back} />
        <OnbScroll>
        <OnbReveal index={0}>
          <OnbEyebrow theme={theme}>{t("onb.step", { step: 1, total: TOTAL_STEPS })}</OnbEyebrow>
          <OnbHeading theme={theme} first={t("onb.language.h1")} second={t("onb.language.h2")} />
          <OnbSub theme={theme}>{t("onb.language.sub")}</OnbSub>
        </OnbReveal>
        <OnbReveal index={1} style={styles.list}>
          <OnbGroup theme={theme} style={{ marginTop: 24 }}>
            {offeredLanguages().map((id, index) => {
              const on = id === selectedId
              const english = t(`language.name.${id}`)
              const sub = english === LANGUAGE_NATIVE_NAMES[id] ? "" : english
              return (
                <Press
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={sub ? `${LANGUAGE_NATIVE_NAMES[id]}, ${sub}` : LANGUAGE_NATIVE_NAMES[id]}
                  onPress={() => setLanguage(id)}
                  pressedScale={0.99}
                  style={[
                    styles.row,
                    { backgroundColor: on ? selectedFill : "transparent", borderBottomColor: theme.line, borderBottomWidth: index === offeredLanguages().length - 1 ? 0 : StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={styles.text}>
                    <Text style={[styles.name, { color: theme.textHeading }]}>{LANGUAGE_NATIVE_NAMES[id]}</Text>
                    {sub ? <Text style={[styles.sub, { color: theme.textMuted }]}>{"‎" + sub}</Text> : null}
                  </View>
                  <OnbRadio theme={theme} on={on} />
                </Press>
              )
            })}
          </OnbGroup>
          {hiddenLanguages().length > 0 ? <OnbNote theme={theme} style={{ marginTop: 16 }}>{t("onb.language.more")}</OnbNote> : null}
        </OnbReveal>
        <View style={styles.grow} />
        <OnbReveal index={2}>
          <OnbButton theme={theme} label={t("onb.continue")} onPress={next} style={styles.cta} />
        </OnbReveal>
        </OnbScroll>
      </OnbPage>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  list: { alignSelf: "stretch" },
  grow: { flex: 1, minHeight: 24 },
  cta: { marginTop: 0 },
  row: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: amFonts.medium, fontSize: 17, lineHeight: 22 },
  sub: { fontFamily: amFonts.regular, fontSize: 13, lineHeight: 18 },
})
