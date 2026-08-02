import { Pressable, StyleSheet, Text, TextInput, View } from "react-native"

import { colors, radii, spacing, typography } from "@/lib/client"

export function SearchField({
  value,
  placeholder,
  onChangeText,
  onSubmit,
}: {
  value: string
  placeholder?: string
  onChangeText: (value: string) => void
  onSubmit?: () => void
}) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? "Search song number, line, or meaning"}
        placeholderTextColor={colors.stone500}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        style={styles.input}
      />
      {onSubmit ? (
        <Pressable onPress={onSubmit} style={styles.button}>
          <Text style={styles.buttonLabel}>Search</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "rgba(202, 138, 39, 0.35)",
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: typography.body,
    color: colors.navy950,
  },
  button: {
    backgroundColor: colors.navy950,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  buttonLabel: {
    color: colors.white,
    fontWeight: "700",
    fontSize: typography.caption,
    padding: 0,
  },
})
