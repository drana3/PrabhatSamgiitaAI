import { useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useRouter } from "expo-router"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { ScreenContainer } from "@/components/common/ScreenContainer"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

const categories = [
  { id: "experience", label: "Experience" },
  { id: "content", label: "Content" },
  { id: "search", label: "Search" },
  { id: "audio_video", label: "Audio / Video" },
  { id: "ai", label: "AI" },
  { id: "accessibility", label: "Accessibility" },
  { id: "other", label: "Other" },
] as const

export default function FeedbackScreen() {
  const router = useRouter()
  const mode = useAuthStore((s) => s.mode)
  const email = useAuthStore((s) => s.email)
  const [category, setCategory] = useState<(typeof categories)[number]["id"]>("experience")
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)

  const submit = async () => {
    if (mode === "guest") {
      Alert.alert("Sign in required", "Feedback requires a signed-in member — same as the website.")
      return
    }
    if (comment.trim().length < 3) {
      Alert.alert("Add a little more", "Please share at least a short comment so we can help.")
      return
    }

    setSending(true)
    try {
      const result = await api.submitFeedback({
        category,
        rating,
        comment: comment.trim(),
        page_path: "/mobile/feedback",
        contact: email ?? undefined,
      })
      Alert.alert("Thank you", result.message)
      setComment("")
    } catch (error) {
      Alert.alert(
        "Could not send",
        error instanceof Error ? error.message : "Feedback could not be sent. Please try again.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <ScreenContainer edges={["top"]} padded={false} title="Feedback">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Tell us what felt peaceful, confusing, or missing. Your notes help improve songs, search,
          and the AI companion.
        </Text>

        {mode === "guest" ? (
          <View style={styles.guestBox}>
            <Text style={styles.guestText}>Members can send feedback. Guests can still explore freely.</Text>
            <PrimaryButton
              label="Login / Sign Up"
              onPress={() => router.push(href("/signin"))}
            />
          </View>
        ) : null}

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {categories.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setCategory(item.id)}
              style={[styles.chip, category === item.id && styles.chipActive]}
            >
              <Text style={styles.chipText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Rating</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              style={[styles.rating, rating === value && styles.ratingActive]}
            >
              <Text style={[styles.ratingText, rating === value && styles.ratingTextActive]}>{value}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Comment</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="What should we improve?"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          textAlignVertical="top"
          editable={!sending}
        />

        {sending ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <PrimaryButton label="Send feedback" onPress={() => void submit()} disabled={mode === "guest"} />
        )}
      </ScrollView>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section, gap: spacing.md },
  lead: { ...typography.bodySmall, color: colors.textSecondary },
  guestBox: {
    gap: spacing.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestText: { ...typography.bodySmall, color: colors.textSecondary },
  label: { ...typography.label, color: colors.textPrimary, marginTop: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textPrimary },
  ratingRow: { flexDirection: "row", gap: spacing.sm },
  rating: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  ratingActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ratingText: { ...typography.label, color: colors.textPrimary },
  ratingTextActive: { color: colors.white },
  input: {
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
})
