import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"
import { StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from "react-native"

import { ChevronGlyph, SearchGlyph } from "@/components/today/protoIcons"
import { TodayPress } from "@/components/today/TodayPress"
import { amFonts } from "@/constants/tokens/amTypography"
import { amProto, type AmProto } from "@/constants/tokens/amToday"

/**
 * The building blocks of the prototype's sheets (`.sh-title`, `.group`, `.setrow`, `.chip`,
 * `.lrow`, `.rdo`, `.chk`, `.note`, `.pill.brand`; Main.dc.html lines 230-239 and 660-700).
 * The prototype body has line-height 1.45, so every text carries the matching line height.
 */

type P = { p: AmProto }

const em = (size: number, value: number) => Math.round(size * value * 100) / 100

/** `.over`: 13 / 600, +0.08em, capitals. */
const over: TextStyle = {
  fontFamily: amFonts.semi,
  fontSize: 13,
  lineHeight: 16,
  letterSpacing: em(13, 0.08),
  textTransform: "uppercase",
}

/* ------------------------------------------------------------------ title */

type TitleProps = P & {
  label: string
  /** right-aligned note (`Up to 2`) */
  note?: string
  /** the second and later titles of a sheet start 20dp lower */
  spaced?: boolean
  /** the language sheet aligns label and note on their baselines */
  baseline?: boolean
}

/** `.sh-title`: padding 0 10 12 20, the label in `.over`. */
export function SheetTitle({ p, label, note, spaced, baseline }: TitleProps) {
  return (
    <View
      style={[
        s.title,
        { paddingTop: spaced ? 20 : 0, alignItems: baseline ? "baseline" : "center" },
        note ? { gap: 12 } : null,
      ]}
    >
      <Text style={[over, { color: p.orange700 }]} accessibilityRole="header">
        {label}
      </Text>
      {note ? <Text style={[s.noteRight, { color: p.ink500 }]}>{note}</Text> : null}
    </View>
  )
}

/* ------------------------------------------------------------------ group */

type RowProps = { last?: boolean }

/**
 * `.group`: 10dp from the edges, 20dp radius, white, 1px sand border, rows separated by a 1px
 * line that the last row does not draw. The group tells each row whether it is the last.
 */
export function Group({ p, children }: P & { children: ReactNode }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<RowProps>[]
  return (
    <View style={[s.group, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      {items.map((child, index) => cloneElement(child, { last: index === items.length - 1 }))}
    </View>
  )
}

function rowBorder(p: AmProto, last?: boolean) {
  return { borderBottomWidth: last ? 0 : 1, borderBottomColor: p.sand300 }
}

/* ----------------------------------------------------------------- setrow */

type SetRowProps = P &
  RowProps & {
    label: string
    value?: string
    /** draw the chevron (rows that open something) */
    chevron?: boolean
    danger?: boolean
    onPress?: () => void
    /** replaces the value: chips, switches */
    right?: ReactNode
  }

/** `.setrow`: 56dp, padding 0 16 0 20, 16 / 500 label, 14 value in ink500, 20dp chevron. */
export function SetRow({ p, label, value, chevron, danger, onPress, right, last }: SetRowProps) {
  const body = (
    <>
      <Text
        style={[s.setLabel, { color: danger ? p.danger : p.ink800, fontFamily: danger ? amFonts.semi : amFonts.medium }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      {right ??
        (value || chevron ? (
          <View style={s.setRight}>
            {value ? (
              <Text style={[s.setValue, { color: p.ink500 }]} numberOfLines={1}>
                {value}
              </Text>
            ) : null}
            {chevron ? <ChevronGlyph size={20} color={p.ink500} /> : null}
          </View>
        ) : null)}
    </>
  )
  const style = [s.setRow, rowBorder(p, last)]
  if (!onPress) return <View style={style}>{body}</View>
  return (
    <TodayPress accessibilityRole="button" accessibilityLabel={label} onPress={onPress} pressedScale={0.98} style={style}>
      {body}
    </TodayPress>
  )
}

/* ------------------------------------------------------------------- chip */

type ChipProps = P & {
  label: string
  on: boolean
  onPress: () => void
  /** `.scripts .chip`: 36 high, 14dp padding */
  compact?: boolean
}

/** `.chip`: pill, white with a sand border; selected = ink fill with the on-ink text. */
export function Chip({ p, label, on, onPress, compact = true }: ChipProps) {
  return (
    <TodayPress
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      onPress={onPress}
      pressedScale={0.97}
      style={[
        s.chip,
        compact ? s.chipCompact : null,
        {
          backgroundColor: on ? p.ink900 : p.white,
          borderColor: on ? p.ink900 : p.sand300,
        },
      ]}
    >
      <Text style={[s.chipText, compact ? s.chipTextCompact : null, { color: on ? p.onInk : p.ink800 }]}>{label}</Text>
    </TodayPress>
  )
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={s.chipRow}>{children}</View>
}

/* ----------------------------------------------------------- radio / check */

/** `.rdo`: 24dp circle, 2dp ink300 ring; selected = orange fill with a white 10dp dot. */
export function Radio({ p, on }: P & { on: boolean }) {
  return (
    <View style={[s.mark, on ? { backgroundColor: p.orange500, borderColor: p.orange500 } : { borderColor: p.ink300 }]}>
      {on ? <View style={s.radioDot} /> : null}
    </View>
  )
}

/** `.chk`: the same circle with a white tick (a 6 x 11 L turned 45 degrees). */
export function Check({ p, on }: P & { on: boolean }) {
  return (
    <View style={[s.mark, on ? { backgroundColor: p.orange500, borderColor: p.orange500 } : { borderColor: p.ink300 }]}>
      {on ? <View style={s.tick} /> : null}
    </View>
  )
}

/* -------------------------------------------------------------------- lrow */

type LangRowProps = P &
  RowProps & {
    name: string
    sub: string
    /** language rows: the check; script rows: the radio */
    control: "check" | "radio"
    on: boolean
    /** right-hand text before the control (`Request`) */
    action?: string
    /** dim the name: language that is not available yet */
    dim?: boolean
    onPress: () => void
  }

/** `.lrow`: min 56, padding 6 16 6 20, 16 / 600 name over a 13 / 500 line. */
export function LangRow({ p, name, sub, control, on, action, dim, onPress, last }: LangRowProps) {
  return (
    <TodayPress
      accessibilityRole={control === "radio" ? "radio" : "checkbox"}
      accessibilityState={control === "radio" ? { selected: on } : { checked: on }}
      accessibilityLabel={`${name}, ${sub}`}
      onPress={onPress}
      pressedScale={0.98}
      style={[s.lrow, rowBorder(p, last)]}
    >
      <View style={s.lm}>
        <Text style={[s.lName, { color: dim ? p.ink500 : p.ink800 }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[s.lSub, { color: p.ink500 }]} numberOfLines={1}>
          {/* a left-to-right mark keeps a right-to-left native name from flipping the whole line */}
          {"\u200E" + sub}
        </Text>
      </View>
      {action ? <Text style={[s.rq, { color: p.orange700 }]}>{action}</Text> : null}
      {control === "radio" ? <Radio p={p} on={on} /> : <Check p={p} on={on} />}
    </TodayPress>
  )
}

/* ------------------------------------------------------------------ search */

type SearchProps = P & Pick<TextInputProps, "value" | "onChangeText" | "placeholder">

/** `.lsearch`: margin 0 20 12, 48dp pill, white, sand border, 20dp magnifier, 16 / 500 input. */
export function LanguageSearch({ p, value, onChangeText, placeholder }: SearchProps) {
  return (
    <View style={[s.search, { backgroundColor: p.white, borderColor: p.sand300 }]}>
      <SearchGlyph size={20} color={p.ink500} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        // the prototype sets no ::placeholder colour here, so the browser's default grey shows
        placeholderTextColor="#757575"
        accessibilityLabel="Search languages"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={[s.searchInput, { color: p.ink800 }]}
      />
    </View>
  )
}

/* -------------------------------------------------------------------- note */

/** `.note`: 13 / 18, 500, ink500, with the sheet's side padding. */
export function SheetNote({ p, children }: P & { children: string }) {
  return <Text style={[s.note, { color: p.ink500 }]}>{children}</Text>
}

/* -------------------------------------------------------------------- done */

/** `.pill.brand` at full width: 48dp, orange fill, white 16 / 600; padding 16 20 0 around it. */
export function DoneButton({ p, label = "Done", onPress }: P & { label?: string; onPress: () => void }) {
  return (
    <View style={s.doneWrap}>
      <TodayPress
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        pressedScale={0.98}
        style={[s.done, { backgroundColor: p.orange500 }]}
      >
        <Text style={s.doneText}>{label}</Text>
      </TodayPress>
    </View>
  )
}

const s = StyleSheet.create({
  title: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 20, paddingRight: 10, paddingBottom: 12 },
  noteRight: { flexShrink: 1, textAlign: "right", fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  group: { marginHorizontal: amProto.gutter, borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    paddingLeft: 20,
    paddingRight: 16,
  },
  setLabel: { flexShrink: 1, fontSize: 16, lineHeight: 23.2 },
  setRight: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 },
  setValue: { fontFamily: amFonts.regular, fontSize: 14, lineHeight: 20.3 },
  chip: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 70,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCompact: { height: 36, paddingHorizontal: 14 },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 22 },
  chipTextCompact: { fontSize: 14, lineHeight: 20 },
  chipRow: { flexDirection: "row", gap: 6 },
  mark: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  radioDot: { position: "absolute", left: 5, top: 5, width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFFFFF" },
  tick: {
    position: "absolute",
    left: 7,
    top: 3,
    width: 6,
    height: 11,
    borderColor: "#FFFFFF",
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: "45deg" }],
  },
  lrow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 56,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 20,
    paddingRight: 16,
  },
  // not flex:1: with a Request action the three children spread evenly, as the prototype does
  lm: { flexShrink: 1, minWidth: 0 },
  lName: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
  lSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  rq: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18.85 },
  search: {
    marginHorizontal: 20,
    marginBottom: 12,
    height: 48,
    borderRadius: 70,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, minWidth: 0, height: 44, paddingVertical: 0, paddingHorizontal: 2, fontFamily: amFonts.medium, fontSize: 16 },
  note: { paddingHorizontal: 20, paddingTop: 12, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  doneWrap: { paddingHorizontal: 20, paddingTop: 16 },
  done: { height: 48, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  doneText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 23.2, color: "#FFFFFF" },
})
