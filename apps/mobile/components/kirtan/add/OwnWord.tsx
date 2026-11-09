import { StyleSheet, Text, TextInput, View } from "react-native"

import { Press } from "@/components/songs-v2/Press"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"

/**
 * The box under a group of tags where a person writes their own word ("Add your own": a style, a main instrument, a language).
 * One component for all of them, so the spacing is one rule (docs/layout-rules.md, "An input beside a group of tags"):
 *
 *  - the box is 16 away from the tags above it (the caller puts it in a stack with `TAG_INPUT_GAP`);
 *  - the "Did you mean ..." card is 16 below the input;
 *  - the note about the weekly limit belongs to the input: 8 below it.
 *
 * It holds no state: the caller passes the text and the suggestion (a listed word the text is, or is almost like).
 */
export const TAG_INPUT_GAP = 16

export type OwnWordSuggestion = { question?: string; actionLabel: string; onUse: () => void }

export function OwnWord({ theme, value, onChange, placeholder, maxLength, note, suggestion, invalid, disabled, autoFocus, onSubmit }: { theme: SongsTheme; value: string; onChange: (text: string) => void; placeholder: string; maxLength: number; note?: string | null; suggestion?: OwnWordSuggestion | null; invalid?: boolean; disabled?: boolean; autoFocus?: boolean; onSubmit?: () => void }) {
  return (
    <View style={s.root}>
      <View style={s.inputGroup}>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.slice(0, maxLength))}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={placeholder}
          maxLength={maxLength}
          editable={!disabled}
          autoFocus={autoFocus}
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          style={[s.input, { color: theme.textHeading, backgroundColor: theme.card, borderColor: invalid ? amColors.danger : theme.line }]}
        />
        {note ? <Text style={[s.hint, { color: theme.textBody }]}>{note}</Text> : null}
      </View>
      {suggestion ? (
        <View style={s.suggestion} accessibilityLiveRegion="polite">
          {suggestion.question ? <Text style={[s.hint, { color: theme.textBody }]}>{suggestion.question}</Text> : null}
          <Press accessibilityRole="button" accessibilityLabel={suggestion.actionLabel} disabled={disabled} onPress={suggestion.onUse} pressedScale={0.95} style={[s.chip, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[s.chipText, { color: theme.textHeading }]}>{suggestion.actionLabel}</Text>
          </Press>
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 16 },
  inputGroup: { gap: 8 },
  suggestion: { gap: 8, alignItems: "flex-start" },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  input: { minHeight: 48, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, fontFamily: amFonts.medium, fontSize: 16 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
