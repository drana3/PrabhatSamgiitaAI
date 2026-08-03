import { Pressable, StyleSheet, Text, View } from "react-native"
import { Compass, Library } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

const actions = [
  { key: "explore", label: "Explore", Icon: Compass },
  { key: "collections", label: "Collections", Icon: Library },
] as const

type Props = {
  onAction: (key: (typeof actions)[number]["key"]) => void
}

export function QuickActionGrid({ onAction }: Props) {
  return (
    <View style={styles.grid}>
      {actions.map(({ key, label, Icon }) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => onAction(key)}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          <View style={styles.iconWrap}>
            <Icon size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={styles.label}>{label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    backgroundColor: colors.surfaceSoft,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
  },
})
