import { StyleSheet, Text } from "react-native"
import Animated, { FadeIn, FadeOut } from "react-native-reanimated"

import { amColors } from "@/constants/tokens/amColors"
import { amRadius, amSpace } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"

/** Short status line above the mini-player. Fades; no movement. */
export function Toast({ message, bottom }: { message: string | null; bottom: number }) {
  if (!message) return null
  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom }]}
    >
      <Text style={[amType.label, styles.text]}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: amColors.ink800,
    borderRadius: amRadius.pill,
    paddingHorizontal: amSpace.s4,
    paddingVertical: amSpace.s3,
    zIndex: 10,
  },
  text: { color: amColors.white, textTransform: "none" },
})
