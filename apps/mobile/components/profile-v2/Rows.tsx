import { useEffect, useRef, useState, type ReactNode } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { ChevronRight } from "lucide-react-native"

import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amGap, amRadius, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { APPEARANCE_LABELS, APPEARANCE_PREFERENCES, type AppearancePreference } from "@/lib/appearance"

type ThemeProps = { theme: AmTheme }

const ICON_BOX = 36
const ROW_HEIGHT = 56

/** Eyebrow above a group of rows. */
export function SectionLabel({ theme, children }: ThemeProps & { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={[amType.label, styles.sectionLabel, { color: theme.eyebrow }]}
    >
      {children}
    </Text>
  )
}

/** A card of rows separated by hairlines. */
export function Group({ theme, children }: ThemeProps & { children: ReactNode }) {
  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.line }]}>
      {children}
    </View>
  )
}

export function Hairline({ theme }: ThemeProps) {
  return <View style={[styles.hairline, { backgroundColor: theme.line }]} />
}

function IconBox({ theme, children, tone }: ThemeProps & { children: ReactNode; tone?: string }) {
  return (
    <View style={[styles.iconBox, { backgroundColor: tone ?? theme.inner }]}>{children}</View>
  )
}

type RowProps = ThemeProps & {
  icon: ReactNode
  label: string
  value?: string
  onPress?: () => void
  /** shows a muted, inert row (screen not built yet) */
  disabled?: boolean
  /** no chevron, e.g. for a row that acts in place */
  noChevron?: boolean
  danger?: boolean
  dangerColor?: string
}

/** A 56dp row: icon, label, optional value, chevron. Touch target is the whole row. */
export function Row({
  theme,
  icon,
  label,
  value,
  onPress,
  disabled,
  noChevron,
  danger,
  dangerColor,
}: RowProps) {
  const labelColor = danger && dangerColor ? dangerColor : theme.textHeading
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled || !onPress}
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.row, disabled ? styles.rowDisabled : null]}
    >
      <IconBox theme={theme}>{icon}</IconBox>
      <Text style={[styles.rowLabel, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={[styles.rowValue, { color: theme.textBody }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {!noChevron && !disabled ? <ChevronRight size={18} color={theme.textMuted} /> : null}
    </PressScale>
  )
}

/** Name, email and initial at the top of the sheet. */
export function AccountHeader({
  theme,
  initial,
  title,
  subtitle,
}: ThemeProps & { initial: string; title: string; subtitle: string | null }) {
  return (
    <View style={styles.account}>
      <View style={[styles.avatar, { backgroundColor: theme.brand }]}>
        <Text style={[styles.avatarText, { color: theme.onBrand }]}>{initial}</Text>
      </View>
      <View style={styles.accountText}>
        <Text style={[amType.lead, { color: theme.textHeading }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[amType.body, { color: theme.textBody }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

/**
 * Light / Dark / Auto. The thumb slides on a spring that starts from where it
 * is on screen, so tapping a second option mid-slide redirects it smoothly.
 * With reduced motion the thumb moves with a short cross-fade-length timing.
 */
export function AppearanceControl({
  theme,
  value,
  onChange,
}: ThemeProps & { value: AppearancePreference; onChange: (next: AppearancePreference) => void }) {
  const reduce = useReducedMotion()
  const [width, setWidth] = useState(0)
  const index = APPEARANCE_PREFERENCES.indexOf(value)
  const segment = width > 0 ? (width - 2 * SEG_PAD) / APPEARANCE_PREFERENCES.length : 0
  const x = useSharedValue(0)

  const placed = useRef(false)

  useEffect(() => {
    if (segment <= 0) return
    const target = index * segment
    if (!placed.current) {
      // first measurement: put the thumb in place without sliding in from the left
      placed.current = true
      x.value = target
      return
    }
    x.value = reduce ? withTiming(target, { duration: 150 }) : withSpring(target, amSpring.default)
  }, [index, segment, reduce, x])

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Appearance"
      onLayout={onLayout}
      style={[styles.segmented, { backgroundColor: theme.inner, borderColor: theme.line }]}
    >
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { width: segment, backgroundColor: theme.brand }, thumb]}
        />
      ) : null}
      {APPEARANCE_PREFERENCES.map((option) => {
        const selected = option === value
        return (
          <View key={option} style={styles.segment}>
            <PressScale
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={APPEARANCE_LABELS[option]}
              onPress={() => onChange(option)}
              pressedScale={0.96}
              style={styles.segmentInner}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  { color: selected ? theme.onBrand : theme.textHeading },
                ]}
              >
                {APPEARANCE_LABELS[option]}
              </Text>
            </PressScale>
          </View>
        )
      })}
    </View>
  )
}

const SEG_PAD = 4

const styles = StyleSheet.create({
  sectionLabel: { paddingHorizontal: amSpace.s2, marginBottom: -amSpace.s2 },
  group: {
    borderRadius: amRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  hairline: { height: StyleSheet.hairlineWidth, marginLeft: amGap.padCard + ICON_BOX + amSpace.s3 },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: amRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    minHeight: Math.max(ROW_HEIGHT, amTouchTarget),
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s3,
    paddingHorizontal: amGap.padCard,
    paddingVertical: amSpace.s2,
  },
  rowDisabled: { opacity: 0.45 },
  rowLabel: { flex: 1, fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
  rowValue: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, maxWidth: "45%" },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: amGap.text,
    paddingHorizontal: amSpace.s2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: amRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: amFonts.display, fontSize: 30, lineHeight: 34 },
  accountText: { flex: 1, gap: amSpace.s1 },
  segmented: {
    flexDirection: "row",
    height: amTouchTarget + 2 * SEG_PAD,
    borderRadius: amRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    padding: SEG_PAD,
    marginHorizontal: amGap.padCard,
    marginBottom: amSpace.s4,
  },
  thumb: {
    position: "absolute",
    top: SEG_PAD,
    left: SEG_PAD,
    bottom: SEG_PAD,
    borderRadius: amRadius.full,
  },
  segment: { flex: 1 },
  segmentInner: {
    height: amTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 22 },
})
