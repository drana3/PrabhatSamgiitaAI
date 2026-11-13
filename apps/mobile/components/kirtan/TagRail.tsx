import { useMemo, useState } from "react"
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from "react-native"
import { Search } from "lucide-react-native"

import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { pickerStyles, useKeyboardHeight } from "@/components/kirtan/add/TagPicker"
import { Press } from "@/components/songs-v2/Press"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { WORD_MAX } from "@/lib/kirtan/instruments"
import { chipText, filterRailChips, railLine, showsSearch, type RailChip } from "@/lib/kirtan/tagRail"

/** How a plain chip looks when the page has its own colours (the Search page's white chips). */
export type ChipLook = { bg: string; border: string; text: string; count?: string }

type Props = {
  chips: readonly RailChip[]
  /** the title of the sheet */
  title: string
  look?: ChipLook
  /** "large" is the 44 pt touch chip of the Search page; "small" (default) is the page's tag chip */
  size?: "small" | "large"
  /** the line measures itself; until it has, the phone's width less 40 is the room */
  testID?: string
}

/**
 * Many tags on a page: ONE line of chips that fit whole, then "+N" (Dada, 9 Nov 2026). A tap on "+N" opens the same compact sheet the upload
 * form's tag field uses (assistant-v2/SpringSheet, its search box, its rows and its keyboard rule, from add/TagPicker.tsx) in the listener's
 * read-only form: every tag, a search box from seven tags on, no ticks. Chips that carry an `onPress` (a search, a vote) stay pressable on the
 * line and in the sheet, and the sheet closes after a pick. The measure is lib/kirtan/tagRail.ts (pure, tested); the sheet's motion is the
 * sheet's own spring, and the "+N" chip answers on touch-down like every Press.
 */
export function TagRail({ chips, title, look, size = "small", testID }: Props) {
  const t = useT()
  const theme = useSongsTheme()
  const am = useAmTheme()
  const [width, setWidth] = useState(() => Math.max(200, Dimensions.get("window").width - 40))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const keyboard = useKeyboardHeight(open)
  const { shown, more } = useMemo(() => railLine(chips, size === "large" ? width * 0.88 : width), [chips, width, size])
  const list = useMemo(() => filterRailChips(chips, query), [chips, query])
  if (!chips.length) return null

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width)
    if (next > 0 && Math.abs(next - width) > 1) setWidth(next)
  }
  const close = () => {
    setOpen(false)
    setQuery("")
  }
  const plain: ChipLook = look ?? { bg: theme.card, border: theme.line, text: theme.textHeading, count: theme.accent }
  const accent: ChipLook = { bg: theme.peach, border: theme.line, text: theme.accent, count: theme.accent }

  return (
    <View testID={testID}>
      <View style={s.line} onLayout={onLayout}>
        {shown.map((chip) => (
          <Chip key={chip.key} chip={chip} look={chip.tone === "accent" ? accent : plain} large={size === "large"} />
        ))}
        {more > 0 ? (
          <Press
            accessibilityRole="button"
            accessibilityLabel={t("tagRail.more.a11y", { count: chips.length })}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen(true)}
            pressedScale={0.95}
            hitSlop={8}
            testID={testID ? `${testID}-more` : undefined}
            outerStyle={s.noShrink}
            style={[s.chip, size === "large" ? s.large : s.more, { backgroundColor: plain.bg, borderColor: plain.border }]}
          >
            <Text style={[s.chipText, size === "large" ? s.largeText : null, { color: plain.text }]}>{`+${more}`}</Text>
          </Press>
        ) : null}
      </View>

      <SpringSheet visible={open} onClose={close} title={title} theme={am}>
        <View style={[pickerStyles.sheetBody, { paddingBottom: keyboard }]}>
          {showsSearch(chips.length) ? (
            <View style={[pickerStyles.search, { backgroundColor: theme.card, borderColor: theme.line }]}>
              <Search size={18} color={theme.textMuted} />
              <TextInput
                value={query}
                onChangeText={(text) => setQuery(text.slice(0, WORD_MAX))}
                placeholder={t("picker.search")}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t("picker.search")}
                returnKeyType="done"
                autoCorrect={false}
                maxLength={WORD_MAX}
                style={[pickerStyles.searchInput, { color: theme.textHeading }]}
                testID={testID ? `${testID}-search` : undefined}
              />
            </View>
          ) : null}
          <ScrollView style={pickerStyles.list} contentContainerStyle={pickerStyles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {list.map((chip) => (
              <SheetRow
                key={chip.key}
                chip={chip}
                onDone={close}
                border={theme.line}
                background={theme.card}
                text={theme.textHeading}
                count={theme.accent}
              />
            ))}
            {!list.length ? <Text style={[pickerStyles.empty, { color: theme.textMuted }]}>{t("picker.empty")}</Text> : null}
          </ScrollView>
          <View style={pickerStyles.footer}>
            <Text style={[pickerStyles.count, { color: theme.textBody }]}>{t("tagRail.count", { count: chips.length })}</Text>
            <Press accessibilityRole="button" accessibilityLabel={t("picker.done")} onPress={close} pressedScale={0.95} style={[pickerStyles.done, { backgroundColor: theme.brand }]}>
              <Text style={[pickerStyles.doneText, { color: theme.onBrand }]}>{t("picker.done")}</Text>
            </Press>
          </View>
        </View>
      </SpringSheet>
    </View>
  )
}

function Chip({ chip, look, large }: { chip: RailChip; look: ChipLook; large: boolean }) {
  const body = (
    <>
      <Text numberOfLines={1} style={[s.chipText, large ? s.largeText : null, { color: look.text }]}>
        {chip.label}
      </Text>
      {chip.count !== undefined ? <Text style={[s.chipCount, large ? s.largeCount : null, { color: look.count ?? look.text }]}>{chip.count}</Text> : null}
    </>
  )
  const style = [s.chip, large ? s.large : null, { backgroundColor: look.bg, borderColor: look.border }]
  if (!chip.onPress) {
    return (
      <View testID={chip.testID} style={style}>
        {body}
      </View>
    )
  }
  return (
    <Press accessibilityRole="button" accessibilityLabel={chip.a11y ?? chipText(chip)} onPress={chip.onPress} pressedScale={0.95} testID={chip.testID} outerStyle={s.shrink} style={style}>
      {body}
    </Press>
  )
}

function SheetRow({ chip, onDone, border, background, text, count }: { chip: RailChip; onDone: () => void; border: string; background: string; text: string; count: string }) {
  const inner = (
    <View style={pickerStyles.rowText}>
      <Text style={[pickerStyles.rowLabel, { color: text, fontFamily: amFonts.semi }]}>{chip.label}</Text>
    </View>
  )
  const number = chip.count !== undefined ? <Text style={[s.chipCount, { color: count }]}>{chip.count}</Text> : null
  const style = [pickerStyles.row, { borderColor: border, backgroundColor: background }]
  if (!chip.onPress) {
    return (
      <View style={style} accessible accessibilityLabel={chip.a11y ?? chipText(chip)}>
        {inner}
        {number}
      </View>
    )
  }
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={chip.a11y ?? chipText(chip)}
      onPress={() => {
        onDone()
        chip.onPress?.()
      }}
      pressedScale={0.98}
      style={style}
    >
      {inner}
      {number}
    </Press>
  )
}

const s = StyleSheet.create({
  // one line, never wraps: the chips that did not fit are the "+N"
  line: { flexDirection: "row", alignItems: "center", gap: 8, overflow: "hidden" },
  chip: { minHeight: 28, paddingHorizontal: 12, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 1, flexDirection: "row", gap: 6 },
  shrink: { flexShrink: 1 },
  noShrink: { flexShrink: 0 },
  large: { minHeight: 44, paddingHorizontal: 16 },
  largeText: { fontSize: 15, lineHeight: 20 },
  largeCount: { fontSize: 14, lineHeight: 18 },
  more: { minHeight: 32 },
  chipText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  chipCount: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
})
