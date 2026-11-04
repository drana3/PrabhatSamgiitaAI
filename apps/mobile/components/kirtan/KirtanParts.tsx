import { useEffect, useState, type ReactNode } from "react"
import { Image as RNImage, ScrollView, StyleSheet, Text, View, type DimensionValue } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import { KPress } from "@/components/kirtan/KPress"
import { amColors } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { songsAssets } from "@/constants/songsAssets"
import { kirtanRowLabel, kirtanSubline } from "@/lib/kirtan/list"
import { KIRTAN_CHIPS, STATUS_LABEL, type Kirtan, type KirtanStatus, type KirtanTypeFilter } from "@/lib/kirtan/types"

/* ------------------------------------------------------------------ glyphs */

type G = { size?: number; color: string; strokeWidth?: number }
function Stroke({ d, size = 22, color, strokeWidth = 1.75 }: G & { d: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
export const MoreGlyph = ({ size = 22, color }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M5 10.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm7 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm7 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill={color} />
  </Svg>
)
export const PlusGlyph = (p: G) => <Stroke size={20} {...p} d="M12 5v14M5 12h14" />
export const ChevronGlyph = (p: G) => <Stroke size={20} {...p} d="M9 5l7 7-7 7" />
export const PlayFilled = ({ size = 18, color }: G) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M8 5l11 7-11 7z" fill={color} />
  </Svg>
)

/* ------------------------------------------------------------------ labels */

/** Small outlined orange label. */
export function KirtanTag({ theme, color }: { theme: SongsTheme; color?: string }) {
  const tone = color ?? theme.accent
  return (
    <View style={[styles.tag, { borderColor: tone }]}>
      <Text style={[styles.tagText, { color: tone }]}>KIIRTAN</Text>
    </View>
  )
}

/** Muted label of a Prabhat Samgiita song among kirtans: `PS 3`. */
export function PsTag({ theme, number }: { theme: SongsTheme; number: number }) {
  return (
    <View style={[styles.tag, { borderColor: theme.line, backgroundColor: theme.inner }]}>
      <Text style={[styles.tagText, { color: theme.textBody }]}>PS {number}</Text>
    </View>
  )
}

export function StatusBadge({ theme, status }: { theme: SongsTheme; status: KirtanStatus }) {
  const tone =
    status === "approved"
      ? { bg: theme.oliveBg, fg: theme.oliveText }
      : status === "rejected"
        ? { bg: "transparent", fg: amColors.danger }
        : { bg: theme.peach, fg: theme.accent }
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: status === "rejected" ? amColors.danger : "transparent" }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>{STATUS_LABEL[status]}</Text>
    </View>
  )
}

/* ---------------------------------------------------------------- thumbnail */

function hashOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h
}

const GRADIENTS: readonly (readonly [string, string])[] = [
  [amColors.sage700, amColors.sage900],
  [amColors.orange600, amColors.orange700],
  [amColors.gold500, amColors.orange600],
  [amColors.sage800, "#121A10"],
]

/** YouTube's picture when there is one, a gradient (steady per video) while it loads or when it cannot. */
export function KirtanThumb({
  kirtan,
  width,
  height,
  aspectRatio,
  radius,
}: {
  kirtan: Pick<Kirtan, "id" | "thumbnailUrl">
  width: DimensionValue
  /** give a height or an aspect ratio */
  height?: number
  aspectRatio?: number
  radius: number
}) {
  const [failed, setFailed] = useState(false)
  const [from, to] = GRADIENTS[hashOf(kirtan.id) % GRADIENTS.length]
  const showImage = Boolean(kirtan.thumbnailUrl) && !failed
  return (
    <View style={{ width, height, aspectRatio, borderRadius: radius, overflow: "hidden" }}>
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.thumbGlyph}>
        <PlayFilled size={typeof width === "number" ? Math.round(Math.min(width, height ?? width) * 0.32) : 44} color="rgba(255,255,255,0.78)" />
      </View>
      {showImage ? (
        <Image
          source={{ uri: kirtan.thumbnailUrl as string }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  )
}

/* --------------------------------------------------------------------- rows */

/** A kirtan: thumbnail, title, `KIRTAN` tag with `YouTube · 12:40 · added by Priya`, the more button. */
export function KirtanRow({
  theme,
  kirtan,
  onOpen,
  onMore,
  trailing,
}: {
  theme: SongsTheme
  kirtan: Kirtan
  onOpen: (k: Kirtan) => void
  onMore?: (k: Kirtan) => void
  trailing?: ReactNode
}) {
  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }]}>
      <KPress
        accessibilityRole="button"
        accessibilityLabel={kirtanRowLabel(kirtan)}
        onPress={() => onOpen(kirtan)}
        onLongPress={onMore ? () => onMore(kirtan) : undefined}
        delayLongPress={350}
        pressedScale={0.985}
        outerStyle={styles.rowMainOuter}
        style={styles.rowMain}
      >
        <KirtanThumb kirtan={kirtan} width={60} height={60} radius={14} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={2}>
            {kirtan.title}
          </Text>
          <View style={styles.subRow}>
            <KirtanTag theme={theme} />
            <Text style={[styles.subText, { color: theme.textBody }]} numberOfLines={1}>
              {kirtanSubline(kirtan)}
            </Text>
          </View>
        </View>
      </KPress>
      {trailing ??
        (onMore ? (
          <KPress accessibilityRole="button" accessibilityLabel={`More actions for ${kirtan.title}`} onPress={() => onMore(kirtan)} pressedScale={0.88} style={styles.more}>
            <MoreGlyph color={theme.textBody} />
          </KPress>
        ) : null)}
    </View>
  )
}

/** `+ Add kirtan`: a dashed card at the top of the list. */
export function AddKirtanRow({ theme, onPress }: { theme: SongsTheme; onPress: () => void }) {
  return (
    <KPress
      accessibilityRole="button"
      accessibilityLabel="Add kiirtan. Share a public YouTube link."
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.add, { borderColor: theme.accent }]}
    >
      <View style={[styles.addDisc, { backgroundColor: theme.peach }]}>
        <PlusGlyph color={theme.accent} strokeWidth={2.25} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.addTitle, { color: theme.textHeading }]}>Add kiirtan</Text>
        <Text style={[styles.subText, { color: theme.textBody }]}>Share a public YouTube link for review</Text>
      </View>
      <ChevronGlyph color={theme.textBody} />
    </KPress>
  )
}

/* -------------------------------------------------------------------- chips */

/** Type chips: All, Baba Nam Kevalam, Lila kirtan, Festival, Other. The chosen one is ink-filled. */
export function TypeChips({ theme, value, onChange }: { theme: SongsTheme; value: KirtanTypeFilter; onChange: (id: KirtanTypeFilter) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
      {KIRTAN_CHIPS.map((chip) => {
        const on = chip.id === value
        return (
          <KPress
            key={chip.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onActivate={() => onChange(chip.id)}
            pressedScale={0.95}
            style={[styles.chip, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : theme.line }]}
          >
            <Text style={[styles.chipText, { color: on ? theme.onInk : theme.textHeading }]}>{chip.label}</Text>
          </KPress>
        )
      })}
    </ScrollView>
  )
}

/* ------------------------------------------------------ source switch (top) */

export const SOURCE_SEGMENTS = [
  { id: "ps", label: "Prabhat Samgiita" },
  { id: "kirtan", label: "Kiirtan" },
  { id: "mixes", label: "Mixes" },
] as const
export type SourceId = (typeof SOURCE_SEGMENTS)[number]["id"]

export const SOURCE_BAR_HEIGHT = 44
/** the bar plus the gap under it; the Songs screen adds this to its top inset */
export const SOURCE_BAR_BLOCK = 52
const TRACK_INSET = 4

/**
 * `Prabhat Samgiita | Kirtan | Mixes`. Answers touch-down. The orange segment slides on a spring that
 * starts from where it is on screen; with reduced motion it cross-fades instead.
 */
export function SourceSwitch({ theme, value, onChange }: { theme: SongsTheme; value: SourceId; onChange: (id: SourceId) => void }) {
  const reduce = useReducedMotion()
  const [width, setWidth] = useState(0)
  const x = useSharedValue(0)
  const fade = useSharedValue(1)
  const inner = Math.max(0, width - 2)
  const cell = Math.max(0, (inner - TRACK_INSET * 2) / SOURCE_SEGMENTS.length)
  const index = SOURCE_SEGMENTS.findIndex((s) => s.id === value)

  useEffect(() => {
    if (!width) return
    const target = TRACK_INSET + index * cell
    if (reduce) {
      fade.value = 0
      x.value = target
      fade.value = withTiming(1, { duration: 150 })
    } else {
      x.value = withSpring(target, amSpring.default)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, width, cell, reduce])

  const indicator = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: x.value }] }))

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => {
        const w = event.nativeEvent.layout.width
        if (w !== width) {
          const c = Math.max(0, (w - 2 - TRACK_INSET * 2) / SOURCE_SEGMENTS.length)
          x.value = TRACK_INSET + index * c
          setWidth(w)
        }
      }}
      style={[styles.track, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Animated.View style={[styles.indicator, { width: cell, backgroundColor: theme.brand }, indicator]} />
      {SOURCE_SEGMENTS.map((segment) => {
        const selected = segment.id === value
        return (
          <KPress
            key={segment.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onActivate={() => onChange(segment.id)}
            pressedScale={0.97}
            outerStyle={styles.segOuter}
            style={styles.segCell}
          >
            <Text style={[styles.segLabel, { color: selected ? "#FFFFFF" : theme.textBody }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {segment.label}
            </Text>
          </KPress>
        )
      })}
    </View>
  )
}

/* --------------------------------------------------- screen header (shared) */

/** The round profile button, fixed at the top right like the Songs screen's. */
export function AvatarButton({ theme, top, initial, onPress }: { theme: SongsTheme; top: number; initial: string; onPress: () => void }) {
  return (
    <View style={[styles.avatarSlot, { top }]} pointerEvents="box-none">
      <KPress accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={onPress} pressedScale={0.94} style={[styles.avatar, { backgroundColor: theme.peach }]}>
        <Text style={[styles.avatarText, { color: theme.accent }]}>{initial}</Text>
      </KPress>
    </View>
  )
}

export function KirtanScreenHead({ theme, title, count, logo = true }: { theme: SongsTheme; title: string; count?: number; logo?: boolean }) {
  return (
    <View>
      {logo ? (
        <View style={styles.head}>
          <RNImage source={songsAssets.logoMark} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
        </View>
      ) : null}
      <View style={styles.titleBlock}>
        <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
          {title}
        </Text>
        {count != null ? <Text style={[styles.h1, { color: theme.ink300 }]}>{count}</Text> : null}
      </View>
    </View>
  )
}

/** Eyebrow-sized heading of a block inside the list. */
export function BlockHead({ theme, label, note }: { theme: SongsTheme; label: string; note?: string }) {
  return (
    <View style={styles.blockHead}>
      <Text style={[styles.blockLabel, { color: theme.accent }]} accessibilityRole="header">
        {label}
      </Text>
      {note ? <Text style={[styles.subText, { color: theme.textBody }]}>{note}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, height: 18, alignItems: "center", justifyContent: "center" },
  tagText: { fontFamily: amFonts.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.8 },
  badge: { borderWidth: 1, borderRadius: 70, paddingHorizontal: 10, height: 24, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 14 },
  thumbGlyph: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  row: { minHeight: 84, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingRight: 4 },
  rowMainOuter: { flex: 1, minWidth: 0 },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 10 },
  rowText: { flex: 1, minWidth: 0, gap: 6 },
  rowTitle: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20, letterSpacing: -0.1 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  subText: { flexShrink: 1, fontFamily: amFonts.medium, fontSize: 12.5, lineHeight: 17 },
  more: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  add: { minHeight: 76, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 14, paddingVertical: 12 },
  addDisc: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  addTitle: { fontFamily: amFonts.semi, fontSize: 17, lineHeight: 22 },
  chips: { paddingHorizontal: 10, gap: 8 },
  chip: { height: 44, paddingHorizontal: 18, borderRadius: 70, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  track: { height: SOURCE_BAR_HEIGHT, marginHorizontal: 10, borderRadius: 70, borderWidth: 1, padding: TRACK_INSET, flexDirection: "row", alignItems: "stretch" },
  indicator: { position: "absolute", top: TRACK_INSET, bottom: TRACK_INSET, left: 0, borderRadius: 70 },
  segOuter: { flex: 1 },
  segCell: { height: SOURCE_BAR_HEIGHT - 2 - TRACK_INSET * 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  segLabel: { fontFamily: amFonts.semi, fontSize: 13.5, lineHeight: 18 },
  head: { height: 56, paddingHorizontal: 10, flexDirection: "row", alignItems: "center" },
  logo: { height: 36, width: 30 },
  avatarSlot: { position: "absolute", right: 10, width: 44, height: 44, zIndex: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: amFonts.bold, fontSize: 18, lineHeight: 22 },
  titleBlock: { paddingTop: 12, paddingHorizontal: 10, paddingBottom: 20 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase", fontVariant: ["tabular-nums"] },
  blockHead: { paddingHorizontal: 10, paddingTop: 8, gap: 2 },
  blockLabel: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
})
