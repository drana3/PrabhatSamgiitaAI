import { useCallback, useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { StatusBar } from "expo-status-bar"

import { AppleMark, GoogleMark } from "@/components/account/BrandMarks"
import {
  OnbButton,
  OnbError,
  OnbEyebrow,
  OnbHeading,
  OnbLink,
  OnbPage,
  OnbReveal,
  OnbScroll,
  OnbSub,
  OnbTopBar,
} from "@/components/onboarding/OnboardingUi"
import { useOnboardingSignIn } from "@/components/onboarding/useOnboardingSignIn"
import { RevealClock, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { amFonts } from "@/constants/tokens/amTypography"
import { useResolvedAppearance } from "@/hooks/useAmTheme"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { statusBarStyleFor } from "@/lib/appearance"
import { appleSignInOffered } from "@/lib/appleAuth"
import { visibleProviders } from "@/lib/auth/signInFlow"
import { googleAuthConfigured } from "@/lib/googleAuth"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { ONBOARDING_ROUTES, TOTAL_STEPS, stepNumber } from "@/lib/onboarding/flow"
import { signInWithAppleAccount, signInWithGoogleAccount } from "@/lib/session"
import { openExternal } from "@/lib/openLink"
import { privacyUrl, termsUrl } from "@/lib/webLinks"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { href } from "@/utils/href"

/**
 * Step 2 of 3 (and the sign-in of the "I have an account" path): Apple, Google or e-mail, or go on as a
 * guest. There is no other provider and no number to type here. "What happens when I sign in" opens a short sheet
 * (app/onboarding/what.tsx). `?returning=1` is the path of a person who already has an account: no progress
 * bar, "Welcome back", and "I am new here" instead of the guest button. `?state=error` shows the failed
 * state in the web preview.
 */
export default function OnboardingSignInScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const resolved = useResolvedAppearance()
  const openedAt = useRevealClock()
  const params = useLocalSearchParams<{ returning?: string; state?: string }>()
  const storedReturning = useOnboardingStore((s) => s.returning)
  const returning = params.returning === "1" || (params.returning === undefined && storedReturning)
  const goTo = useOnboardingStore((s) => s.goTo)
  const setReturning = useOnboardingStore((s) => s.setReturning)
  const preview = MOCKUP_DATA ? params.state : undefined

  const { busy, error, run, retry, continueAsGuest } = useOnboardingSignIn(
    returning,
    preview === "error" ? { action: "google", text: t("account.error.network") } : null,
  )

  const providers = useMemo(
    () => visibleProviders({ apple: appleSignInOffered(), google: googleAuthConfigured(), microsoft: false }, MOCKUP_DATA),
    [],
  )
  const inactive = busy !== null
  const legalParts = t("account.legal", { terms: "{terms}", privacy: "{privacy}" }).split(/(\{terms\}|\{privacy\})/)

  const back = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href(returning ? ONBOARDING_ROUTES.welcome : ONBOARDING_ROUTES.language))
  }, [returning, router])

  const imNew = () => {
    setReturning(false)
    goTo("language")
    router.replace(href(ONBOARDING_ROUTES.language))
  }

  const eyebrow = returning ? t("onb.signin.returning") : t("onb.step", { step: 2, total: TOTAL_STEPS })

  return (
    <RevealClock.Provider value={openedAt}>
      <OnbPage theme={theme}>
        <StatusBar style={statusBarStyleFor(resolved)} />
        <OnbTopBar theme={theme} step={returning ? 0 : stepNumber("signin")} onBack={back} />
        <OnbScroll>
          <OnbReveal index={0}>
            <OnbEyebrow theme={theme}>{eyebrow}</OnbEyebrow>
            <OnbHeading
              theme={theme}
              first={returning ? t("onb.signin.returning.h1") : t("onb.signin.h1")}
              second={returning ? t("onb.signin.returning.h2") : t("onb.signin.h2")}
            />
            <OnbSub theme={theme}>{returning ? t("onb.signin.returning.lead") : t("onb.signin.lead")}</OnbSub>
            <OnbLink theme={theme} label={t("onb.signin.what")} onPress={() => router.push(href("/onboarding/what"))} />
          </OnbReveal>

          <View style={styles.grow} />

          <OnbReveal index={1} style={styles.stack}>
            {providers.apple ? (
              <OnbButton
                theme={theme}
                tone="black"
                tall
                label={t("account.continueWith", { provider: "Apple" })}
                icon={<AppleMark size={20} />}
                loading={busy === "apple"}
                disabled={inactive && busy !== "apple"}
                onPress={() => void run("apple", () => signInWithAppleAccount())}
              />
            ) : null}
            {providers.google ? (
              <OnbButton
                theme={theme}
                tone="white"
                tall
                label={t("account.continueWith", { provider: "Google" })}
                icon={<GoogleMark size={20} />}
                loading={busy === "google"}
                disabled={inactive && busy !== "google"}
                onPress={() => void run("google", () => signInWithGoogleAccount())}
              />
            ) : null}
            <OnbButton
              theme={theme}
              tone="ghost"
              tall
              label={t("account.continueEmail")}
              disabled={inactive}
              onPress={() => router.push(href(`/onboarding/email${returning ? "?returning=1" : ""}`))}
            />
            {error && error.action !== "email" ? <OnbError theme={theme} text={error.text} onRetry={retry} /> : null}
          </OnbReveal>

          <OnbReveal index={2} style={styles.divider}>
            <View style={[styles.rule, { backgroundColor: theme.line }]} />
            <Text style={[styles.or, { color: theme.textMuted }]}>{t("account.or")}</Text>
            <View style={[styles.rule, { backgroundColor: theme.line }]} />
          </OnbReveal>

          <OnbReveal index={3}>
            {returning ? (
              <OnbButton theme={theme} tone="quiet" label={t("onb.signin.new")} disabled={inactive} onPress={imNew} />
            ) : (
              <OnbButton theme={theme} tone="outline" label={t("onb.signin.guest")} disabled={inactive} onPress={continueAsGuest} />
            )}
            <Text style={[styles.legal, { color: theme.textMuted }]}>
              {legalParts.map((part, index) =>
                part === "{terms}" ? (
                  <Text key={index} accessibilityRole="link" onPress={() => void openExternal(termsUrl())} style={[styles.legalLink, { color: theme.textBody }]}>
                    {t("account.legal.terms")}
                  </Text>
                ) : part === "{privacy}" ? (
                  <Text key={index} accessibilityRole="link" onPress={() => void openExternal(privacyUrl())} style={[styles.legalLink, { color: theme.textBody }]}>
                    {t("account.legal.privacy")}
                  </Text>
                ) : (
                  part
                ),
              )}
            </Text>
          </OnbReveal>
        </OnbScroll>
      </OnbPage>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  grow: { flex: 1, minHeight: 24 },
  stack: { gap: 12 },
  divider: { flexDirection: "row", alignItems: "center", gap: 16, marginVertical: 16 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20 },
  legal: { marginTop: 16, textAlign: "center", paddingHorizontal: 8, fontFamily: amFonts.regular, fontSize: 13, lineHeight: 19 },
  legalLink: { fontFamily: amFonts.semi, textDecorationLine: "underline" },
})
