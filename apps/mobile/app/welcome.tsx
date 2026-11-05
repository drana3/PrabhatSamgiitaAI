import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Press } from "@/components/songs-v2/Press"
import { brandAssets } from "@/constants/brand"
import { amColors } from "@/constants/tokens/amColors"
import { amControl, amGap, amRadius } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"
import { useT } from "@/lib/i18n"
import { NAV_V2_HOME_ROUTE } from "@/lib/navV2"

/** Standard emblem size */
const emblemSize = 96

/**
 * First screen of a new person, in the v2 look: the dawn photo, the heading in the app's own display
 * type, one way in as a guest and one way to sign in. (Two guest buttons that did the same thing are gone.)
 */
export default function WelcomeScreen() {
  const t = useT()
  const router = useRouter()
  const setMode = useAuthStore((s) => s.setMode)
  const completeWelcome = useAuthStore((s) => s.completeWelcome)

  const enterGuest = () => {
    setMode("guest")
    completeWelcome()
    router.replace(href(NAV_V2_HOME_ROUTE))
  }

  return (
    <View style={styles.root}>
      <Image source={brandAssets.dawn} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(20,14,10,0.35)", "rgba(20,14,10,0.12)", "rgba(20,14,10,0.55)", "rgba(20,14,10,0.92)"]}
        locations={[0, 0.28, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.upper}>
          <Image
            source={brandAssets.emblemClear}
            style={{ width: emblemSize, height: emblemSize }}
            contentFit="contain"
            accessibilityLabel="Prabhat Samgiita AI"
          />
          <Text style={styles.brand}>Prabhat Samgiita AI</Text>
          <Text accessibilityRole="header" style={styles.headline}>
            {t("welcome.headline.1")}
            {"\n"}
            {t("welcome.headline.2")}
          </Text>
          <Text style={styles.support}>{t("welcome.support", { count: 5018 })}</Text>
        </View>

        <View style={styles.bottom}>
          <Press
            accessibilityRole="button"
            accessibilityLabel={t("welcome.guest")}
            onPress={enterGuest}
            outerStyle={styles.buttonOuter}
            style={[styles.button, { backgroundColor: amColors.orange700 }]}
          >
            <Text style={[styles.buttonText, { color: amColors.white }]}>{t("welcome.guest")}</Text>
          </Press>
          <Press
            accessibilityRole="button"
            accessibilityLabel={t("welcome.signIn")}
            onPress={() => router.push(href("/signin"))}
            outerStyle={styles.buttonOuter}
            style={[styles.button, styles.outlined]}
          >
            <Text style={[styles.buttonText, { color: amColors.white }]}>{t("welcome.signIn")}</Text>
          </Press>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#140e0a" },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: amGap.gutter + 14, paddingBottom: 24 },
  upper: { flex: 1, alignItems: "flex-start", justifyContent: "flex-end", paddingBottom: 32, gap: 12 },
  brand: {
    fontFamily: amFonts.semi,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.82)",
    marginTop: 12,
  },
  headline: {
    fontFamily: amFonts.display,
    fontSize: 45,
    lineHeight: 44,
    letterSpacing: -0.9,
    textTransform: "uppercase",
    color: amColors.white,
  },
  support: {
    fontFamily: amFonts.medium,
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.88)",
    maxWidth: 320,
  },
  bottom: { gap: 12 },
  buttonOuter: { alignSelf: "stretch", minHeight: 48 },
  button: {
    height: amControl.pillHeight,
    borderRadius: amRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  outlined: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)" },
  buttonText: { fontFamily: amFonts.semi, fontSize: 16 },
})
