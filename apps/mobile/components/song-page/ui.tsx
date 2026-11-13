import { useEffect, useRef, type ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native"
import Svg, { Path } from "react-native-svg"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { usePageT } from "@/lib/songPage/pageCopy"

/** `#RRGGBB` and an opacity as `rgba()`, so a gradient fades to a colour of its own and not to grey. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = Number.parseInt(m[1] as string, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export type BarIcon = "back" | "more" | "share" | "menu"

/** Three lines: the sections menu. */
export function MenuGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16M4 12h16M4 17h10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function BarGlyph({ icon, size, color }: { icon: BarIcon; size: number; color: string }) {
  if (icon === "back") return <SpIcon name="back" size={size} color={color} strokeWidth={2} />
  if (icon === "menu") return <MenuGlyph size={size} color={color} />
  return <PlayerIcon name={icon} size={size} color={color} />
}

/** Round button over a photo: dark scrim, white icon (text and icons on photos always sit on a scrim). */
export function PhotoButton({ icon, label, onPress }: { t?: SpTheme; icon: BarIcon; label: string; onPress: () => void }) {
  return (
    <SpPress onPress={onPress} accessibilityLabel={label} pressedScale={0.92} style={[styles.photoBtn, { backgroundColor: "rgba(20,16,12,0.55)" }]}>
      <BarGlyph icon={icon} size={22} color="#FFFFFF" />
    </SpPress>
  )
}

/** Plain round button on the page ground (the compact bar). */
export function BarButton({ t, icon, label, onPress }: { t: SpTheme; icon: BarIcon; label: string; onPress: () => void }) {
  return (
    <SpPress onPress={onPress} accessibilityLabel={label} pressedScale={0.92} style={styles.barBtn}>
      <BarGlyph icon={icon} size={24} color={t.ink900} />
    </SpPress>
  )
}

/** The small tag on sample material that only the preview's demo songs carry. */
export function DemoTag({ t }: { t: SpTheme }) {
  const tr = usePageT()
  return (
    <View style={styles.tagRow}>
      <View style={[styles.tag, { borderColor: t.ink500 }]}>
        <Text style={[styles.tagText, { color: t.ink500 }]}>{tr("songPage.demo")}</Text>
      </View>
    </View>
  )
}

/** Small caps label ("TRANSLATION", "WORDS AND MUSIC"). */
export function Eyebrow({ t, children, style }: { t: SpTheme; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text style={[styles.eyebrow, { color: t.ink800 }]}>{children}</Text>
    </View>
  )
}

/** The quiet one-line notes ("No word meanings yet."). */
export function QuietNote({ t, children }: { t: SpTheme; children: ReactNode }) {
  return <Text style={[styles.quiet, { color: t.ink500 }]}>{children}</Text>
}

/** The title of a section of the page. */
export function SectionTitle({ t, children }: { t: SpTheme; children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: t.ink900 }]}>
      {children}
    </Text>
  )
}

export type TabItem<T extends string> = { id: T; label: string }

/**
 * The pinned strip: text tabs with an underline, the look of the old "Pairs" page. Each tab jumps to a
 * section of the page and follows the scroll. Six tabs are wider than a phone, so the row scrolls sideways and
 * keeps the active tab in view.
 */
export function SectionTabs<T extends string>({ t, items, active, onSelect }: { t: SpTheme; items: TabItem<T>[]; active: T | null; onSelect: (id: T) => void }) {
  const tr = usePageT()
  const scroll = useRef<ScrollView | null>(null)
  const frames = useRef<Record<string, { x: number; width: number }>>({})
  const viewport = useRef(0)
  useEffect(() => {
    if (!active) return
    const frame = frames.current[active]
    if (!frame || !viewport.current) return
    scroll.current?.scrollTo({ x: Math.max(0, frame.x + frame.width / 2 - viewport.current / 2), animated: true })
  }, [active])
  return (
    <View style={[styles.textTabsWrap, { borderBottomColor: t.sand400 }]} accessibilityRole="tablist" accessibilityLabel={tr("songPage.tabs.a11y")}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event: LayoutChangeEvent) => {
          viewport.current = event.nativeEvent.layout.width
        }}
        contentContainerStyle={styles.textTabs}
      >
        {items.map((item) => {
          const on = item.id === active
          return (
            <View
              key={item.id}
              onLayout={(event: LayoutChangeEvent) => {
                frames.current[item.id] = { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width }
              }}
            >
              <SpPress onPress={() => onSelect(item.id)} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: on }} style={styles.textTab}>
                <Text style={[styles.textTabLabel, { color: on ? t.ink900 : t.ink500, fontFamily: on ? amFonts.bold : amFonts.semi }]}>{item.label}</Text>
                <View style={[styles.textTabBar, { backgroundColor: on ? t.action : "transparent" }]} />
              </SpPress>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

export type SegItem<T extends string> = { id: T; label: string; a11y?: string; fontSize?: number; disabled?: boolean }

/**
 * A pill with two or three choices, one of them on ("Lines | Word by word", the text size). Each segment is at
 * least 44 high; the chosen one is filled the way a chosen chip is.
 */
export function Segmented<T extends string>({
  t,
  items,
  value,
  onChange,
  label,
  style,
  equal,
  role = "radio",
  fit,
  compact,
}: {
  t: SpTheme
  items: Array<SegItem<T>>
  value: T
  onChange: (id: T) => void
  label: string
  style?: StyleProp<ViewStyle>
  /** segments share the width equally */
  equal?: boolean
  /** "tab" when the segments switch what a block shows, "radio" when they pick a setting */
  role?: "radio" | "tab"
  /** one line each, the segments grow to share the row (three short labels in a phone width) */
  fit?: boolean
  /** small and quiet: 32 high, 13pt, the width of its words (a switch inside a page, not a main control) */
  compact?: boolean
}) {
  return (
    <View accessibilityRole={role === "tab" ? "tablist" : "radiogroup"} accessibilityLabel={label} style={[styles.seg, { backgroundColor: t.white, borderColor: t.sand400 }, compact && { backgroundColor: t.sand300, borderColor: t.sand300 }, style]}>
      {items.map((item) => {
        const on = item.id === value
        const fg = on ? (compact ? t.ink900 : t.dark ? t.onAction : t.onInk) : compact ? t.ink500 : t.ink800
        return (
          <SpPress
            key={item.id}
            onPress={() => onChange(item.id)}
            disabled={item.disabled}
            accessibilityRole={role}
            accessibilityLabel={item.a11y ?? item.label}
            accessibilityState={{ selected: on, disabled: item.disabled }}
            pressedScale={0.96}
            style={[styles.segItem, equal && { flex: 1 }, fit && styles.segFit, compact && styles.segCompact, { backgroundColor: on ? (compact ? t.white : t.dark ? t.action : t.ink900) : "transparent" }]}
          >
            <Text
              style={[styles.segLabel, compact && styles.segLabelCompact, { color: fg, fontFamily: on ? amFonts.bold : amFonts.semi }, item.disabled && { opacity: 0.45 }, item.fontSize ? { fontSize: item.fontSize, lineHeight: Math.round(item.fontSize * 1.3) } : null]}
              numberOfLines={equal && !fit ? 2 : 1}
              adjustsFontSizeToFit={fit}
              minimumFontScale={fit ? 0.8 : undefined}
            >
              {item.label}
            </Text>
          </SpPress>
        )
      })}
    </View>
  )
}

/** A single pill button of the same size and look as a segment (the script and language choosers). */
export function ToolPill({ t, label, value, onPress, a11y }: { t: SpTheme; label?: string; value: string; onPress: () => void; a11y: string }) {
  return (
    <SpPress onPress={onPress} accessibilityLabel={a11y} pressedScale={0.96} style={[styles.pill, { backgroundColor: t.white, borderColor: t.sand400 }]}>
      {label ? <Text style={[styles.pillLabel, { color: t.ink500 }]}>{label}</Text> : null}
      <Text style={[styles.pillValue, { color: t.ink900 }]} numberOfLines={1}>
        {value}
      </Text>
      <SpIcon name="chevDown" size={16} color={t.ink500} strokeWidth={2} />
    </SpPress>
  )
}

/** A row with a chevron: the rows of the sections menu. */
export function ChevronRow({
  t,
  title,
  subtitle,
  onPress,
  leading,
  last,
}: {
  t: SpTheme
  title: string
  subtitle?: string
  onPress?: () => void
  leading?: ReactNode
  last?: boolean
}) {
  return (
    <SpPress
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      pressedScale={0.99}
      style={[styles.row, { borderBottomColor: t.sand400, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}
    >
      {leading ? <View style={[styles.rowIcon, { backgroundColor: t.sand300 }]}>{leading}</View> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: t.ink900 }]}>{title}</Text>
        {subtitle ? <Text style={[styles.rowSub, { color: t.ink500 }]}>{subtitle}</Text> : null}
      </View>
      {onPress ? <SpIcon name="chevRight" size={20} color={t.ink500} strokeWidth={2} /> : null}
    </SpPress>
  )
}

const styles = StyleSheet.create({
  photoBtn: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  barBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tagRow: { paddingHorizontal: 20, paddingTop: 8, flexDirection: "row" },
  tag: { borderWidth: 1, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  eyebrow: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  quiet: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, paddingVertical: 8 },
  sectionTitle: { fontFamily: amFonts.bold, fontSize: 24, lineHeight: 30, paddingHorizontal: 20, paddingBottom: 12 },
  textTabsWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  textTabs: { paddingHorizontal: 12 },
  textTab: { minHeight: 48, paddingHorizontal: 12, justifyContent: "center", alignItems: "center" },
  textTabLabel: { fontSize: 16, lineHeight: 22 },
  textTabBar: { position: "absolute", left: 12, right: 12, bottom: 0, height: 3, borderRadius: 2 },
  seg: { flexDirection: "row", alignItems: "center", padding: 2, borderRadius: 9999, borderWidth: 1 },
  segItem: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  segFit: { flexGrow: 1, paddingHorizontal: 12 },
  segLabel: { fontSize: 15, lineHeight: 20, textAlign: "center" },
  segCompact: { minHeight: 32, minWidth: 32, paddingHorizontal: 12, paddingVertical: 0 },
  segLabelCompact: { fontSize: 13, lineHeight: 18 },
  pill: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1 },
  pillLabel: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  pillValue: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, flexShrink: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, minHeight: 64, paddingVertical: 8 },
  rowIcon: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  rowSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
