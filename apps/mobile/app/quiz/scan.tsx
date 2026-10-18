import { useState } from "react"
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"
import { QrCode } from "lucide-react-native"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { parseQuizEventSlug } from "@/lib/quizEvent"
import { href } from "@/utils/href"

export default function QuizScanScreen() {
  const router = useRouter()
  const [code, setCode] = useState("")

  const openSlug = (raw: string) => {
    const slug = parseQuizEventSlug(raw)
    if (!slug) {
      Alert.alert("Invalid code", "Enter the quiz code or scan a valid Prabhat Samgiita quiz QR.")
      return
    }
    router.push(href(`/quiz/event/${slug}`))
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Join live quiz</Text>
        <Text style={styles.subtitle}>
          Scan the event QR code from your sangha, or enter the quiz code manually.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <QrCode size={28} color={colors.primary} />
        </View>
        <Text style={styles.cardTitle}>Manual code entry</Text>
        <Text style={styles.cardSub}>
          Paste the deep link or type the short quiz code shared by the host.
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="prabhatai://quiz/event/abc123"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <PrimaryButton label="Open quiz" onPress={() => openSlug(code)} />
      </View>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Camera scanning opens automatically when a quiz QR is scanned from outside the app.
        </Text>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  back: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "600",
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  cardSub: {
    ...typography.body,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },
  note: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  noteText: {
    ...typography.caption,
    color: colors.textMuted,
  },
})
