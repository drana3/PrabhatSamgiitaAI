import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import { useFocusEffect } from "@react-navigation/native"

import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { communityVoices } from "@/data/homeContent"
import { api } from "@/lib/client"

type Voice = { id: string; quote: string; name: string }

const SPEED_PX_PER_SEC = 36

function mergeLiveVoices(
  rows: { quote_text: string; display_name: string; display_location?: string | null }[],
): Voice[] {
  const live: Voice[] = []
  const seen = new Set<string>()

  for (const [index, row] of rows.entries()) {
    const quote = row.quote_text.trim()
    if (quote.length < 8) continue
    const key = quote.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    live.push({
      id: `live-${index}-${key.slice(0, 24)}`,
      quote,
      name: row.display_location
        ? `${row.display_name} · ${row.display_location}`
        : row.display_name.trim() || "Community member",
    })
  }

  if (!live.length) return communityVoices

  const extras = communityVoices.filter((voice) => !seen.has(voice.quote.trim().toLowerCase()))
  return [...live, ...extras.slice(0, 2)]
}

export function CommunityVoicesTicker() {
  const [voices, setVoices] = useState<Voice[]>(communityVoices)
  const [trackWidth, setTrackWidth] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const offset = useRef(new Animated.Value(0)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  useFocusEffect(
    useCallback(() => {
      let active = true
      void api.fetchTestimonials(20).then((rows) => {
        if (!active || !rows.length) return
        setVoices(mergeLiveVoices(rows))
      })
      return () => {
        active = false
      }
    }, []),
  )

  const loop = useMemo(() => (voices.length ? [...voices, ...voices] : []), [voices])

  useEffect(() => {
    animRef.current?.stop()
    offset.setValue(0)
    if (trackWidth <= 0 || viewportWidth <= 0) return
    const distance = trackWidth / 2
    if (distance <= 8) return
    const duration = Math.max(8000, (distance / SPEED_PX_PER_SEC) * 1000)
    const run = () => {
      offset.setValue(0)
      animRef.current = Animated.timing(offset, {
        toValue: -distance,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
      animRef.current.start(({ finished }) => {
        if (finished) run()
      })
    }
    run()
    return () => {
      animRef.current?.stop()
    }
  }, [trackWidth, viewportWidth, offset, voices.length])

  if (!voices.length) return null

  return (
    <View style={styles.wrap} accessibilityLabel="Community voices">
      <Text style={styles.label}>Community voices</Text>
      <View
        style={styles.viewport}
        onLayout={(e: LayoutChangeEvent) => setViewportWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[styles.track, { transform: [{ translateX: offset }] }]}
          onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          {loop.map((voice, index) => (
            <View
              key={`${voice.id}-${index}`}
              style={styles.item}
              importantForAccessibility={index >= voices.length ? "no-hide-descendants" : "auto"}
            >
              <Text style={styles.star}>✦</Text>
              <Text style={styles.line}>
                <Text style={styles.name}>{voice.name}</Text>
                <Text style={styles.dash}> — </Text>
                <Text style={styles.quote}>“{voice.quote}”</Text>
              </Text>
              <Text style={styles.sep}> · </Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  viewport: {
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    justifyContent: "center",
  },
  track: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: spacing.lg,
    flexShrink: 0,
  },
  star: {
    ...typography.caption,
    color: colors.spiritualGold,
    marginRight: 6,
  },
  line: {
    ...typography.caption,
    color: colors.textPrimary,
    flexShrink: 0,
  },
  name: {
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  dash: {
    color: colors.textMuted,
  },
  quote: {
    color: colors.textPrimary,
  },
  sep: {
    ...typography.caption,
    color: colors.textMuted,
  },
})
