import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { Press } from "@/components/songs-v2/Press"
import { amSpring } from "@/constants/tokens/amMotion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amControl, amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { indicatorOffset, segmentCellWidth, segmentIndex, SONG_SEGMENTS, type SongSegmentId } from "@/lib/songsV2/segments"

const INSET = amSpace.s1

/**
 * `Catalog | Collections | Mine`. A segment answers touch-down, not release.
 * The orange indicator slides on a spring that starts from wherever it is on
 * screen, so a second tap mid-slide never jumps. With reduced motion it
 * cross-fades into place instead.
 */
export function Segmented({
  theme,
  value,
  onChange,
}: {
  theme: AmTheme
  value: SongSegmentId
  onChange: (id: SongSegmentId) => void
}) {
  const reduce = useReducedMotion()
  const [width, setWidth] = useState(0)
  const x = useSharedValue(0)
  const fade = useSharedValue(1)
  const cell = segmentCellWidth(width, INSET)

  useEffect(() => {
    if (!width) return
    const target = indicatorOffset(segmentIndex(value), width, INSET)
    if (reduce) {
      fade.value = 0
      x.value = target
      fade.value = withTiming(1, { duration: 150 })
    } else {
      x.value = withSpring(target, amSpring.default)
    }
  }, [value, width, reduce, x, fade])

  const indicator = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: x.value }] }))

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => {
        const w = event.nativeEvent.layout.width
        if (w !== width) {
          x.value = indicatorOffset(segmentIndex(value), w, INSET)
          setWidth(w)
        }
      }}
      style={[styles.track, { backgroundColor: theme.card, borderColor: theme.line }]}
    >
      <Animated.View style={[styles.indicator, { width: cell, backgroundColor: theme.brand }, indicator]} />
      {SONG_SEGMENTS.map((segment) => {
        const selected = segment.id === value
        return (
          <Press
            key={segment.id}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            onPressIn={() => onChange(segment.id)}
            pressedScale={0.97}
            outerStyle={styles.outer}
            style={styles.cell}
          >
            <Text style={[styles.label, { color: selected ? theme.onBrand : theme.textHeading }]}>{segment.label}</Text>
          </Press>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: amControl.pillHeight + INSET * 2,
    borderRadius: amRadius.pill,
    borderWidth: 1,
    padding: INSET,
    flexDirection: "row",
    alignItems: "stretch",
  },
  indicator: {
    position: "absolute",
    top: INSET,
    bottom: INSET,
    left: 0,
    borderRadius: amRadius.pill,
  },
  outer: { flex: 1 },
  cell: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
