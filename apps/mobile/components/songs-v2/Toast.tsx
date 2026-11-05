import { StyleSheet, Text } from "react-native"
import Animated, { FadeIn, FadeOut } from "react-native-reanimated"

import { Press } from "@/components/songs-v2/Press"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"

export type ToastAction = { label: string; onPress: () => void }

/**
 * Prototype `.toast`: ink-900 pill, 48px high, 24px from the sides, 172px above the bottom.
 * Rises 16px and fades in; fades out. Only opacity and transform. With an `action` ("Undo") the pill
 * takes touches on the action only; without one it lets every touch through.
 */
export function Toast({ message, theme, action }: { message: string | null; theme: SongsTheme; action?: ToastAction | null }) {
  if (!message) return null
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      pointerEvents={action ? "box-none" : "none"}
      accessibilityLiveRegion="polite"
      style={[styles.toast, { backgroundColor: theme.ink900 }]}
    >
      <Text style={[styles.text, { color: theme.onInk }, action && styles.textWithAction]} numberOfLines={1}>
        {message}
      </Text>
      {action ? (
        <Press accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} pressedScale={0.92} style={styles.action}>
          {/* gold on the dark pill (light theme), orange800 on the light pill (dark theme): both 5:1 or better */}
          <Text style={[styles.actionText, { color: theme.dark ? amColors.orange800 : amColors.gold300 }]}>{action.label}</Text>
        </Press>
      ) : null}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  text: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  textWithAction: { flex: 1, textAlign: "left" },
  action: { height: 44, paddingLeft: 16, justifyContent: "center", marginRight: -6 },
  actionText: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20 },
})
