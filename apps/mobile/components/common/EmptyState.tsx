import { StyleSheet, Text, View } from "react-native"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  illustration?: React.ReactNode
}

export function EmptyState({ title, description, actionLabel, onAction, illustration }: Props) {
  return (
    <View style={styles.wrap}>
      {illustration}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: spacing.section,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  action: {
    alignSelf: "stretch",
    marginTop: spacing.lg,
  },
})
