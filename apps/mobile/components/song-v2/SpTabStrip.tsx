import { useEffect, useRef } from "react"
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

import type { SpTheme } from "@/constants/tokens/amSong"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { SECTION_LABEL, tabScrollTarget, type SectionId } from "@/lib/songPage/sections"

import { SpPress } from "./SpUi"

export const SP_TAB_HEIGHT = 52

function Tab({
  t,
  label,
  on,
  onPress,
  onLayout,
}: {
  t: SpTheme
  label: string
  on: boolean
  onPress: () => void
  onLayout: (event: LayoutChangeEvent) => void
}) {
  const reduce = useReducedMotion()
  const scale = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    scale.value = reduce ? withTiming(on ? 1 : 0, { duration: 120 }) : withSpring(on ? 1 : 0, amSpring.default)
  }, [on, reduce, scale])
  const underline = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.value }] }))
  return (
    <View onLayout={onLayout}>
      <SpPress
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        style={styles.tab}
      >
        <View style={styles.tabInner}>
          <Text style={[styles.tabText, { color: on ? t.ink900 : t.ink500 }]}>{label}</Text>
          <Animated.View style={[styles.underline, { backgroundColor: t.action }, underline]} />
        </View>
      </SpPress>
    </View>
  )
}

/**
 * `.spbar`: the section tabs. The page draws it as an overlay that follows its place in the content and pins
 * under the top bar (UI thread, see lib/songPage/stickyBar `stripTop`). It has an opaque page-colour ground
 * and a hairline below that fades in by `hairline` (0..1) once it is pinned.
 */
export function SpTabStrip({
  t,
  sections,
  active,
  hairline,
  onSelect,
}: {
  t: SpTheme
  sections: SectionId[]
  /** null: the reader is past the last tab (versions, credits ...) */
  active: SectionId | null
  hairline: SharedValue<number>
  onSelect: (id: SectionId) => void
}) {
  const reduce = useReducedMotion()
  const scroll = useRef<ScrollView>(null)
  const scrollX = useRef(0)
  const width = useRef(0)
  const xs = useRef<Partial<Record<SectionId, { x: number; w: number }>>>({})
  const lineStyle = useAnimatedStyle(() => ({ opacity: hairline.value }))

  useEffect(() => {
    const at = active ? xs.current[active] : null
    if (!at || !width.current) return
    const target = tabScrollTarget(at.x, at.w, width.current, scrollX.current)
    if (target !== scrollX.current) scroll.current?.scrollTo({ x: target, animated: !reduce })
  }, [active, reduce])

  return (
    <View style={[styles.bar, { backgroundColor: t.sand200 }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.line, { backgroundColor: t.sand400 }, lineStyle]}
      />
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        onLayout={(event) => {
          width.current = event.nativeEvent.layout.width
        }}
        onScroll={(event) => {
          scrollX.current = event.nativeEvent.contentOffset.x
        }}
        scrollEventThrottle={16}
        accessibilityRole="tablist"
      >
        {sections.map((id) => (
          <Tab
            key={id}
            t={t}
            label={SECTION_LABEL[id]}
            on={id === active}
            onPress={() => onSelect(id)}
            onLayout={(event) => {
              xs.current[id] = { x: event.nativeEvent.layout.x, w: event.nativeEvent.layout.width }
            }}
          />
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { height: SP_TAB_HEIGHT },
  line: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  row: { paddingHorizontal: 6 },
  tab: { height: SP_TAB_HEIGHT, paddingHorizontal: 10, justifyContent: "center" },
  tabInner: { height: SP_TAB_HEIGHT, justifyContent: "center" },
  tabText: { fontFamily: amFonts.bold, fontSize: 15.5, letterSpacing: -0.08 },
  underline: { position: "absolute", left: 0, right: 0, bottom: 6, height: 3, borderRadius: 9999 },
})
