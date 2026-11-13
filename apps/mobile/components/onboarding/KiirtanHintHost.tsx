import { useEffect } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { usePathname } from "expo-router"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { OnbButton } from "@/components/onboarding/OnboardingUi"
import { amSpring } from "@/constants/tokens/amMotion"
import { amOnboarding } from "@/constants/tokens/amOnboarding"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { shouldShowKiirtanHint } from "@/lib/onboarding/flow"
import { useAuthStore } from "@/stores/authStore"
import { useOnboardingStore } from "@/stores/onboardingStore"

/**
 * The one-time hint on the Kiirtan tab, right after the onboarding: the page dims and a card says that every
 * Kiirtan has its own page. It is armed by the end of the onboarding (onboardingStore.kiirtanHintPending), shows
 * on the first visit to the Kiirtan tab only, and "Got it" or a tap on the dim closes it for good. It lives at the
 * root of the app so the Kiirtan tab's own files stay untouched.
 */
export function KiirtanHintHost() {
  const pathname = usePathname()
  const pending = useOnboardingStore((s) => s.kiirtanHintPending)
  const welcomed = useAuthStore((s) => s.hasCompletedWelcome)
  if (!welcomed || !shouldShowKiirtanHint({ pending, pathname })) return null
  return <Hint />
}

function Hint() {
  const t = useT()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const dismiss = useOnboardingStore((s) => s.dismissKiirtanHint)

  const shown = useSharedValue(0)
  useEffect(() => {
    shown.value = reduce ? withTiming(1, { duration: 150 }) : withSpring(1, amSpring.default)
  }, [reduce, shown])
  const dimStyle = useAnimatedStyle(() => ({ opacity: shown.value }))
  const cardStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: reduce ? 0 : (1 - shown.value) * 16 }],
  }))

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: amOnboarding.dimHint }, dimStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("onb.gotIt")} onPress={dismiss} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        style={[
          styles.card,
          { bottom: 128 + Math.max(insets.bottom - 34, 0), backgroundColor: theme.dark ? theme.inner : theme.card, borderColor: theme.dark ? theme.glassEdge : "transparent" },
          cardStyle,
        ]}
      >
        <Text style={[styles.eyebrow, { color: theme.accentText }]}>{t("onb.hint.eyebrow")}</Text>
        <Text style={[styles.title, { color: theme.textHeading }]} accessibilityRole="header">
          {t("onb.hint.title")}
        </Text>
        <Text style={[styles.body, { color: theme.textBody }]}>{t("onb.hint.body")}</Text>
        <OnbButton theme={theme} label={t("onb.gotIt")} onPress={dismiss} style={styles.button} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { position: "absolute", left: 20, right: 20, borderRadius: 20, borderWidth: 1, padding: 20 },
  eyebrow: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  title: { marginTop: 8, fontFamily: amFonts.display, fontSize: 24, lineHeight: 24, letterSpacing: -0.48, textTransform: "uppercase" },
  body: { marginTop: 8, fontFamily: amFonts.regular, fontSize: 15, lineHeight: 22 },
  button: { marginTop: 16 },
})
