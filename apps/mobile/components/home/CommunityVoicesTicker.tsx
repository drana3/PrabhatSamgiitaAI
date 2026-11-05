import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Pressable, StyleSheet, Text, View } from "react-native"
import { useFocusEffect } from "@react-navigation/native"

import { colors } from "@/constants/colors"
import { spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import {
  FALLBACK_COMMUNITY_VOICES,
  clampVoiceIndex,
  isVoiceList,
  mergeLiveVoices,
  nextVoiceIndex,
  voicesFingerprint,
  type CommunityVoice,
} from "@/lib/communityVoices"
import {
  HOME_FEED_KEYS,
  HOME_FEED_TTL_MS,
  readHomeFeedCache,
  readHomeFeedCacheStale,
  writeHomeFeedCache,
} from "@/lib/homeFeedCache"

const DWELL_MS = 6500
const FADE_MS = 180

function applyIfChanged(
  next: CommunityVoice[],
  setVoices: (updater: (prev: CommunityVoice[]) => CommunityVoice[]) => void,
) {
  if (!isVoiceList(next)) return
  setVoices((prev) => (voicesFingerprint(prev) === voicesFingerprint(next) ? prev : next))
}

export function CommunityVoicesTicker() {
  const [voices, setVoices] = useState<CommunityVoice[]>(FALLBACK_COMMUNITY_VOICES)
  const [index, setIndex] = useState(0)
  const opacity = useRef(new Animated.Value(1)).current
  const indexRef = useRef(0)
  const voicesRef = useRef(voices)
  const fadingRef = useRef(false)

  voicesRef.current = voices

  const fingerprint = useMemo(() => voicesFingerprint(voices), [voices])

  useEffect(() => {
    fadingRef.current = false
    opacity.setValue(1)
    setIndex((current) => {
      const next = clampVoiceIndex(current, voicesRef.current.length)
      indexRef.current = next
      return next
    })
  }, [fingerprint, opacity])

  const showIndex = useCallback((nextIndex: number) => {
    indexRef.current = nextIndex
    setIndex(nextIndex)
  }, [])

  const advance = useCallback(() => {
    const count = voicesRef.current.length
    if (count < 2 || fadingRef.current) return
    fadingRef.current = true
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        fadingRef.current = false
        opacity.setValue(1)
        return
      }
      showIndex(nextVoiceIndex(indexRef.current, voicesRef.current.length))
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(() => {
        fadingRef.current = false
      })
    })
  }, [opacity, showIndex])

  useEffect(() => {
    const id = setInterval(() => advance(), DWELL_MS)
    return () => clearInterval(id)
  }, [advance])

  useFocusEffect(
    useCallback(() => {
      let active = true
      void (async () => {
        const fresh = await readHomeFeedCache<unknown>(
          HOME_FEED_KEYS.testimonials,
          HOME_FEED_TTL_MS.testimonials,
        )
        if (active && isVoiceList(fresh)) applyIfChanged(fresh, setVoices)
        else {
          const stale = await readHomeFeedCacheStale<unknown>(HOME_FEED_KEYS.testimonials)
          if (active && isVoiceList(stale)) applyIfChanged(stale, setVoices)
        }

        const rows = await api.fetchTestimonials(20)
        if (!active || !rows.length) return
        const next = mergeLiveVoices(rows)
        if (!isVoiceList(next)) return
        applyIfChanged(next, setVoices)
        void writeHomeFeedCache(HOME_FEED_KEYS.testimonials, next)
      })()
      return () => {
        active = false
      }
    }, []),
  )

  const voice = voices[index] ?? voices[0]
  if (!voice) return null

  return (
    <View style={styles.wrap} accessibilityLabel="Community voices">
      <View style={styles.heading}>
        <Text style={styles.label}>Community voices</Text>
        {voices.length > 1 ? (
          <Text style={styles.count}>
            {index + 1} of {voices.length}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={voices.length > 1 ? advance : undefined}
        accessibilityRole={voices.length > 1 ? "button" : "text"}
        accessibilityHint={voices.length > 1 ? "Shows the next community message" : undefined}
        accessibilityLabel={`${voice.name}. ${voice.quote}. ${index + 1} of ${voices.length}`}
        style={styles.viewport}
      >
        <Animated.View style={[styles.body, { opacity }]}>
          <Text style={styles.name} numberOfLines={2}>
            ✦ {voice.name}
          </Text>
          <Text style={styles.quote}>“{voice.quote}”</Text>
        </Animated.View>
        {voices.length > 1 ? (
          <View style={styles.dots} accessibilityElementsHidden>
            {voices.map((item, dotIndex) => (
              <View
                key={`${item.id}-${dotIndex}`}
                style={[styles.dot, dotIndex === index && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  count: {
    ...typography.caption,
    color: colors.textMuted,
  },
  viewport: {
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "center",
    gap: spacing.sm,
  },
  body: {
    justifyContent: "center",
    gap: 4,
  },
  name: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  quote: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  dots: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primaryDark,
  },
})
