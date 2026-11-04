import { useEffect, useState } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { BackGlyph } from "@/components/songs-v2/Glyphs"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Chip } from "@/components/songs-v2/Pill"
import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/songs-v2/primitives"
import { amColors } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
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

type ThemeProps = { theme: SongsTheme }

/** Prototype `.ovl-h`: 44px round back button and the title, 19/600. Also used by the playlist page. */
export function BackHeader({ theme, onBack, title }: ThemeProps & { onBack: () => void; title?: string }) {
  return (
    <View style={styles.header}>
      <Press
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        pressedScale={0.92}
        style={[styles.round, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <BackGlyph color={theme.textHeading} />
      </Press>
      {title ? (
        <Text style={[styles.headerTitle, { color: theme.textHeading }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * Prototype `.lcard.dark`: sage-900 card, radius 30, an over-label, the total at 45px, a 10px usage
 * bar against the limit and a legend. The bar fill slides on a spring from where it is now.
 */
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
    ratio.value = reduce ? target : withSpring(target, amSpring.default)
  }, [target, reduce, ratio])

  const fill = useAnimatedStyle(() => ({
    transform: [{ translateX: -(1 - ratio.value) * trackWidth.value }],
  }))

  return (
    <View style={[styles.total, { backgroundColor: theme.forest }]}>
      <Text style={[overStyle, { color: amColors.gold300 }]}>Downloaded songs</Text>
      <Text style={styles.totalValue} accessibilityLabel={`${formatBytes(totalBytes)} downloaded`} numberOfLines={1}>
        {formatBytes(totalBytes)}
      </Text>
      <View
        style={styles.track}
        onLayout={(event) => {
          trackWidth.value = event.nativeEvent.layout.width
        }}
        accessibilityRole="progressbar"
        accessibilityValue={limit.bytes == null ? undefined : { min: 0, max: 100, now: Math.round(target * 100) }}
      >
        <Animated.View style={[styles.fill, fill]} />
      </View>
      <Text style={styles.legend}>{storageLegend(count, limit)}</Text>
    </View>
  )
}

/** "Cache limit" over-label, the four chips (scroll sideways when they do not fit) and the note. */
export function CacheLimitSection({
  theme,
  value,
  onChange,
}: ThemeProps & { value: CacheLimitId; onChange: (id: CacheLimitId) => void }) {
  return (
    <View style={styles.limitBlock}>
      <View style={styles.rowAct}>
        <Text style={[overStyle, { color: theme.accent }]}>Cache limit</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityRole="radiogroup"
      >
        {CACHE_LIMITS.map((limit) => (
          <Chip
            key={limit.id}
            theme={theme}
            label={limit.label}
            active={limit.id === value}
            onPress={() => onChange(limit.id)}
            accessibilityLabel={`Cache limit ${limit.label}`}
          />
        ))}
      </ScrollView>
      <Text style={[styles.note, { color: theme.textBody }]}>
        When the limit is full, the oldest downloads are removed first. Songs you saved to Mine stay until you delete
        them.
      </Text>
    </View>
  )
}

/** Prototype `.row-act`: `4 recordings` over-label and the Select all link. */
export function StorageListHeader({
  theme,
  count,
  allSelected,
  onToggleAll,
}: ThemeProps & { count: number; allSelected: boolean; onToggleAll: () => void }) {
  const label = allSelected ? "Deselect all" : "Select all"
  return (
    <View style={styles.rowAct}>
      <Text style={[overStyle, { color: theme.accent }]}>
        {count} {count === 1 ? "recording" : "recordings"}
      </Text>
      <Press
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onToggleAll}
        pressedScale={0.96}
        style={styles.link}
      >
        <Text style={[styles.linkText, { color: theme.accent }]}>{label}</Text>
      </Press>
    </View>
  )
}

/** Prototype `.card.srow`: check, title with `PS 3` under it, size. A tap selects. */
export function StorageRow({
  theme,
  item,
  items,
  title,
  sub: subLine,
  selected,
  onToggle,
}: ThemeProps & {
  item: StorageItem
  items: readonly StorageItem[]
  title: string
  /** line under the title; default `PS 3` or `PS 3 · Version 2` */
  sub?: string
  selected: boolean
  onToggle: () => void
}) {
  const sub = subLine ?? storageRowEyebrow(items, item)
  return (
    <Press
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${sub}, ${title}, ${formatBytes(item.bytes)}`}
      onPress={onToggle}
      pressedScale={0.98}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <View
        style={[
          styles.check,
          selected ? { backgroundColor: theme.brand, borderColor: theme.brand } : { borderColor: theme.ink300 },
        ]}
      >
        {selected ? <View style={styles.tick} /> : null}
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.rowSub, { color: theme.textBody }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text style={[styles.size, { color: theme.textHeading }]}>{formatBytes(item.bytes)}</Text>
    </Press>
  )
}

/**
 * Prototype `.sbar`: a 56px pill 10px from the sides and 28px from the bottom with a soft shadow.
 * Red for clear-all, orange for the selected rows. Rises and sinks on a spring.
 */
export function ClearActionPill({ action, onPress }: ThemeProps & { action: ClearActionModel; onPress: () => void }) {
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
      style={[styles.sbar, { bottom: Platform.OS === "web" ? 28 : Math.max(28, insets.bottom + 8) }, animated]}
    >
      <Press
        accessibilityRole="button"
        accessibilityLabel={model.label}
        onPress={onPress}
        pressedScale={0.98}
        outerStyle={styles.sbarPress}
        style={[styles.sbarPill, { backgroundColor: model.tone === "danger" ? amColors.danger : amColors.orange500 }]}
      >
        <Text style={styles.sbarText} numberOfLines={1}>
          {model.label}
        </Text>
      </Press>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 12 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 21, letterSpacing: -0.19 },
  total: { borderRadius: 30, padding: 20, gap: 10, overflow: "hidden" },
  totalValue: {
    fontFamily: amFonts.display,
    fontSize: 45,
    lineHeight: 45,
    letterSpacing: -0.9,
    textTransform: "uppercase",
    color: amColors.white,
    fontVariant: ["tabular-nums"],
  },
  track: { height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.2)" },
  fill: { height: 10, width: "100%", borderRadius: 5, backgroundColor: amColors.orange500 },
  legend: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.82)" },
  limitBlock: { gap: 12 },
  rowAct: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  chips: { gap: 8 },
  note: { paddingHorizontal: 10, fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  link: { height: 44, paddingHorizontal: 4, justifyContent: "center" },
  linkText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  row: {
    minHeight: 72,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  tick: { position: "absolute", left: 8, top: 3, width: 6, height: 11, borderColor: amColors.white, borderRightWidth: 2.5, borderBottomWidth: 2.5, transform: [{ rotate: "45deg" }] },
  rowMain: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22, letterSpacing: -0.17 },
  rowSub: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  size: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18, fontVariant: ["tabular-nums"] },
  sbar: { position: "absolute", left: 10, right: 10, flexDirection: "row", zIndex: 3 },
  sbarPress: { flex: 1 },
  sbarPill: {
    height: 56,
    borderRadius: 70,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#140E0B",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sbarText: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20, color: amColors.white },
})
