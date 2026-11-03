import type { RefObject } from "react"
import { StyleSheet, TextInput, View } from "react-native"
import { Mic, Search, X } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize } from "@/constants/tokens/amTypography"
import { SEARCH_PLACEHOLDER_V2 } from "@/lib/unifiedSearchQuery"

/** Spec SCR-10 / SCR-13: a white pill field, 56px high. */
export const SEARCH_FIELD_HEIGHT = 56
const ICON = 20

type Props = {
  theme: AmTheme
  value: string
  onChangeText: (text: string) => void
  onSubmit: () => void
  onClear: () => void
  onMic: () => void
  listening: boolean
  /** an example from a Today hint: the first touch selects it so typing replaces it */
  selectOnFocus?: boolean
  inputRef: RefObject<TextInput | null>
}

/** One field for a number, a name, a line of lyrics and a feeling. Mic sits inside it. */
export function SearchField({
  theme,
  value,
  onChangeText,
  onSubmit,
  onClear,
  onMic,
  listening,
  selectOnFocus = false,
  inputRef,
}: Props) {
  return (
    <View style={[styles.field, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <Search size={ICON} color={theme.textBody} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={SEARCH_PLACEHOLDER_V2}
        placeholderTextColor={theme.textMuted}
        accessibilityLabel={SEARCH_PLACEHOLDER_V2}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        selectTextOnFocus={selectOnFocus}
        blurOnSubmit={false}
        underlineColorAndroid="transparent"
        style={[styles.input, { color: theme.textHeading }]}
      />
      {value ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={onClear}
          pressedScale={0.88}
          style={styles.iconButton}
        >
          <X size={ICON} color={theme.textMuted} />
        </PressScale>
      ) : null}
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop listening" : "Search by voice"}
        accessibilityState={{ selected: listening }}
        onPress={onMic}
        pressedScale={0.88}
        style={[styles.iconButton, listening && { backgroundColor: theme.brand }]}
      >
        <Mic size={ICON} color={listening ? theme.onBrand : theme.textBody} />
      </PressScale>
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    height: SEARCH_FIELD_HEIGHT,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s2,
    paddingLeft: amSpace.s4 + amSpace.s1,
    paddingRight: amSpace.s1,
  },
  input: {
    flex: 1,
    height: SEARCH_FIELD_HEIGHT,
    fontFamily: amFonts.regular,
    fontSize: amFontSize.body,
    paddingVertical: 0,
  },
  iconButton: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
  },
})
