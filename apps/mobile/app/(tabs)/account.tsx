import { Ionicons } from "@expo/vector-icons"
import { Link } from "expo-router"
import { StyleSheet, Text, View } from "react-native"

import {
  PrimaryButton,
  ScreenSafe,
  ScreenScroll,
  SectionHeader,
  SurfaceCard,
} from "@/components/screen-shell"
import { colors, spacing, typography } from "@/lib/client"

const COMING_FEATURES = [
  { icon: "bookmark-outline" as const, label: "Saved songs playlist" },
  { icon: "ribbon-outline" as const, label: "Quiz certifications" },
  { icon: "chatbubbles-outline" as const, label: "Chat memory sync" },
]

export default function AccountScreen() {
  return (
    <ScreenSafe>
      <ScreenScroll contentContainerStyle={styles.content}>
        <SectionHeader
          eyebrow="Account"
          title="Your practice space"
          subtitle="Sign in on the web today. Native Microsoft sign-in arrives in the next mobile release."
        />

        <SurfaceCard style={styles.card}>
          <Text style={styles.cardTitle}>Coming in Phase 2</Text>
          <View style={styles.featureList}>
            {COMING_FEATURES.map(({ icon, label }) => (
              <View key={label} style={styles.featureRow}>
                <Ionicons name={icon} size={18} color={colors.gold500} />
                <Text style={styles.featureText}>{label}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>

        <Link href="/songs/1" asChild>
          <PrimaryButton label="Continue exploring songs" style={styles.button} />
        </Link>
      </ScreenScroll>
    </ScreenSafe>
  )
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: { gap: spacing.md },
  cardTitle: { color: colors.navy950, fontWeight: "700", fontSize: typography.body },
  featureList: { gap: spacing.sm },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  featureText: {
    color: colors.stone600,
    fontSize: typography.body,
    lineHeight: 22,
  },
  button: {
    alignSelf: "stretch",
    alignItems: "center",
  },
})
