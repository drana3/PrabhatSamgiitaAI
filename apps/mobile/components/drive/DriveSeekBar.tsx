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

/** High-contrast seek bar for Drive Mode (dark scenic card). */
export function DriveSeekBar({
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
    height: 44,
    justifyContent: "center",
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "visible",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primaryLight,
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    marginLeft: -9,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
})
