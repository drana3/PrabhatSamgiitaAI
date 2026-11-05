import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator } from "react-native"
import { Mic, Send, Sparkles } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

type Props = {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onVoicePress?: () => void
  voiceListening?: boolean
  hint?: string
}

export function AIComposer({
  value,
  onChangeText,
  onSend,
  onVoicePress,
  voiceListening = false,
  hint,
}: Props) {
  return (
    <View style={styles.wrap}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.row}>
        <Sparkles size={18} color={colors.primary} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask about any song, lyric, or theme..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          accessibilityLabel="AI message"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={voiceListening ? "Stop voice input" : "Voice input"}
          onPress={onVoicePress}
          style={({ pressed }) => [
            styles.iconBtn,
            voiceListening && styles.iconBtnActive,
            pressed && { opacity: 0.75 },
          ]}
        >
          {voiceListening ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Mic size={18} color={colors.textSecondary} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          onPress={onSend}
          style={({ pressed }) => [styles.send, pressed && { opacity: 0.85 }]}
        >
          <Send size={18} color={colors.white} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 56,
    ...softShadow(1),
  },
  input: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    minHeight: 40,
    maxHeight: 96,
    paddingVertical: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },
  iconBtnActive: {
    backgroundColor: colors.primary,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
})
