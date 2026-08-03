import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { Filter, Mic, Search, Sparkles, X } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  placeholder?: string
  value?: string
  editable?: boolean
  onPress?: () => void
  onChangeText?: (text: string) => void
  onClear?: () => void
  showSparkle?: boolean
  showFilter?: boolean
  /** Mic is shown on every search surface by default. */
  showMic?: boolean
  onMicPress?: () => void
  onFilterPress?: () => void
  onSubmitEditing?: () => void
}

function MicButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Voice search"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.micBtn, pressed && { opacity: 0.7 }]}
    >
      <Mic size={18} color={colors.primaryDark} />
    </Pressable>
  )
}

export function SearchBar({
  placeholder = "Ask about any Prabhat Samgiita...",
  value,
  editable = false,
  onPress,
  onChangeText,
  onClear,
  showSparkle = true,
  showFilter = false,
  showMic = true,
  onMicPress,
  onFilterPress,
  onSubmitEditing,
}: Props) {
  const leading = showSparkle ? (
    <Sparkles size={18} color={colors.primary} strokeWidth={2} />
  ) : (
    <Search size={18} color={colors.textMuted} strokeWidth={2} />
  )

  if (!editable) {
    return (
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={placeholder}
          onPress={onPress}
          style={({ pressed }) => [styles.row, styles.flex, pressed && styles.pressedRow]}
        >
          {leading}
          <Text style={styles.placeholder} numberOfLines={1}>
            {placeholder}
          </Text>
        </Pressable>
        {showMic ? <MicButton onPress={onMicPress ?? onPress} /> : null}
        {showFilter ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter songs"
            onPress={onFilterPress}
            hitSlop={8}
          >
            <Filter size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {leading}
        <TextInput
          autoFocus
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          accessibilityLabel={placeholder}
          returnKeyType="search"
          onSubmitEditing={onSubmitEditing}
        />
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={onClear}>
            <X size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
        {showMic ? <MicButton onPress={onMicPress} /> : null}
        {showFilter ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter songs"
            onPress={onFilterPress}
            hitSlop={8}
          >
            <Filter size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...softShadow(1),
  },
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 28,
    flex: 1,
  },
  pressedRow: {
    opacity: 0.92,
  },
  placeholder: {
    ...typography.bodySmall,
    color: colors.textMuted,
    flex: 1,
  },
  input: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    padding: 0,
  },
  micBtn: {
    padding: 2,
  },
})
