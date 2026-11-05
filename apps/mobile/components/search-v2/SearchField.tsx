import type { RefObject } from "react"
import { StyleSheet, TextInput, View } from "react-native"

import { SearchGlyph } from "@/components/today/protoIcons"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { SEARCH_INPUT_PLACEHOLDER } from "@/lib/searchProto"
import { Mic, X } from "lucide-react-native"

export const SEARCH_FIELD_HEIGHT = 56

type Props = {
  p: AmProto
  value: string
  onChangeText: (text: string) => void
  onSubmit: () => void
  onClear: () => void
  onMic: () => void
  listening: boolean
  /** an example from a Today hint: the first touch selects it so typing replaces it */
  selectOnFocus?: boolean
  inputRef: RefObject<TextInput | null>
  /** preview: only the magnifier and the input, exactly as the prototype draws the pill */
  bare?: boolean
  /** the browse layout: a thin sand border, its own placeholder, and the mic shows only once there is text */
  soft?: boolean
  placeholder?: string
}

/**
 * `.s-in`: a white pill with a 2dp ink border, the magnifier and the input (17 / 500).
 * Extra to the prototype: a clear button and the voice mic sit inside the pill on the right.
 */
export function SearchField({
  p,
  value,
  onChangeText,
  onSubmit,
  onClear,
  onMic,
  listening,
  selectOnFocus = false,
  inputRef,
  bare = false,
  soft = false,
  placeholder,
}: Props) {
  return (
    <View style={[s.field, bare && s.fieldBare, soft && s.fieldSoft, { backgroundColor: p.white, borderColor: soft ? p.sand300 : p.ink900 }]}>
      <SearchGlyph size={20} color={p.ink500} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder ?? SEARCH_INPUT_PLACEHOLDER}
        placeholderTextColor={p.ink500}
        accessibilityLabel="Search songs"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        selectTextOnFocus={selectOnFocus}
        blurOnSubmit={false}
        underlineColorAndroid="transparent"
        style={[s.input, bare && s.inputBare, { color: p.ink800 }]}
      />
      {value && !bare ? (
        <TodayPress accessibilityRole="button" accessibilityLabel="Clear search" onPress={onClear} pressedScale={0.88} style={s.icon}>
          <X size={18} color={p.ink500} />
        </TodayPress>
      ) : null}
      {bare || (soft && !value) ? null : <TodayPress
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop listening" : "Search by voice"}
        accessibilityState={{ selected: listening }}
        onPress={onMic}
        pressedScale={0.88}
        style={[s.icon, listening && { backgroundColor: p.action }]}
      >
        <Mic size={18} color={listening ? "#FFFFFF" : p.ink500} />
      </TodayPress>}
    </View>
  )
}

const s = StyleSheet.create({
  field: {
    flex: 1,
    minWidth: 0,
    height: SEARCH_FIELD_HEIGHT,
    borderRadius: 70,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 18,
    paddingRight: 8,
  },
  // the prototype's <input> keeps the browser's 2px side padding
  inputBare: { paddingHorizontal: 2 },
  fieldSoft: { borderWidth: 1 },
  fieldBare: { paddingLeft: 20, paddingRight: 20 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    fontFamily: amFonts.medium,
    fontSize: 17,
    paddingVertical: 0,
    paddingHorizontal: 0,
    // the web field draws its own outline; the 2dp border is the focus ring
    outlineStyle: "none",
  } as never,
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
})
