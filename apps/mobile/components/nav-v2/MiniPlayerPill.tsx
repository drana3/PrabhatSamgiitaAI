import { useEffect } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { BlurView } from "expo-blur"
import { Pause, Play, SkipForward } from "lucide-react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PressScale } from "@/components/today/motion"
import { amReveal, amSpring } from "@/constants/tokens/amMotion"
import { amNav } from "@/constants/tokens/amNav"
import { amRadius, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { miniPillPalette, miniProgress, miniSubtitle, navV2Layout, isDarkTheme } from "@/lib/navV2"
import { songPlayback } from "@/lib/playback"
import { usePlayerStore } from "@/stores/playerStore"

/** Distance the pill travels when it appears or leaves. */
const SLIDE = 16

type Props = {
  /** from miniPlayerVisible(): route rule plus "a song is loaded" */
  visible: boolean
  /** tap on the title area: switch to the Player tab */
  onOpenPlayer: () => void
}

/**
 * Mini-player as a second pill above the tab pill (spec 4a design plan, SCR-12):
 * matte frosted and translucent, white at 38% with a 24px blur (forest at 42% in Dark).
 * It stays mounted and enters and leaves with opacity and a small rise on a spring that
 * starts from the current on-screen value, so a quick tab change never makes it jump.
 */
export function MiniPlayerPill({ visible, onOpenPlayer }: Props) {
  const theme = useAmTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReducedMotion()
  const palette = miniPillPalette(theme)
  const { miniBottom } = navV2Layout(insets.bottom)

  const currentSong = usePlayerStore((s) => s.currentSong)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const showPause = usePlayerStore((s) => (s.currentSong ? songPlayback(s, s.currentSong).showPause : false))
  const isBuffering = usePlayerStore((s) => (s.currentSong ? songPlayback(s, s.currentSong).isBuffering : false))
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const pause = usePlayerStore((s) => s.pause)
  const next = usePlayerStore((s) => s.next)

  const shown = useSharedValue(visible ? 1 : 0)
  useEffect(() => {
    const target = visible ? 1 : 0
    shown.value = reduce ? withTiming(target, { duration: amReveal.durationMs / 2 }) : withSpring(target, amSpring.default)
  }, [visible, reduce, shown])

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: reduce ? 0 : (1 - shown.value) * SLIDE }],
  }))

  if (!currentSong) return null

  const progress = miniProgress(position, duration)
  const blurTint = isDarkTheme(theme) ? "dark" : "light"

  return (
    <Animated.View
      pointerEvents={visible ? "box-none" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={[styles.slot, { bottom: miniBottom }, animated]}
    >
      <View style={[styles.pill, { backgroundColor: palette.background, borderColor: palette.edge }]}>
        <BlurView
          intensity={amNav.miniBlurIntensity}
          tint={blurTint}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open the player, ${currentSong.title}`}
          onPress={onOpenPlayer}
          style={styles.text}
        >
          <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
            {currentSong.title}
          </Text>
          <Text style={[styles.sub, { color: theme.textBody }]} numberOfLines={1}>
            {miniSubtitle({ number: currentSong.number, position, duration })}
          </Text>
        </Pressable>

        <PressScale
          accessibilityRole="button"
          accessibilityLabel={showPause ? `Pause ${currentSong.title}` : `Play ${currentSong.title}`}
          onPress={() => {
            if (showPause) pause()
            else togglePlay()
          }}
          style={[styles.control, { backgroundColor: theme.brand }]}
        >
          {isBuffering ? (
            <ActivityIndicator color={theme.onBrand} size="small" />
          ) : showPause ? (
            <Pause size={22} color={theme.onBrand} fill={theme.onBrand} />
          ) : (
            <Play size={22} color={theme.onBrand} fill={theme.onBrand} />
          )}
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Next song"
          onPress={() => next()}
          style={styles.control}
        >
          <SkipForward size={22} color={theme.textHeading} fill={theme.textHeading} />
        </PressScale>

        <View pointerEvents="none" style={styles.track}>
          <View
            style={[
              styles.bar,
              { backgroundColor: theme.brand, transform: [{ scaleX: Math.max(progress, 0.0001) }] },
            ]}
          />
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  slot: {
    position: "absolute",
    left: amNav.inset,
    right: amNav.inset,
  },
  pill: {
    height: amNav.miniHeight,
    borderRadius: amNav.radius,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 24,
    paddingRight: 8,
  },
  text: {
    flex: 1,
    minWidth: 0,
    minHeight: amTouchTarget,
    justifyContent: "center",
  },
  title: {
    fontFamily: amFonts.semi,
    fontSize: 16,
    lineHeight: 20,
  },
  sub: {
    fontFamily: amFonts.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  control: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  track: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: amNav.miniBarHeight,
  },
  bar: {
    flex: 1,
    // the hairline grows from the left edge
    transformOrigin: "left",
  },
})
