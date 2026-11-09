import { useEffect, useMemo, useReducer, useRef, type ReactNode } from "react"
import { AppState, StyleSheet, Text, View, type DimensionValue } from "react-native"
import { Image } from "expo-image"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import {
  THUMBNAIL_ASPECT,
  createSourceMemory,
  isStubPicture,
  providerMark,
  rememberBad,
  rememberGood,
  retryDelay,
  sourcesToTry,
  thumbNext,
  thumbStart,
  thumbnailSources,
  type ThumbnailSubject,
} from "@/lib/recordingVideos/thumbnail"

/** What the app remembers between screens in one run: a picture that showed is trusted, one that failed is skipped for a minute. */
const memory = createSourceMemory()

/**
 * The picture of a video link (docs/kiirtan-video.md, "Previews"): one fixed 16:9 box, so nothing jumps whether the picture
 * is there, late or never. Under the picture there is always a placeholder (the site's name and the title on a dark
 * ground); the picture fades in over it (opacity only, instant with reduced motion). Sources are tried in order
 * (the server's kept picture, then the one built from the id); a source that fails or turns out to be the site's tiny
 * stand-in moves on to the next, and when all fail the loader waits and tries again (1.5 s, 4 s, 9 s), when the app
 * comes back to the front, and on a tap on "Try again". expo-image keeps the files on disk, so a seen picture shows offline.
 *
 * `children` are drawn over the picture (the play disc, a title, a badge). The box is NOT pressable itself.
 */
export function VideoThumb({
  video,
  title,
  width = "100%",
  radius = 16,
  scrim = false,
  showTitle = true,
  compact = false,
  fill = false,
  background,
  placeholder,
  testID,
  children,
}: {
  video: ThumbnailSubject
  title?: string | null
  width?: DimensionValue
  radius?: number
  /** a soft dark band over the lower part so white text on top stays readable */
  scrim?: boolean
  /** draw the title in the placeholder (off when the caller draws its own text over the box) */
  showTitle?: boolean
  /** a small box (a list row): the placeholder carries the site mark only */
  compact?: boolean
  /** fill the parent's box (its own fixed height) instead of keeping 16:9 */
  fill?: boolean
  /** the ground behind the picture and under the placeholder (dark by default) */
  background?: string
  /** a picture of your own for the placeholder (the broadcast tile's "on air" glyph), instead of the site's name and the title */
  placeholder?: ReactNode
  testID?: string
  children?: ReactNode
}) {
  const tr = useT()
  const reduce = useReducedMotion()
  const key = `${video.provider}|${video.url}|${video.thumbnailUrl ?? ""}`
  const sources = useMemo(() => sourcesToTry(memory, thumbnailSources(video), Date.now()), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const [state, dispatch] = useReducer((s: typeof thumbStart, e: Parameters<typeof thumbNext>[1]) => thumbNext(s, e, sources.length), thumbStart)
  const lastKey = useRef(key)
  // another video in the same box: start over
  useEffect(() => {
    if (lastKey.current !== key) {
      lastKey.current = key
      dispatch("again")
    }
  }, [key])
  // the wait before the next automatic try
  useEffect(() => {
    if (state.phase !== "waiting") return
    const wait = retryDelay(state.attempt)
    if (wait === null) return
    const timer = setTimeout(() => dispatch("retry"), wait)
    return () => clearTimeout(timer)
  }, [state.phase, state.attempt])
  // the app came back to the front: give a failed picture one more go
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") dispatch("retry")
    })
    return () => sub.remove()
  }, [])

  const src = sources[state.index] ?? null
  const showImage = Boolean(src) && (state.phase === "loading" || state.phase === "ready")
  const none = sources.length === 0 // nothing to load (a Vimeo link the server has no picture for): the placeholder is the picture
  const waiting = state.phase === "loading" && !none

  // a calm breathing of the placeholder while the picture is on its way (opacity only; none with reduced motion)
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (reduce || !waiting) {
      pulse.value = 1
      return
    }
    pulse.value = withRepeat(withTiming(0.72, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true)
  }, [reduce, waiting, pulse])
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  const mark = providerMark(video.provider)
  return (
    <View style={[styles.box, fill ? styles.fill : null, { width, borderRadius: radius }, background ? { backgroundColor: background } : null]} testID={testID}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.placeholderBox, background ? { backgroundColor: background } : null, pulseStyle]} testID={testID ? `${testID}-placeholder` : undefined}>
        {placeholder ?? (
          <>
            <SpIcon name="play" size={compact ? 16 : 22} color={amColors.sand300} />
            <Text style={styles.mark} numberOfLines={1}>
              {mark}
            </Text>
            {!compact && showTitle && title ? (
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
            ) : null}
          </>
        )}
      </Animated.View>
      {showImage && src ? (
        <Image
          key={`${src}#${state.attempt}`}
          source={{ uri: src }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={reduce ? 0 : 200}
          accessibilityIgnoresInvertColors
          accessibilityLabel=""
          onLoad={(event) => {
            if (isStubPicture(event?.source?.width, event?.source?.height)) {
              rememberBad(memory, src, Date.now())
              dispatch("failed")
            } else {
              rememberGood(memory, src)
              dispatch("loaded")
            }
          }}
          onError={() => {
            rememberBad(memory, src, Date.now())
            dispatch("failed")
          }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {scrim ? <View pointerEvents="none" style={styles.scrim} /> : null}
      {children}
      {state.phase === "failed" && !none ? (
        <SpPress
          onPress={() => dispatch("again")}
          accessibilityLabel={tr("recVideos.thumb.retry")}
          pressedScale={0.94}
          hitSlop={8}
          testID={testID ? `${testID}-retry` : undefined}
          style={styles.retry}
        >
          <Text style={styles.retryText}>{tr("recVideos.thumb.retry")}</Text>
        </SpPress>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  box: { aspectRatio: THUMBNAIL_ASPECT, overflow: "hidden", backgroundColor: amColors.ink900 },
  fill: { aspectRatio: undefined, height: "100%" },
  placeholderBox: { alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, backgroundColor: amColors.ink900 },
  mark: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, color: amColors.sand300, letterSpacing: 0.2 },
  title: { fontFamily: amFonts.bold, fontSize: 14, lineHeight: 20, color: amColors.sand100, textAlign: "center" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(20,14,10,0.28)" },
  retry: { position: "absolute", top: 8, right: 8, minHeight: 32, paddingHorizontal: 12, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,14,10,0.62)" },
  retryText: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18, color: amColors.sand100 },
})
