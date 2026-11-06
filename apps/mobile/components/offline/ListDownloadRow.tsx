import { useEffect, useRef } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"

import { DownloadMark } from "@/components/offline/DownloadMark"
import { Press } from "@/components/songs-v2/Press"
import { overStyle } from "@/components/songs-v2/primitives"
import { amColors } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useListDownload } from "@/hooks/useListDownload"
import { listDownloadLabel, listDownloadSub, listDownloadTitle } from "@/lib/offline/downloadModel"
import { useLanguage } from "@/lib/i18n"

const TRACK_W = 52
const TRACK_H = 32
const THUMB = 26
const REDUCED_MS = 120

/** The switch: a white thumb on an orange700 track when on. Only the thumb's transform moves. */
export function Switch({ on, theme }: { on: boolean; theme: SongsTheme }) {
  const reduce = useReducedMotion()
  const x = useSharedValue(on ? 1 : 0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    x.value = reduce ? withTiming(on ? 1 : 0, { duration: REDUCED_MS }) : withSpring(on ? 1 : 0, amSpring.default)
  }, [on, reduce, x])
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (TRACK_W - THUMB - 6) }] }))
  const trackOn = useAnimatedStyle(() => ({ opacity: x.value }))
  return (
    <View aria-hidden style={[styles.track, { backgroundColor: theme.inner, borderColor: theme.line }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.brand, borderRadius: TRACK_H / 2 }, trackOn]} />
      <Animated.View style={[styles.thumb, { backgroundColor: on ? amColors.white : theme.textBody }, thumb]} />
    </View>
  )
}

/**
 * The Download toggle of a list: a playlist, Mine / Saved, a collection. "Download", then
 * "Downloading 3 of 12", then "Downloaded". Songs without playable audio are left out of the count
 * and the row is not drawn when nothing in the list can be downloaded. Turning it off removes the
 * downloaded files after a confirm that shows the size; while running, a tap stops the rest.
 */
export function ListDownloadRow({
  theme,
  numbers,
  name,
  style,
}: {
  theme: SongsTheme
  numbers: readonly number[]
  name: string
  style?: StyleProp<ViewStyle>
}) {
  useLanguage() // re-render when the language changes: the labels come from lib/offline/downloadModel
  const { view, press } = useListDownload(numbers, name)
  if (!view.visible) return null
  const on = view.status !== "idle"
  return (
    <Press
      accessibilityRole="switch"
      accessibilityLabel={listDownloadLabel(view)}
      accessibilityState={{ checked: on, busy: view.status === "downloading" }}
      onPress={press}
      pressedScale={0.98}
      style={[styles.row, { backgroundColor: theme.card, borderColor: theme.line }, style]}
    >
      <View style={styles.mark}>
        <DownloadMark status={view.status} progress={view.progress} size={26} color={theme.textHeading} />
      </View>
      <View style={styles.text}>
        <Text style={[overStyle, { color: theme.accent }]} numberOfLines={1}>
          {listDownloadSub(view)}
        </Text>
        <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
          {listDownloadTitle(view)}
        </Text>
      </View>
      <Switch on={on} theme={theme} />
    </Press>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  mark: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontFamily: amFonts.semi, fontSize: 19, lineHeight: 22, letterSpacing: -0.19 },
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, borderWidth: 1, justifyContent: "center", paddingHorizontal: 2, overflow: "hidden" },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
})
