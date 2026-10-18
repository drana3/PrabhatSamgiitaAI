import { useEffect, useState } from "react"
import { Linking, Pressable, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import type { ReflectionQuote } from "@prabhat/core"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import {
  fallbackReflection,
  formatReflectionQuote,
  reflectionBookCitation,
  reflectionSourceLabel,
} from "@/data/homeContent"
import { api } from "@/lib/client"
import { href } from "@/utils/href"

export { CommunityVoicesTicker as CommunityVoicesRow } from "@/components/home/CommunityVoicesTicker"

export function DailyReflectionCard() {
  const [reflection, setReflection] = useState<ReflectionQuote>(() => fallbackReflection())

  useEffect(() => {
    let active = true
    void api.fetchTodayReflection().then((value) => {
      if (active && value) setReflection(value)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <View style={styles.reflection}>
      <Text style={styles.eyebrow}>Today’s reflection</Text>
      <Text style={styles.context}>{reflection.context_label}</Text>
      <Text style={styles.quote}>“{formatReflectionQuote(reflection.quote_text)}”</Text>
      <Text style={styles.attr}>— {reflection.attribution}</Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={reflectionSourceLabel(reflection)}
        onPress={() => Linking.openURL(reflection.source_url)}
        style={({ pressed }) => [styles.sourceLink, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.source}>{reflectionBookCitation(reflection)}</Text>
      </Pressable>
    </View>
  )
}

type AboutProps = {
  onPress?: () => void
}

export function AboutComposerCard({ onPress }: AboutProps) {
  const router = useRouter()

  return (
    <View>
      <Text style={styles.sectionTitle}>About</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="About Prabhat Samgiita"
        onPress={onPress ?? (() => router.push(href("/about")))}
        style={({ pressed }) => [styles.about, pressed && { opacity: 0.95 }]}
      >
        <Text style={styles.aboutTitle}>Songs for a new human dawn</Text>
        <Text style={styles.aboutBody}>
          Shrii Shrii Anandamurti ji composed 5,018 Prabhat Samgiita songs between 1982 and 1990 —
          devotion, nature, humanism, and hope. Tap to read more on About.
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  reflection: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  eyebrow: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
    width: "100%",
  },
  context: {
    ...typography.caption,
    color: colors.success,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: spacing.sm,
    fontSize: 10,
    textAlign: "center",
    width: "100%",
  },
  quote: {
    fontFamily: "Lora_700Bold",
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: "center",
    fontStyle: "italic",
    width: "100%",
    alignSelf: "stretch",
  },
  attr: {
    ...typography.label,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: "center",
    width: "100%",
  },
  sourceLink: { marginTop: spacing.xs, alignSelf: "center" },
  source: {
    ...typography.caption,
    color: colors.primaryDark,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
  },
  about: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aboutTitle: {
    fontFamily: "Lora_700Bold",
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  aboutBody: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
})
