import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"

import { DownloadMark } from "@/components/offline/DownloadMark"
import { amSpring } from "@/constants/tokens/amMotion"
import { useDownloadState } from "@/hooks/useDownloadState"
import { downloadLabel, type DownloadItem } from "@/lib/offline/downloadModel"

type Props = {
  item: DownloadItem | null
  size?: number
  /** the arrow and the number inside the ring */
  color?: string
  track?: string
  ring?: string
  /** true on a dark ground (the full player) */
  onDark?: boolean
  /** size of the touch area; at least 44 */
  hit?: number
  style?: StyleProp<ViewStyle>
}

/**
 * The download control of the whole app (like components/save/SaveButton.tsx is the save control):
 * arrow in a circle outline, progress ring with the percent, solid green disc with the downloaded glyph (never an orange check: that is Save). A tap starts, cancels (while the ring runs)
 * or removes (after a confirm that shows the size). Draws nothing for a song without playable
 * audio. Press feedback starts on touch-down; the action runs on release.
 */
export function DownloadButton({ item, size = 24, color, track, ring, onDark, hit = 44, style }: Props) {
  const { view, press } = useDownloadState(item)
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  if (!view.visible) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={downloadLabel(view)}
      accessibilityHint={item?.title}
      accessibilityState={{ busy: view.status === "downloading", selected: view.status === "done" }}
      onPressIn={() => {
        scale.value = withSpring(0.86, amSpring.default)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, amSpring.default)
      }}
      onPress={press}
      style={[styles.hit, { width: Math.max(44, hit), height: Math.max(44, hit), borderRadius: Math.max(44, hit) / 2 }, style]}
    >
      <Animated.View style={animated}>
        <DownloadMark status={view.status} progress={view.progress} size={size} color={color} track={track} ring={ring} onDark={onDark} />
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  hit: { alignItems: "center", justifyContent: "center" },
})
