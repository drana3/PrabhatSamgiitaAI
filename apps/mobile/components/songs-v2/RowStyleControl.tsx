import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"

import { overStyle } from "@/components/songs-v2/primitives"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { ROW_STYLE_OPTIONS } from "@/lib/songsV2/rowStyles"
import { useListViewStore } from "@/stores/listViewStore"

const TRACK = 44
const INSET = 4

/**
 * "Rows": a small three-way segmented control (Tracklist, Compact, Cards) for how song rows are drawn.
 * It sits in the list menu and in the Songs sort sheet; the choice is kept per device and applies to
 * every song list at once. The thumb slides on a no-overshoot spring from where it is on screen.
 * Selected = ink900 + onInk (neutral pill, 15:1), the others heading ink on the sheet.
 */
export function RowStyleControl({ theme }: { theme: SongsTheme }) {
  const value = useListViewStore((s) => s.rowStyle)
  const setValue = useListViewStore((s) => s.setRowStyle)
  const reduce = useReducedMotion()
  const index = Math.max(0, ROW_STYLE_OPTIONS.findIndex((o) => o.id === value))
  const [width, setWidth] = useState(0)
  const position = useSharedValue(index)
  const segment = useSharedValue(0)

  useEffect(() => {
    position.value = reduce ? index : withSpring(index, amSpring.default)
  }, [index, reduce, position])
  useEffect(() => {
    segment.value = Math.max(0, (width - INSET * 2) / ROW_STYLE_OPTIONS.length)
  }, [width, segment])

  const thumb = useAnimatedStyle(() => ({ width: segment.value, transform: [{ translateX: position.value * segment.value }] }))

  return (
    <View style={styles.wrap}>
      <Text style={[overStyle, { color: theme.accent }]}>Rows</Text>
      <View
        style={[styles.track, { backgroundColor: theme.inner, borderColor: theme.line }]}
        accessibilityRole="radiogroup"
        accessibilityLabel="Rows"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        <Animated.View pointerEvents="none" style={[styles.thumb, { backgroundColor: theme.ink900 }, thumb]} />
        {ROW_STYLE_OPTIONS.map((option) => {
          const on = option.id === value
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={option.label}
              onPress={() => setValue(option.id)}
              style={styles.segment}
            >
              <Text style={[styles.label, { color: on ? theme.onInk : theme.textHeading }]} numberOfLines={1}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 10 },
  track: { height: TRACK, borderRadius: TRACK / 2, borderWidth: 1, flexDirection: "row", padding: INSET - 1 },
  thumb: { position: "absolute", left: INSET - 1, top: INSET - 1, bottom: INSET - 1, borderRadius: (TRACK - INSET * 2) / 2 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
})
