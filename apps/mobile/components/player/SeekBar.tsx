import { useState } from "react"
import { LayoutChangeEvent, Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native"

import { colors } from "@/constants/colors"
import { seekSecondsFromTouch } from "@/lib/seekBar"

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

  const seekFromTouch = (event: GestureResponderEvent) => {
    if (width <= 0) return
    onSeek(seekSecondsFromTouch(event.nativeEvent.locationX, width, max))
  }

  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Drag to change playback position"
      onLayout={onLayout}
      // Press-in + move: ScrollView must not cancel the seek gesture.
      onPressIn={seekFromTouch}
      onTouchMove={seekFromTouch}
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
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  track: {
    height: 5,
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
