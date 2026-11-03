import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { Check } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressScale } from "@/components/today/motion"
import { amColors, amDark, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amGap, amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFontSize, amFonts, amType } from "@/constants/tokens/amTypography"
import {
  CACHE_LIMITS,
  formatBytes,
  storageLegend,
  storageRowEyebrow,
  usageRatio,
  type CacheLimit,
  type CacheLimitId,
  type ClearActionModel,
  type StorageItem,
} from "@/lib/storageCache"

type ThemeProps = { theme: AmTheme }

/** Forest total card: eyebrow, the total at 64px, a usage bar against the limit, a legend. */
export function StorageTotalCard({
  theme,
  totalBytes,
  count,
  limit,
}: ThemeProps & { totalBytes: number; count: number; limit: CacheLimit }) {
  const reduce = useReducedMotion()
  const ratio = useSharedValue(0)
  const trackWidth = useSharedValue(0)
  const target = usageRatio(totalBytes, limit.bytes)

  useEffect(() => {
    // spring from wherever the bar is now, never from the target
    ratio.value = reduce ? target : withSpring(target, amSpring.default)
  }, [target, reduce, ratio])

  const fill = useAnimatedStyle(() => ({
    transform: [{ translateX: -(1 - ratio.value) * trackWidth.value }],
  }))

  return (
    <View style={[styles.total, { backgroundColor: theme.forest }]}>
      <Text style={[amType.label, { color: amColors.gold300 }]}>Downloaded songs</Text>
      <Text
        style={styles.totalValue}
        accessibilityLabel={`${formatBytes(totalBytes)} downloaded`}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {formatBytes(totalBytes)}
      </Text>
      <View
        style={[styles.track, { backgroundColor: amDark.line }]}
        onLayout={(event) => {
          trackWidth.value = event.nativeEvent.layout.width
        }}
        accessibilityRole="progressbar"
        accessibilityValue={limit.bytes == null ? undefined : { min: 0, max: 100, now: Math.round(target * 100) }}
      >
        <Animated.View style={[styles.fill, { backgroundColor: theme.brand }, fill]} />
      </View>
      <Text style={[amType.body, { color: amColors.sage300 }]}>{storageLegend(count, limit)}</Text>
    </View>
  )
}

/** Cache limit chips: 500 MB, 1 GB, 2 GB, No limit. */
export function CacheLimitChips({
  theme,
  value,
  onChange,
}: ThemeProps & { value: CacheLimitId; onChange: (id: CacheLimitId) => void }) {
  return (
    <View>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {CACHE_LIMITS.map((limit) => {
          const active = limit.id === value
          return (
            <PressScale
              key={limit.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Cache limit ${limit.label}`}
              onPress={() => onChange(limit.id)}
              pressedScale={0.95}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: theme.brand, borderColor: theme.brand }
                  : { backgroundColor: theme.card, borderColor: theme.line },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? theme.onBrand : theme.textHeading }]}>{limit.label}</Text>
            </PressScale>
          )
        })}
      </View>
      <Text style={[amType.body, styles.note, { color: theme.textBody }]}>
        When the limit is full, the oldest downloads are removed first. Songs saved to Mine stay until you delete
        them.
      </Text>
    </View>
  )
}

/** Header of the list: count and `Select all` / `Deselect all`. */
export function StorageListHeader({
  theme,
  count,
  allSelected,
  onToggleAll,
}: ThemeProps & { count: number; allSelected: boolean; onToggleAll: () => void }) {
  return (
    <View style={styles.listHeader}>
      <Text style={[amType.label, { color: theme.eyebrow }]}>
        {count} {count === 1 ? "recording" : "recordings"}
      </Text>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={allSelected ? "Deselect all" : "Select all"}
        onPress={onToggleAll}
        pressedScale={0.94}
        style={styles.linkHit}
      >
        <Text style={[styles.link, { color: theme.eyebrow }]}>{allSelected ? "Deselect all" : "Select all"}</Text>
      </PressScale>
    </View>
  )
}

/** One downloaded recording: round checkbox, title, `PS 3`, size. Tapping selects. */
export function StorageRow({
  theme,
  item,
  items,
  title,
  selected,
  onToggle,
}: ThemeProps & {
  item: StorageItem
  items: readonly StorageItem[]
  title: string
  selected: boolean
  onToggle: () => void
}) {
  const eyebrow = storageRowEyebrow(items, item)
  return (
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${eyebrow}, ${title}, ${formatBytes(item.bytes)}`}
      onPress={onToggle}
      pressedScale={0.985}
      style={[styles.row, { backgroundColor: theme.card, borderColor: selected ? theme.brand : theme.line }]}
    >
      <View
        style={[
          styles.check,
          selected ? { backgroundColor: theme.brand, borderColor: theme.brand } : { borderColor: amColors.ink300 },
        ]}
      >
        {selected ? <Check size={16} color={theme.onBrand} strokeWidth={3} /> : null}
      </View>
      <View style={styles.rowCopy}>
        <Text style={[amType.label, { color: theme.eyebrow }]}>{eyebrow}</Text>
        <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <Text style={[styles.size, { color: theme.textBody }]}>{formatBytes(item.bytes)}</Text>
    </PressScale>
  )
}

/**
 * Floating clear pill above the safe area. Red for clear-all, orange for selected.
 * Rises and sinks on a spring; text is 19px bold, which counts as large text on red.
 */
export function ClearActionPill({
  theme,
  action,
  onPress,
}: ThemeProps & { action: ClearActionModel; onPress: () => void }) {
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const shown = useSharedValue(0)
  const visible = action.visible
  // keep the last label while the pill sinks
  const [last, setLast] = useState<Extract<ClearActionModel, { visible: true }> | null>(null)

  useEffect(() => {
    if (action.visible) setLast(action)
  }, [action])

  useEffect(() => {
    shown.value = reduce ? (visible ? 1 : 0) : withSpring(visible ? 1 : 0, amSpring.default)
  }, [visible, reduce, shown])

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: reduce ? 0 : (1 - shown.value) * 96 }],
  }))

  const model = action.visible ? action : last
  if (!model) return null

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.pillWrap, { bottom: insets.bottom + amGap.block }, animated]}
    >
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={model.label}
        onPress={onPress}
        pressedScale={0.97}
        style={[styles.pill, { backgroundColor: model.tone === "danger" ? amColors.danger : theme.brand }]}
      >
        <Text style={styles.pillText} numberOfLines={1}>
          {model.label}
        </Text>
      </PressScale>
    </Animated.View>
  )
}

/** A short confirmation that rises above the pill and sinks again. Opacity and transform only. */
export function Toast({ message }: { message: { id: number; text: string } | null }) {
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const shown = useSharedValue(0)
  const [text, setText] = useState("")

  useEffect(() => {
    if (!message) return
    setText(message.text)
    shown.value = reduce ? 1 : withSpring(1, amSpring.default)
    const timer = setTimeout(() => {
      shown.value = reduce ? 0 : withSpring(0, amSpring.default)
    }, 2400)
    return () => clearTimeout(timer)
  }, [message, reduce, shown])

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: reduce ? 0 : (1 - shown.value) * 24 }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toastWrap, { bottom: insets.bottom + amGap.block + 56 + 12 }, animated]}
    >
      <View style={styles.toast}>
        <Text style={styles.toastText}>{text}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  total: { borderRadius: amRadius.panel, padding: amGap.padPanel, gap: 12 },
  totalValue: {
    fontFamily: amFonts.display,
    fontSize: 64,
    lineHeight: 68,
    letterSpacing: -1.28,
    color: amColors.white,
  },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, width: "100%", borderRadius: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    minHeight: amTouchTarget,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontFamily: amFonts.semi, fontSize: amFontSize.body },
  note: { marginTop: amGap.text },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: amTouchTarget,
  },
  linkHit: { minHeight: amTouchTarget, justifyContent: "center", paddingLeft: 12 },
  link: { fontFamily: amFonts.bold, fontSize: amFontSize.body },
  row: {
    minHeight: 64,
    borderRadius: amRadius.card,
    borderWidth: 1,
    paddingHorizontal: amGap.padCard,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, gap: 4 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 24 },
  size: { fontFamily: amFonts.semi, fontSize: amFontSize.body },
  pillWrap: { position: "absolute", left: amGap.gutter, right: amGap.gutter },
  pill: {
    height: 56,
    borderRadius: amRadius.pill,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { fontFamily: amFonts.bold, fontSize: amFontSize.lead, color: amColors.white },
  toastWrap: { position: "absolute", left: amGap.gutter, right: amGap.gutter, alignItems: "center" },
  toast: {
    backgroundColor: amColors.ink900,
    borderRadius: amRadius.pill,
    paddingHorizontal: 20,
    minHeight: amTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: { fontFamily: amFonts.semi, fontSize: amFontSize.body, color: amColors.white },
})
