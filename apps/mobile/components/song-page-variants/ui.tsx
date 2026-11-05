import type { ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"

import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpChip, SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useVariantT } from "@/lib/songPageVariants/copy"

/** `#RRGGBB` and an opacity as `rgba()`, so a gradient fades to a colour of its own and not to grey. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = Number.parseInt(m[1] as string, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Round button over a photo: dark scrim, white icon (text and icons on photos always sit on a scrim). */
export function PhotoButton({ t, icon, label, onPress }: { t: SpTheme; icon: "back" | "more" | "share"; label: string; onPress: () => void }) {
  return (
    <SpPress onPress={onPress} accessibilityLabel={label} pressedScale={0.92} style={[styles.photoBtn, { backgroundColor: "rgba(20,16,12,0.55)" }]}>
      {icon === "back" ? <SpIcon name="back" size={22} color="#FFFFFF" strokeWidth={2} /> : <PlayerIcon name={icon} size={22} color="#FFFFFF" />}
    </SpPress>
  )
}

/** Plain round button on the page ground (the compact bar). */
export function BarButton({ t, icon, label, onPress }: { t: SpTheme; icon: "back" | "more" | "share"; label: string; onPress: () => void }) {
  return (
    <SpPress onPress={onPress} accessibilityLabel={label} pressedScale={0.92} style={styles.barBtn}>
      {icon === "back" ? <SpIcon name="back" size={24} color={t.ink900} strokeWidth={2} /> : <PlayerIcon name={icon} size={24} color={t.ink900} />}
    </SpPress>
  )
}

/** The small tag on sample material that only the preview's demo songs carry. */
export function DemoTag({ t }: { t: SpTheme }) {
  const tr = useVariantT()
  return (
    <View style={styles.tagRow}>
      <View style={[styles.tag, { borderColor: t.ink500 }]}>
        <Text style={[styles.tagText, { color: t.ink500 }]}>{tr("songVariant.demo")}</Text>
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

export type PillItem<T extends string> = { id: T; label: string }

/** Pill tabs (variant B): the chosen one is filled, the others are white. */
export function Pills<T extends string>({ t, items, active, onSelect }: { t: SpTheme; items: PillItem<T>[]; active: T; onSelect: (id: T) => void }) {
  return (
    <View style={styles.pills} accessibilityRole="tablist">
      {items.map((item) => (
        <SpChip key={item.id} t={t} label={item.label} on={item.id === active} onPress={() => onSelect(item.id)} />
      ))}
    </View>
  )
}

/** Text tabs with an underline (variant A). */
export function TextTabs<T extends string>({ t, items, active, onSelect }: { t: SpTheme; items: PillItem<T>[]; active: T; onSelect: (id: T) => void }) {
  return (
    <View style={[styles.textTabs, { borderBottomColor: t.sand400 }]} accessibilityRole="tablist">
      {items.map((item) => {
        const on = item.id === active
        return (
          <SpPress
            key={item.id}
            onPress={() => onSelect(item.id)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: on }}
            style={styles.textTab}
          >
            <Text style={[styles.textTabLabel, { color: on ? t.ink900 : t.ink500, fontFamily: on ? amFonts.bold : amFonts.semi }]}>{item.label}</Text>
            <View style={[styles.textTabBar, { backgroundColor: on ? t.action : "transparent" }]} />
          </SpPress>
        )
      })}
    </View>
  )
}

/** A white row with a chevron, for the rows of variant C and the "About" line of B. */
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
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20 },
  textTabs: { flexDirection: "row", paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  textTab: { minHeight: 48, paddingHorizontal: 8, justifyContent: "center", alignItems: "center" },
  textTabLabel: { fontSize: 16, lineHeight: 22 },
  textTabBar: { position: "absolute", left: 8, right: 8, bottom: 0, height: 3, borderRadius: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, minHeight: 72, paddingVertical: 12 },
  rowIcon: { width: 44, height: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  rowSub: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
})
