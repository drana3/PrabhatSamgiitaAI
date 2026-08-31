import { useState } from "react"
import { Pressable, StyleSheet, Text } from "react-native"
import { Copy } from "lucide-react-native"
import { setStringAsync } from "expo-clipboard"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  text: string
}

export function CopyChatAnswerButton({ text }: Props) {
  const [copied, setCopied] = useState(false)
  const value = text.trim()
  if (!value) return null

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copied ? "Answer copied" : "Copy answer"}
      onPress={() => {
        void (async () => {
          try {
            await setStringAsync(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          } catch {
            setCopied(false)
          }
        })()
      }}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Copy size={14} color={colors.primaryDark} />
      <Text style={styles.label}>{copied ? "Copied" : "Copy"}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.85 },
  label: { ...typography.caption, color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
})
