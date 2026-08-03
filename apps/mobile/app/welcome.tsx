import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useRouter } from "expo-router"
import { Eye } from "lucide-react-native"
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { SecondaryButton } from "@/components/common/SecondaryButton"
import { brandAssets } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

const { height: screenHeight } = Dimensions.get("window")
/** Standard emblem size — smaller than Home */
const emblemSize = 112

export default function WelcomeScreen() {
  const router = useRouter()
  const setMode = useAuthStore((s) => s.setMode)
  const completeWelcome = useAuthStore((s) => s.completeWelcome)

  const enter = (mode: "guest" | "signed_in") => {
    setMode(mode)
    completeWelcome()
    router.replace(href("/(tabs)"))
  }

  return (
    <View style={styles.root}>
      <Image source={brandAssets.dawn} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={[
          "rgba(20,14,10,0.35)",
          "rgba(20,14,10,0.12)",
          "rgba(20,14,10,0.55)",
          "rgba(20,14,10,0.92)",
        ]}
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
          <Text style={styles.headline}>
            Music for{"\n"}the inner dawn
          </Text>
          <Text style={styles.support}>
            Discover 5,018 songs of devotion, hope, nature, and universal love.
          </Text>
        </View>

        <View style={styles.bottom}>
          <PrimaryButton label="Continue as Guest" onPress={() => enter("guest")} />
          <SecondaryButton
            label="Login / Sign Up"
            onPress={() => router.push(href("/signin"))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore app without sign up"
            onPress={() => enter("guest")}
            style={styles.tertiary}
          >
            <Eye size={16} color="rgba(255,255,255,0.92)" />
            <Text style={styles.tertiaryLabel}>Explore without signing up</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  upper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: spacing.xxl,
    maxHeight: screenHeight * 0.58,
  },
  brand: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.82)",
    marginTop: spacing.lg,
  },
  headline: {
    fontFamily: "Lora_700Bold",
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -0.7,
    color: colors.white,
    textAlign: "center",
    marginTop: spacing.md,
  },
  support: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    marginTop: spacing.md,
    maxWidth: 300,
  },
  bottom: {
    gap: spacing.md,
  },
  tertiary: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  tertiaryLabel: {
    ...typography.label,
    color: "rgba(255,255,255,0.92)",
  },
})
