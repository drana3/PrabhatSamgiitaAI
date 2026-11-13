import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native"
import { ArrowUp, Mic } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

/**
 * Pill field with a send disc. It sits in the flow under the thread, inside the
 * keyboard-avoiding container, so the field stays visible while typing.
 */
export function AskComposer({
  theme,
  value,
  onChangeText,
  onSend,
  onVoicePress,
  voiceListening,
  sending,
  hint,
  placeholder,
}: {
  theme: AmTheme
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  onVoicePress: () => void
  voiceListening: boolean
  sending: boolean
  hint?: string
  placeholder: string
}) {
  const t = useT()
  const canSend = value.trim().length > 0 && !sending
  return (
    <View style={styles.wrap}>
      {hint ? <Text style={[amType.label, styles.hint, { color: theme.textBody }]}>{hint}</Text> : null}
      <View style={styles.row}>
        <View style={[styles.field, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            multiline
            style={[styles.input, { color: theme.textHeading }]}
            accessibilityLabel={t("assistant.composer.label")}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => canSend && onSend()}
          />
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={voiceListening ? t("assistant.composer.voiceStop") : t("assistant.composer.voice")}
            onPress={onVoicePress}
            pressedScale={0.92}
            style={styles.mic}
          >
            {voiceListening ? (
              <ActivityIndicator size="small" color={theme.brand} />
            ) : (
              <Mic size={20} color={theme.textBody} />
            )}
          </PressScale>
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={t("assistant.composer.send")}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={onSend}
          pressedScale={0.92}
          style={[styles.send, { backgroundColor: theme.brand, opacity: canSend ? 1 : 0.4 }]}
        >
          <ArrowUp size={24} color={theme.onBrand} />
        </PressScale>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingTop: 10 },
  hint: { paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  field: {
    flex: 1,
    minHeight: 56,
    maxHeight: 140,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    fontFamily: amFonts.regular,
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 14,
    maxHeight: 130,
  },
  mic: { width: amTouchTarget, height: amTouchTarget, alignItems: "center", justifyContent: "center" },
  send: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
})
