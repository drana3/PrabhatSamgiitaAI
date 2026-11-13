import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { OnbIcon } from "@/components/onboarding/OnboardingUi"
import { Press } from "@/components/songs-v2/Press"
import { RevealClock, SongsReveal, useRevealClock } from "@/components/songs-v2/SongsReveal"
import { brandAssets } from "@/constants/brand"
import { amColors } from "@/constants/tokens/amColors"
import { amControl, amRadius } from "@/constants/tokens/amSpacing"
import { amOnboarding } from "@/constants/tokens/amOnboarding"
import { amFonts } from "@/constants/tokens/amTypography"
import { LANGUAGE_NATIVE_NAMES, useLanguage, useT } from "@/lib/i18n"
import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import { ONBOARDING_ROUTES } from "@/lib/onboarding/flow"
import { screenTopInset } from "@/lib/screenTop"
import { useOnboardingStore } from "@/stores/onboardingStore"
import { href } from "@/utils/href"

const PHOTO_MS = 600

/**
 * First screen of a new person (board Для-Дады/онбординг-v2, "Экран 0"): the dawn photo under a scrim, the
 * heading in the app's own display type, one sentence about the library, and two ways in. It has no logo, no
 * app-name line and no web address. A language label on the top right opens the language sheet at once, so a
 * person who does not read English is never stuck here. The photo develops in 600ms from a slight zoom, then the
 * rest rises in one by one (80ms apart); with Reduce motion on, everything just fades.
 * "Get started" walks the three steps; "I have an account" goes to sign in and then straight to the app.
 */
export default function WelcomeScreen() {
  const t = useT()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const language = useLanguage()
  const goTo = useOnboardingStore((s) => s.goTo)
  const setReturning = useOnboardingStore((s) => s.setReturning)
  const openedAt = useRevealClock()
  const reduce = useReducedMotion()

  const photo = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    photo.value = withTiming(1, { duration: PHOTO_MS, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
  }, [photo])
  const photoStyle = useAnimatedStyle(() => ({
    opacity: photo.value,
    transform: [{ scale: reduce ? 1 : 1.04 - 0.04 * photo.value }],
  }))

  const start = () => {
    setReturning(false)
    goTo("language")
    router.push(href(ONBOARDING_ROUTES.language))
  }
  const haveAccount = () => {
    setReturning(true)
    goTo("welcome")
    router.push(href("/onboarding/signin?returning=1"))
  }
  const name = LANGUAGE_NATIVE_NAMES[language]

  return (
    <RevealClock.Provider value={openedAt}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, photoStyle]}>
          <Image source={brandAssets.dawn} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={[...amOnboarding.welcomeScrim]}
            locations={[...amOnboarding.welcomeScrimStops]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <View style={[styles.content, { paddingTop: screenTopInset(insets.top), paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <SongsReveal index={6} style={styles.langWrap}>
            <Press
              accessibilityRole="button"
              accessibilityLabel={t("onb.welcome.language.a11y", { language: name })}
              onPress={() => router.push(href("/language"))}
              pressedScale={0.95}
              style={styles.lang}
            >
              <Text style={styles.langText}>{name}</Text>
              <OnbIcon name="chevDown" size={14} color="#FFFFFF" strokeWidth={2.4} />
            </Press>
          </SongsReveal>

          <View style={styles.grow} />

          <SongsReveal index={1}>
            <Text accessibilityRole="header" style={styles.headline}>
              {t("welcome.headline.1")}
              {"\n"}
              {t("welcome.headline.2")}
            </Text>
          </SongsReveal>
          <SongsReveal index={4}>
            <Text style={styles.support}>{t("onb.welcome.support", { count: PS_SONG_COUNT })}</Text>
          </SongsReveal>

          <SongsReveal index={5} style={styles.buttons}>
            <Press accessibilityRole="button" accessibilityLabel={t("onb.welcome.start")} onPress={start} pressedScale={0.97} style={[styles.button, { backgroundColor: amColors.orange700 }]}>
              <Text style={styles.buttonText}>{t("onb.welcome.start")}</Text>
            </Press>
            <Press accessibilityRole="button" accessibilityLabel={t("onb.welcome.account")} onPress={haveAccount} pressedScale={0.97} style={[styles.button, styles.outlined]}>
              <Text style={styles.buttonText}>{t("onb.welcome.account")}</Text>
            </Press>
            <Text style={styles.foot}>{t("onb.welcome.foot")}</Text>
          </SongsReveal>
        </View>
      </View>
    </RevealClock.Provider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#140e0a" },
  content: { flex: 1, paddingHorizontal: 24 },
  grow: { flex: 1 },
  langWrap: { alignSelf: "flex-end" },
  lang: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(18, 17, 16, 0.72)",
  },
  langText: { fontFamily: amFonts.semi, fontSize: 15, color: amColors.white },
  headline: {
    fontFamily: amFonts.display,
    fontSize: 45,
    lineHeight: 44,
    letterSpacing: -0.9,
    textTransform: "uppercase",
    color: amColors.white,
  },
  support: {
    marginTop: 16,
    maxWidth: 320,
    fontFamily: amFonts.medium,
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255, 255, 255, 0.88)",
  },
  buttons: { marginTop: 48, gap: 12 },
  button: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  outlined: { borderWidth: 1.5, borderColor: "rgba(255, 255, 255, 0.7)" },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16, color: amColors.white },
  foot: { marginTop: 4, textAlign: "center", fontFamily: amFonts.regular, fontSize: 13, lineHeight: 19, color: "rgba(255, 255, 255, 0.72)" },
})
