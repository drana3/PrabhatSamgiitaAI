import { memo, type RefObject } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import { Check, Plus, Search, X } from "lucide-react-native"
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { useEffect } from "react"

import { PressBox } from "@/components/learn-v2/PressBox"
import { amSpring } from "@/constants/tokens/amMotion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"
import { PICKER_ROW_HEIGHT } from "@/lib/learn/songPicker"
import type { CatalogEntry } from "@/lib/songsV2/entry"
import { useT } from "@/lib/i18n"

/**
 * Pieces of the "Add a song" picker (app/learn/add.tsx): the search pill, a filter chip and one
 * song row. Colours come from `p` (protoFor(theme)), so light and dark read from one place.
 * Fills use `p.action` (orange700) with white; the bright orange500 is not used here.
 */

export const PICKER_INSET = 20
const NUMBER_COLUMN = 58

/* ------------------------------------------------------------------ search */

/**
 * A white pill with the magnifier, the input and a clear button (44pt). The field sits at the top of
 * the screen, above the list, so the keyboard never covers it.
 */
export function PickerSearch({
  p,
  value,
  onChangeText,
  inputRef,
  autoFocus,
  placeholder,
  compact,
}: {
  p: AmProto
  value: string
  onChangeText: (text: string) => void
  inputRef: RefObject<TextInput | null>
  autoFocus?: boolean
  /** the hint inside the field; the song chooser's own by default */
  placeholder?: string
  /** a slimmer field (44pt, 1pt border) for screens where the list needs the room */
  compact?: boolean
}) {
  const t = useT()
  return (
    <View style={[s.field, compact && s.fieldCompact, { backgroundColor: p.white, borderColor: compact ? p.sand300 : p.ink900 }]}>
      <Search size={20} color={p.ink500} strokeWidth={1.9} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t("learn.add.search.placeholder")}
        placeholderTextColor={p.ink500}
        accessibilityLabel={t("learn.add.search.a11y")}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoFocus={autoFocus}
        clearButtonMode="never"
        underlineColorAndroid="transparent"
        style={[s.input, { color: p.ink800 }]}
      />
      {value ? (
        <PressBox
          accessibilityRole="button"
          accessibilityLabel={t("learn.add.clearSearch")}
          onPress={() => {
            onChangeText("")
            inputRef.current?.focus()
          }}
          pressedScale={0.88}
          style={s.clear}
        >
          <X size={18} color={p.ink500} strokeWidth={2} />
        </PressBox>
      ) : null}
    </View>
  )
}

/** Track and knob of the small switch. */
const SWITCH_W = 34
const SWITCH_H = 20
const KNOB = 16

/**
 * "With audio" (or any one-line filter): a small label with an on/off switch, 20pt high with a 44pt touch area.
 * On = orange700 track, knob at the right. The knob moves with a spring that starts from where it is.
 */
export function AudioChip({ p, on, onPress, label: given }: { p: AmProto; on: boolean; onPress: () => void; label?: string }) {
  const t = useT()
  const label = given ?? t("learn.add.withAudio")
  const reduce = useReducedMotion()
  const x = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    x.value = reduce ? withTiming(on ? 1 : 0, { duration: 150 }) : withSpring(on ? 1 : 0, amSpring.default)
  }, [on, reduce, x])
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (SWITCH_W - KNOB - 4) }] }))
  return (
    <PressBox
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      pressedScale={0.97}
      style={s.toggle}
    >
      <Text style={[s.toggleText, { color: p.ink800 }]}>{label}</Text>
      <View style={[s.track, { backgroundColor: on ? p.action : p.sand300 }]}>
        <Animated.View style={[s.knob, { backgroundColor: on ? p.onAction : p.white }, knob]} />
      </View>
    </PressBox>
  )
}

/* --------------------------------------------------------------------- row */

type RowProps = {
  p: AmProto
  entry: CatalogEntry
  /** the song is on the Learn list */
  listed: boolean
  onToggle: (entry: CatalogEntry) => void
  /** true in the "What to study" picker, which has its own spoken labels */
  study?: boolean
}

/**
 * One song: `PS 12`, the title, the first line under it, and a 44pt round control at the right
 * ("+" to add, a check once it is on the list). The whole row is the touch target.
 */
export const PickerRow = memo(function PickerRow({ p, entry, listed, onToggle, study }: RowProps) {
  const t = useT()
  const params = { number: entry.number, title: entry.title }
  const label = study
    ? listed
      ? t("learn.scope.row.on.a11y", params)
      : t("learn.scope.row.off.a11y", params)
    : listed
      ? t("learn.add.row.in.a11y", params)
      : t("learn.add.row.add.a11y", params)
  return (
    <PressBox
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: listed }}
      onPress={() => onToggle(entry)}
      pressedScale={0.99}
      outerStyle={s.rowOuter}
      style={[s.row, { borderBottomColor: p.sand300 }]}
    >
      <Text style={[s.num, { color: p.orange700 }]}>{`PS ${entry.number}`}</Text>
      <View style={s.texts}>
        <Text style={[s.title, { color: p.ink800 }]} numberOfLines={1}>
          {entry.title}
        </Text>
        {entry.firstLine ? (
          <Text style={[s.line, { color: p.ink500 }]} numberOfLines={1}>
            {entry.firstLine}
          </Text>
        ) : null}
      </View>
      <View style={[s.control, listed ? { backgroundColor: p.orange100 } : { backgroundColor: p.action }]}>
        {listed ? (
          <Check size={22} color={p.orange700} strokeWidth={2.4} />
        ) : (
          <Plus size={22} color={p.onAction} strokeWidth={2.4} />
        )}
      </View>
    </PressBox>
  )
})

const s = StyleSheet.create({
  field: {
    flex: 1,
    minWidth: 0,
    height: 56,
    borderRadius: 70,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 18,
    paddingRight: 6,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    fontFamily: amFonts.medium,
    fontSize: 17,
    paddingVertical: 0,
    paddingHorizontal: 0,
    outlineStyle: "none",
  } as never,
  fieldCompact: { height: 44, borderWidth: 1 },
  clear: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  toggle: { height: 32, flexDirection: "row", alignItems: "center", gap: 8 },
  toggleText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  track: { width: SWITCH_W, height: SWITCH_H, borderRadius: SWITCH_H / 2, padding: 2, justifyContent: "center" },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2 },
  chip: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  rowOuter: { height: PICKER_ROW_HEIGHT },
  row: {
    height: PICKER_ROW_HEIGHT,
    paddingLeft: PICKER_INSET,
    paddingRight: PICKER_INSET - 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  num: { width: NUMBER_COLUMN, fontFamily: amFonts.bold, fontSize: 14, lineHeight: 18, letterSpacing: 0.3, fontVariant: ["tabular-nums"] },
  texts: { flex: 1, minWidth: 0, gap: 2, paddingRight: 8 },
  title: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.16 },
  line: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    height: 48,
    paddingLeft: 20,
    paddingRight: 8,
    borderRadius: 70,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 60,
  },
  toastText: { flex: 1, fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  toastAction: { height: 44, paddingHorizontal: 12, justifyContent: "center" },
  toastActionText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
  control: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
})

/* ------------------------------------------------------------------- toast */

/**
 * A short note with an action ("PS 12 added to Learn · Undo"). It sits under the search row, not at
 * the bottom, because the keyboard is usually open on this screen and would cover it.
 */
export function PickerToast({
  p,
  message,
  actionLabel,
  onAction,
  top,
}: {
  p: AmProto
  message: string | null
  actionLabel: string
  onAction: () => void
  top: number
}) {
  if (!message) return null
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      accessibilityLiveRegion="polite"
      pointerEvents="box-none"
      style={[s.toast, { top, backgroundColor: p.ink900 }]}
    >
      <Text style={[s.toastText, { color: p.onInk }]} numberOfLines={1}>
        {message}
      </Text>
      <PressBox accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} pressedScale={0.92} style={s.toastAction}>
        {/* gold on the dark pill (light theme), orange800 on the light pill (dark theme): both 5:1 or better */}
        <Text style={[s.toastActionText, { color: p.dark ? amColors.orange800 : amColors.gold300 }]}>{actionLabel}</Text>
      </PressBox>
    </Animated.View>
  )
}
