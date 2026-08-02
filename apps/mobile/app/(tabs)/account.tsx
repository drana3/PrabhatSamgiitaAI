import { Link } from "expo-router"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { ScreenContainer, SectionHeader } from "@/components/screen-shell"
import { colors, radii, spacing, typography } from "@/lib/client"

export default function AccountScreen() {
  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <SectionHeader
              eyebrow="Account"
              title="Your practice space"
              subtitle="Sign in on the web today. Native Microsoft sign-in arrives in the next mobile release."
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Coming in Phase 2</Text>
            <Text style={styles.cardCopy}>Saved songs playlist, quiz certifications, and chat memory sync.</Text>
          </View>

          <Link href="/songs/1" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>Continue exploring songs</Text>
            </Pressable>
          </Link>
        </ScrollView>
      </SafeAreaView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md },
  header: { gap: spacing.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(9, 45, 86, 0.08)",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { color: colors.navy950, fontWeight: "700", fontSize: typography.body },
  cardCopy: { color: colors.stone600, lineHeight: 22 },
  button: {
    backgroundColor: colors.navy950,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: colors.white, fontWeight: "700" },
})
