import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { Press } from "@/components/songs-v2/Press"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { indicatorOffset, segmentCellWidth, segmentIndex, SONG_SEGMENTS, type SongSegmentId } from "@/lib/songsV2/segments"

const INSET = 4

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
  savedCount,
}: {
  theme: SongsTheme
  value: SongSegmentId
  onChange: (id: SongSegmentId) => void
  /** shown as "Mine · 3" */
  savedCount?: number
}) {
  const reduce = useReducedMotion()
  const [width, setWidth] = useState(0)
  const x = useSharedValue(0)
  const fade = useSharedValue(1)
  // the track has a 1px border: the cell and offsets live inside it, like the CSS padding box
  const inner = Math.max(0, width - 2)
  const cell = segmentCellWidth(inner, INSET)

  useEffect(() => {
    if (!width) return
    const target = indicatorOffset(segmentIndex(value), inner, INSET)
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
          x.value = indicatorOffset(segmentIndex(value), Math.max(0, w - 2), INSET)
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
            accessibilityLabel={segment.id === "mine" && savedCount !== undefined ? `Mine, ${savedCount} saved` : segment.label}
            accessibilityState={{ selected }}
            onPressIn={() => onChange(segment.id)}
            pressedScale={0.97}
            outerStyle={styles.outer}
            style={styles.cell}
          >
            <Text style={[styles.label, { color: selected ? "#FFFFFF" : theme.textBody }]}>
              {segment.id === "mine" && savedCount !== undefined ? `Mine · ${savedCount}` : segment.label}
            </Text>
          </Press>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 56,
    marginHorizontal: 10,
    borderRadius: 70,
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
    borderRadius: 70,
  },
  outer: { flex: 1 },
  cell: { height: 46, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: amFonts.semi, fontSize: 16, lineHeight: 20 },
})
