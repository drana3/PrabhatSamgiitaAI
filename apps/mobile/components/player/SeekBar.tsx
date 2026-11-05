import { useState } from "react"
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native"

import { colors } from "@/constants/colors"

type Props = {
  position: number
  duration: number
  onSeek: (seconds: number) => void
  accessibilityLabel?: string
}

/**
 * Custom seek bar — avoids @react-native-community/slider.
 *
 * Evidence: on the song page only the native Slider responded to touches while
 * sibling Pressables (pause, −10s, volume) did not. Home (no Slider) could pause.
 * Leaving the Listen tab unmounted the Slider and play worked again. Native
 * UISlider hit-testing was eating presses around the transport controls.
 */
export function SeekBar({
  position,
  duration,
  onSeek,
  accessibilityLabel = "Seek",
}: Props) {
  const [width, setWidth] = useState(0)
  const max = Math.max(1, duration)
  const ratio = Math.min(1, Math.max(0, position / max))

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
  }

  const seekFromX = (x: number) => {
    if (width <= 0) return
    const next = (Math.min(width, Math.max(0, x)) / width) * max
    onSeek(next)
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Drag to change playback position"
      onLayout={onLayout}
      // Press-in: ScrollView must not cancel the seek gesture.
      onPressIn={(event) => seekFromX(event.nativeEvent.locationX)}
      style={styles.hit}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        <View style={[styles.thumb, { left: `${ratio * 100}%` }]} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hit: {
    height: 36,
    justifyContent: "center",
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: "visible",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  thumb: {
    position: "absolute",
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
})
