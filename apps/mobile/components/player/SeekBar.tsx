import { useMemo, useRef, useState } from "react"
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from "react-native"

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
  const [scrub, setScrub] = useState<number | null>(null)
  const widthRef = useRef(0)
  const durationRef = useRef(duration)
  const onSeekRef = useRef(onSeek)
  const lastSeekAt = useRef(0)
  widthRef.current = width
  durationRef.current = duration
  onSeekRef.current = onSeek

  const applySeek = (x: number, force: boolean) => {
    const next = seekSecondsFromTouch(x, widthRef.current, durationRef.current)
    setScrub(next)
    const now = Date.now()
    if (force || now - lastSeekAt.current > 50) {
      lastSeekAt.current = now
      onSeekRef.current(next)
    }
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => applySeek(event.nativeEvent.locationX, true),
        onPanResponderMove: (event) => applySeek(event.nativeEvent.locationX, false),
        onPanResponderRelease: (event) => {
          applySeek(event.nativeEvent.locationX, true)
          setScrub(null)
        },
        onPanResponderTerminate: () => setScrub(null),
      }),
    [],
  )

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width
    widthRef.current = nextWidth
    setWidth(nextWidth)
  }

  const max = Math.max(1, duration)
  const shown = scrub ?? position
  const ratio = Math.min(1, Math.max(0, shown / max))

  return (
    <View
      {...pan.panHandlers}
      onLayout={onLayout}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Drag to change playback position"
      accessibilityValue={{
        min: 0,
        max,
        now: Math.round(shown),
      }}
      style={styles.hit}
    >
      <View style={styles.track} pointerEvents="none">
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        <View style={[styles.thumb, { left: `${ratio * 100}%` }]} />
      </View>
    </View>
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
