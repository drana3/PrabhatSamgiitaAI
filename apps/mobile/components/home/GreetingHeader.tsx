import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { brandAssets } from "@/constants/brand"
import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { greetFirstName, memberProfileName } from "@/lib/displayName"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

const { width: screenWidth } = Dimensions.get("window")
const emblemSize = Math.min(screenWidth * 0.34, 148)

/** Home header — original dawn background only. */
export function GreetingHeader() {
  const router = useRouter()
  const displayName = useAuthStore((s) => s.displayName)
  const email = useAuthStore((s) => s.email)
  const mode = useAuthStore((s) => s.mode)
  const displayNameOverridden = useAuthStore((s) => s.displayNameOverridden)
  const firstName =
    mode === "guest"
      ? ""
      : greetFirstName(displayName, email) ||
        memberProfileName({
          mode: "signed_in",
          email,
          displayName,
          displayNameOverridden,
        }).split(/\s+/)[0] ||
        ""
  const greeting =
    mode === "guest" || !firstName ? "Namaskar" : `Namaskar ${firstName}`

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Image
        pointerEvents="none"
        source={brandAssets.dawn}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(250,247,242,0.42)",
          "rgba(250,247,242,0.78)",
          colors.background,
        ]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="About Prabhat Samgiita AI"
        onPress={() => router.push(href("/about"))}
        style={styles.brandPress}
      >
        <Image
          source={brandAssets.emblemClear}
          style={{ width: emblemSize, height: emblemSize }}
          contentFit="contain"
        />
        <Text style={styles.wordmark}>Prabhat Samgiita AI</Text>
        <Text style={styles.tagline}>Music for the inner dawn</Text>
      </Pressable>

      <View style={styles.greetingBlock} pointerEvents="none">
        <Text style={styles.greeting}>{greeting}</Text>
        {mode === "guest" ? <Text style={styles.badge}>Exploring as guest</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    paddingBottom: spacing.xl,
    minHeight: 280,
    overflow: "hidden",
  },
  brandPress: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  wordmark: {
    fontFamily: "Lora_700Bold",
    fontSize: 26,
    lineHeight: 32,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  greetingBlock: {
    alignItems: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  greeting: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "center",
  },
  badge: {
    ...typography.caption,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
})
