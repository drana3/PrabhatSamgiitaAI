import { StyleSheet, Text } from "react-native"
import Animated, { FadeIn, FadeOut } from "react-native-reanimated"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"

/**
 * Prototype `.toast`: ink-900 pill, 48px high, 24px from the sides, 172px above the bottom.
 * Rises 16px and fades in; fades out. Only opacity and transform.
 */
export function Toast({ message, theme }: { message: string | null; theme: SongsTheme }) {
  if (!message) return null
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { backgroundColor: theme.ink900 }]}
    >
      <Text style={[styles.text, { color: theme.onInk }]} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 172,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  text: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
})
