import { StyleSheet, Text, View } from "react-native"
import { Check, X } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { quizOptionText, type QuizReviewShape } from "@/lib/quizReview"

export function QuizReviewCard({
  index,
  item,
}: {
  index: number
  item: QuizReviewShape
}) {
  const selectedText = quizOptionText(item.options, item.selected_option_id)
  const correctText = quizOptionText(item.options, item.correct_option_id)

  return (
    <View
      style={[
        styles.card,
        item.is_correct ? styles.cardCorrect : styles.cardIncorrect,
      ]}
    >
      <View style={styles.header}>
        {item.is_correct ? (
          <Check size={16} color={colors.success} />
        ) : (
          <X size={16} color={colors.error} />
        )}
        <Text style={styles.indexLabel}>Question {index + 1}</Text>
      </View>
      <Text style={styles.prompt}>{item.prompt}</Text>
      <Text style={styles.line}>
        <Text style={styles.label}>Your answer: </Text>
        {selectedText}
      </Text>
      {!item.is_correct ? (
        <Text style={styles.line}>
          <Text style={styles.label}>Correct answer: </Text>
          {correctText}
        </Text>
      ) : null}
      {item.explanation?.trim() ? (
        <Text style={styles.explanation}>{item.explanation.trim()}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardCorrect: {
    borderColor: colors.success,
    backgroundColor: "rgba(34, 120, 69, 0.08)",
  },
  cardIncorrect: {
    borderColor: colors.error,
    backgroundColor: "rgba(180, 45, 45, 0.06)",
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  indexLabel: { ...typography.caption, color: colors.textMuted, textTransform: "uppercase" },
  prompt: { ...typography.bodySmall, fontFamily: "Lora_700Bold", color: colors.textPrimary },
  line: { ...typography.bodySmall, color: colors.textPrimary },
  label: { ...typography.label, fontSize: 14 },
  explanation: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
})