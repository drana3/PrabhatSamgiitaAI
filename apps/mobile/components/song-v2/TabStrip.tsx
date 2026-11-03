import { useEffect, useRef, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { BlurView } from "expo-blur"
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import type { AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amGap, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize } from "@/constants/tokens/amTypography"
import { SECTION_LABEL, tabScrollTarget, underlineTransform, type SectionId } from "@/lib/songPage/sections"

export const TAB_HEIGHT = 52
const UNDERLINE = 3

/**
 * Pinned section strip (SCR-16, round 12). It sits in the page under the
 * buttons and the ScrollView pins it at the top while the reader scrolls; once
 * stuck, a frosted sand ground and a hairline fade in. The orange underline
 * moves by spring (transform only) and can be interrupted by the next tap.
 */
export function TabStrip({
  theme,
  sections,
  active,
  stuck,
  onSelect,
}: {
  theme: AmTheme
  sections: SectionId[]
  active: SectionId
  stuck: boolean
  onSelect: (id: SectionId) => void
}) {
  const reduce = useReducedMotion()
  const scrollRef = useRef<ScrollView>(null)
  const scrollX = useRef(0)
  const [viewport, setViewport] = useState(0)
  const [boxes, setBoxes] = useState<Partial<Record<SectionId, { x: number; w: number }>>>({})
  const stuckValue = useSharedValue(0)
  const translateX = useSharedValue(0)
  const scaleX = useSharedValue(0.0001)
  const placed = useRef(false)

  useEffect(() => {
    stuckValue.value = withTiming(stuck ? 1 : 0, { duration: 150 })
  }, [stuck, stuckValue])

  useEffect(() => {
    const box = boxes[active]
    if (!box) return
    const target = underlineTransform(box.x, box.w)
    if (!placed.current || reduce) {
      placed.current = true
      translateX.value = target.translateX
      scaleX.value = target.scaleX
    } else {
      // Start from the current on-screen value, so an interrupted move never jumps.
      translateX.value = withSpring(target.translateX, amSpring.default)
      scaleX.value = withSpring(target.scaleX, amSpring.default)
    }
    if (viewport > 0) {
      const to = tabScrollTarget(box.x, box.w, viewport, scrollX.current)
      if (to !== scrollX.current) scrollRef.current?.scrollTo({ x: to, animated: !reduce })
    }
  }, [active, boxes, viewport, reduce, translateX, scaleX])

  const groundStyle = useAnimatedStyle(() => ({ opacity: stuckValue.value }))
  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scaleX: scaleX.value }],
  }))

  const measure = (id: SectionId) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout
    setBoxes((prev) => (prev[id]?.x === x && prev[id]?.w === width ? prev : { ...prev, [id]: { x, w: width } }))
  }

  return (
    <View style={styles.root} accessibilityRole="tablist">
      <Animated.View style={[StyleSheet.absoluteFill, groundStyle]} pointerEvents="none">
        <BlurView intensity={28} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.wash, { backgroundColor: theme.page }]} />
        <View style={[styles.hairline, { backgroundColor: theme.line }]} />
      </Animated.View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => setViewport(event.nativeEvent.layout.width)}
        onScroll={(event) => {
          scrollX.current = event.nativeEvent.contentOffset.x
        }}
        scrollEventThrottle={32}
        contentContainerStyle={styles.row}
      >
        {sections.map((id) => {
          const isActive = id === active
          return (
            <Pressable
              key={id}
              onLayout={measure(id)}
              onPress={() => onSelect(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={SECTION_LABEL[id]}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.label,
                  {
                    color: isActive ? theme.textHeading : theme.textBody,
                    fontFamily: isActive ? amFonts.bold : amFonts.medium,
                  },
                ]}
              >
                {SECTION_LABEL[id]}
              </Text>
            </Pressable>
          )
        })}
        <Animated.View style={[styles.underline, { backgroundColor: theme.brand }, underlineStyle]} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { height: TAB_HEIGHT, marginHorizontal: -amGap.gutter },
  row: { paddingHorizontal: amGap.gutter, alignItems: "stretch" },
  tab: { height: TAB_HEIGHT, paddingHorizontal: amSpace.s3, justifyContent: "center" },
  label: { fontSize: amFontSize.body },
  wash: { opacity: 0.82 },
  hairline: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  underline: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 1,
    height: UNDERLINE,
    borderRadius: UNDERLINE,
  },
})
