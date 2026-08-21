import { useRef } from "react"
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { Mic, Search } from "lucide-react-native"

import { SEARCH_PLACEHOLDER } from "@prabhat/core"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  value: string
  onChangeText: (text: string) => void
  onSubmit: () => void
  onMicPress: () => void
  placeholder?: string
}

/** Home hero search — type here, submit to Explore (website parity). */
export function HomeHeroSearch({
  value,
  onChangeText,
  onSubmit,
  onMicPress,
  placeholder = SEARCH_PLACEHOLDER,
}: Props) {
  const inputRef = useRef<TextInput>(null)

  return (
    <View style={styles.container}>
      <Search size={18} color={colors.textMuted} strokeWidth={2} />
      <TextInput
        ref={inputRef}
        editable
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        onPressIn={() => inputRef.current?.focus()}
        accessibilityLabel="Search Prabhat Samgiita"
        autoCorrect
        autoCapitalize="sentences"
        clearButtonMode="while-editing"
        showSoftInputOnFocus
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voice search"
        onPress={(event) => {
          event.stopPropagation()
          onMicPress()
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.micBtn, pressed && { opacity: 0.75 }]}
      >
        <Mic size={18} color={colors.primaryDark} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search"
        onPress={(event) => {
          event.stopPropagation()
          onSubmit()
        }}
        style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.9 }]}
      >
        <Text style={styles.submitArrow}>→</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 52,
    ...softShadow(1),
  },
  input: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    minHeight: 36,
    fontSize: 16,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  submitArrow: {
    color: colors.white,
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
})
