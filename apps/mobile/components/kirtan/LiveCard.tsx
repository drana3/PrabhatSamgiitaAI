import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Bell, Radio, Users } from "lucide-react-native"
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated"

import { KPress } from "@/components/kirtan/KPress"
import { amColors, amPhotoChip } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { hostLine, liveBadge, liveStatus, type LiveItem } from "@/lib/kirtan/live"
import { moodForText, photoForSeed } from "@/lib/photos/catalog"

export const LIVE_CARD = { w: 220, h: 124 } as const

/** The small dot of the LIVE badge. It pulses through opacity only; with reduced motion it stays still. */
export function LiveDot({ color = amColors.orange500 }: { color?: string }) {
  const reduce = useReducedMotion()
  const o = useSharedValue(1)
  useEffect(() => {
    cancelAnimation(o)
    if (reduce) {
      o.value = 1
      return
    }
    o.value = withRepeat(withSequence(withTiming(0.25, { duration: 700, easing: Easing.inOut(Easing.ease) }), withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })), -1)
  }, [reduce, o])
  const style = useAnimatedStyle(() => ({ opacity: o.value }))
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />
}

/** `LIVE` (white on dark glass, with a pulsing bright-orange dot) or the start time on the same dark chip. Chips on photos are neutral only. */
export function LiveBadge({ item, now }: { item: LiveItem; now: number }) {
  const live = liveStatus(item, now) === "live"
  return (
    <View style={[styles.badge, live ? styles.badgeLive : styles.badgeSoon]}>
      {live ? <LiveDot /> : null}
      <Text style={[styles.badgeText, { color: amPhotoChip.glass.fg }]}>{liveBadge(item, now)}</Text>
    </View>
  )
}

export function LiveGlyph({ platform, size = 34 }: { platform: LiveItem["platform"]; size?: number }) {
  return platform === "zoom" ? <Users size={size} color="rgba(255,255,255,0.88)" strokeWidth={1.6} /> : <Radio size={size} color="rgba(255,255,255,0.88)" strokeWidth={1.6} />
}

/** Gradient ground of a broadcast: deep ember while it is on (so the orange badge stands out), forest green while it is still to come. */
export function liveTone(item: LiveItem, now: number): readonly [string, string] {
  return liveStatus(item, now) === "live" ? ["#6B2E0E", "#1F120A"] : [amColors.sage700, amColors.sage900]
}

/** The stock photo of a broadcast (stable per id) with a scrim, so the glyph and badges read on any picture. */
export function LivePhoto({ item, big }: { item: LiveItem; big?: boolean }) {
  const photo = photoForSeed(item.id, moodForText(item.title) ?? "live")
  return (
    <>
      <Image source={big ? photo.cover : photo.thumb} contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
      <LinearGradient pointerEvents="none" colors={["rgba(10,14,8,0.28)", "rgba(10,14,8,0.62)"]} style={StyleSheet.absoluteFill} />
    </>
  )
}

/**
 * A card of the "Live and long kiirtans" shelf: 220 x 124 (16:9), the badge, the title in capitals,
 * the host and platform. Upcoming ones carry a "Remind me" bell. It opens the live screen, never the player.
 */
export function LiveCard({
  item,
  now,
  theme,
  reminded,
  onOpen,
  onRemind,
}: {
  item: LiveItem
  now: number
  theme: SongsTheme
  reminded: boolean
  onOpen: (item: LiveItem) => void
  onRemind: (item: LiveItem) => void
}) {
  const live = liveStatus(item, now) === "live"
  const [from, to] = liveTone(item, now)
  return (
    <View style={styles.card}>
      <KPress
        accessibilityRole="button"
        accessibilityLabel={`${live ? "Live now" : `Starts ${liveBadge(item, now)}`}: ${item.title}, ${hostLine(item)}. Open`}
        onPress={() => onOpen(item)}
        pressedScale={0.97}
        style={styles.press}
      >
        <View style={styles.thumb}>
          <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LivePhoto item={item} />
          <View style={styles.glyph}>
            <LiveGlyph platform={item.platform} />
          </View>
          <View style={styles.badgeSlot}>
            <LiveBadge item={item} now={now} />
          </View>
        </View>
        <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.host, { color: theme.textBody }]} numberOfLines={1}>
          {hostLine(item)}
        </Text>
      </KPress>
      {live ? null : (
        <KPress
          accessibilityRole="button"
          accessibilityLabel={reminded ? `Remove the reminder for ${item.title}` : `Remind me about ${item.title}`}
          accessibilityState={{ selected: reminded }}
          onPress={() => onRemind(item)}
          pressedScale={0.88}
          outerStyle={styles.bellSlot}
          style={[styles.bell, reminded ? { backgroundColor: amColors.orange700 } : { backgroundColor: amPhotoChip.glass.bg }]}
        >
          <Bell size={17} color="#FFFFFF" fill={reminded ? "#FFFFFF" : "none"} strokeWidth={1.9} />
        </KPress>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { width: LIVE_CARD.w },
  press: { gap: 6 },
  thumb: { width: LIVE_CARD.w, height: LIVE_CARD.h, borderRadius: 22, overflow: "hidden" },
  glyph: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  badgeSlot: { position: "absolute", left: 10, top: 10 },
  badge: { height: 24, paddingHorizontal: 9, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  badgeLive: { backgroundColor: amPhotoChip.glass.bg },
  badgeSoon: { backgroundColor: amPhotoChip.glass.bg },
  badgeText: { fontFamily: amFonts.bold, fontSize: 12, lineHeight: 15, letterSpacing: 0.6, fontVariant: ["tabular-nums"] },
  dot: { width: 7, height: 7, borderRadius: 4 },
  bellSlot: { position: "absolute", right: 6, top: 6, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bell: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: amFonts.display, fontSize: 15, lineHeight: 18, letterSpacing: -0.2, textTransform: "uppercase", marginTop: 4 },
  host: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
})
