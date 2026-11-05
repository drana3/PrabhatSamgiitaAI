import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

import { ShareCard } from "@/components/player-v2/ShareCard"
import { ShareTargetIcon } from "@/components/player-v2/ShareTargetIcon"
import { Sheet } from "@/components/player-v2/Sheet"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { isKiirtanNumber } from "@/lib/kirtan/track"
import { isDarkTheme } from "@/lib/navV2"
import { tintForSong } from "@/lib/playerV2/coverTint"
import { photoForSeed, type PhotoMood } from "@/lib/photos/catalog"
import { sentenceCaseLine, splitLines } from "@/lib/playerV2/lyricsSync"
import {
  buildSharePayload,
  pickWordsLines,
  shareBackgrounds,
  shareModes,
  sharePalette,
  SHARE_TARGETS,
  withWordsPayload,
  type ShareBackground,
  type SharePayload,
  type ShareMode,
  type ShareTargetId,
} from "@/lib/playerV2/playerShare"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayerV2Store } from "@/stores/playerV2Store"

type Props = {
  visible: boolean
  theme: AmTheme
  songNumber: number
  title: string
  performer: string
  /**
   * Called when a target is pressed. `payload` is set only when the sent text differs from the plain song
   * share (the Words card adds its lyric lines); a caller that ignores it sends the plain song share.
   */
  onShare: (target: ShareTargetId, payload?: SharePayload) => void
  onClose: () => void
  /** Optional. Kiirtan items have no Words card; inferred from the track number when not given. */
  kiirtan?: boolean
  /** Optional, for the Words card; falls back to the playing song when it is this one. */
  lyrics?: string | null
  lyricsDevanagari?: string | null
  /** Optional, Kiirtan items: the seed and mood that pick their stock photo (as in the player's cover), and their tone. */
  photoSeed?: string
  photoMood?: PhotoMood
  tint?: string
}

const GAP = 12
const SIDE_SCALE = 0.88
/** Everything in the sheet that is not the card, so the card can take the rest of the height. */
const CHROME = 362

export function ShareSheet({ visible, theme, songNumber, title, performer, onShare, onClose, kiirtan, lyrics, lyricsDevanagari, photoSeed, photoMood, tint: tintProp }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const reduce = useReducedMotion()
  const dark = isDarkTheme(theme)
  const isK = kiirtan ?? isKiirtanNumber(songNumber)

  // ---- lyrics for the Words card
  const script = usePlayerV2Store((s) => s.script)
  const playing = usePlayerStore((s) => s.currentSong)
  const same = playing != null && playing.number === songNumber
  const romanText = lyrics ?? (same ? playing.lyrics : null)
  const devaText = lyricsDevanagari ?? (same ? playing.lyricsDevanagari : null)
  const words = useMemo(() => {
    if (isK) return []
    const deva = splitLines(devaText)
    const picked = script === "devanagari" && deva.length > 0 ? deva : splitLines(romanText).map(sentenceCaseLine)
    return pickWordsLines(picked)
  }, [isK, devaText, romanText, script])

  const modes = shareModes({ kiirtan: isK, lyricLines: words.length })
  const [mode, setMode] = useState<ShareMode>("song")
  const activeMode: ShareMode = modes.some((m) => m.id === mode) ? mode : "song"

  // ---- grounds
  const seed = photoSeed ?? `${isK ? "k" : "ps"}-${songNumber}`
  // a Kiirtan has no cover picture of its own: its stock photo is the cover, and a second one the ground
  const kiirtanPhoto = useMemo(() => (isK ? photoForSeed(seed, photoMood) : null), [isK, seed, photoMood])
  const photo = useMemo(() => photoForSeed(isK ? `${seed}|ground` : seed, photoMood), [isK, seed, photoMood])
  const backgrounds = shareBackgrounds(photo != null)
  const [index, setIndex] = useState(0)
  const tint = tintProp ?? tintForSong(songNumber)

  // ---- carousel geometry
  const maxCardH = Math.min(780, windowHeight - 64) - CHROME
  const cardH = Math.max(240, Math.min(360, maxCardH))
  const cardW = Math.round((cardH * 9) / 16)
  const step = cardW + GAP
  const sidePad = Math.max(16, (windowWidth - cardW) / 2)
  const scrollRef = useRef<Animated.ScrollView>(null)
  const scrollX = useSharedValue(0)
  const lastIndex = useSharedValue(0)

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x
      const i = Math.max(0, Math.min(backgrounds.length - 1, Math.round(e.contentOffset.x / step)))
      if (i !== lastIndex.value) {
        lastIndex.value = i
        runOnJS(setIndex)(i)
      }
    },
  })

  const goTo = useCallback(
    (i: number) => {
      setIndex(i)
      lastIndex.value = i
      scrollRef.current?.scrollTo({ x: i * step, animated: !reduce })
    },
    [step, reduce, lastIndex],
  )

  // reopening the sheet starts on the first card
  useEffect(() => {
    if (visible) {
      setIndex(0)
      lastIndex.value = 0
      scrollX.value = 0
    }
  }, [visible, lastIndex, scrollX])

  const send = (target: ShareTargetId) => {
    const override = activeMode === "words" && words.length > 0 ? withWordsPayload(buildSharePayload({ number: songNumber, title, performer }), words) : undefined
    onShare(target, override)
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Share" theme={theme}>
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={onScroll}
        style={styles.carousel}
        contentContainerStyle={{ paddingHorizontal: sidePad, gap: GAP, paddingVertical: 8 }}
      >
        {backgrounds.map((b, i) => (
          <CarouselCard key={b.id} index={i} step={step} scrollX={scrollX}>
            <Animated.View key={activeMode} entering={FadeIn.duration(reduce ? 0 : 200)}>
              <ShareCard
                songNumber={songNumber}
                title={title}
                performer={performer}
                background={b.id}
                mode={activeMode}
                photo={photo?.cover ?? null}
                kiirtanCover={kiirtanPhoto?.cover ?? null}
                tint={tint}
                words={words}
                width={cardW}
              />
            </Animated.View>
          </CarouselCard>
        ))}
      </Animated.ScrollView>

      {modes.length > 1 ? (
        <View style={styles.toggleRow}>
          <SegmentedToggle theme={theme} dark={dark} value={activeMode} options={modes} onChange={setMode} />
        </View>
      ) : (
        <View style={styles.toggleRow}>
          <View style={[styles.onlyMode, { borderColor: theme.textHeading, backgroundColor: theme.textHeading }]}>
            <Text style={[styles.onlyModeText, { color: dark ? amColors.ink900 : amColors.white }]}>Song</Text>
          </View>
        </View>
      )}

      <View style={styles.dots} accessibilityRole="radiogroup" accessibilityLabel="Card colour">
        {backgrounds.map((b, i) => (
          <ColourDot
            key={b.id}
            id={b.id}
            label={b.label}
            selected={i === index}
            tint={tint}
            thumb={photo?.thumb ?? null}
            ring={dark ? amColors.white : amColors.ink800}
            onPress={() => goTo(i)}
          />
        ))}
      </View>

      <View style={[styles.divider, { backgroundColor: theme.line }]} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targets} style={styles.targetScroll}>
        {SHARE_TARGETS.map((t) => (
          <TouchButton
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onAction={() => send(t.id)}
            containerStyle={styles.targetHit}
            style={styles.target}
          >
            <ShareTargetIcon id={t.id} theme={theme} size={56} />
            <Text style={[styles.targetLabel, { color: theme.textBody }]} numberOfLines={2}>
              {t.label}
            </Text>
          </TouchButton>
        ))}
      </ScrollView>
    </Sheet>
  )
}

/** One card of the carousel: the centred card is full size, the neighbours shrink and dim as they leave. */
function CarouselCard({ index, step, scrollX, children }: { index: number; step: number; scrollX: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(scrollX.value - index * step) / step)
    return { transform: [{ scale: 1 - (1 - SIDE_SCALE) * d }], opacity: 1 - 0.3 * d }
  })
  return <Animated.View style={style}>{children}</Animated.View>
}

const TOGGLE_W = 104

/** Song | Words. Responds on touch-down; the pill follows with a spring from where it is on screen. */
function SegmentedToggle({
  theme,
  dark,
  value,
  options,
  onChange,
}: {
  theme: AmTheme
  dark: boolean
  value: ShareMode
  options: ReadonlyArray<{ id: ShareMode; label: string }>
  onChange: (m: ShareMode) => void
}) {
  const reduce = useReducedMotion()
  const selectedIndex = Math.max(0, options.findIndex((o) => o.id === value))
  const x = useSharedValue(selectedIndex * TOGGLE_W)
  useEffect(() => {
    const target = selectedIndex * TOGGLE_W
    x.value = reduce ? withTiming(target, { duration: 150 }) : withSpring(target, amSpring.default)
  }, [selectedIndex, reduce, x])
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const pillBg = theme.textHeading
  const onPill = dark ? amColors.ink900 : amColors.white
  return (
    <View style={[styles.toggle, { borderColor: theme.line, backgroundColor: theme.card }]} accessibilityRole="radiogroup" accessibilityLabel="Card content">
      <Animated.View style={[styles.togglePill, { backgroundColor: pillBg, width: TOGGLE_W }, pill]} />
      {options.map((o) => {
        const on = o.id === value
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            onPressIn={() => onChange(o.id)}
            // screen-reader activation sends only a press
            onPress={() => onChange(o.id)}
            style={[styles.toggleHit, { width: TOGGLE_W }]}
          >
            <Text style={[styles.toggleText, { color: on ? onPill : theme.textHeading }]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** A colour dot under the carousel; the selected one has a ring. The photo dot shows the photo. */
function ColourDot({
  id,
  label,
  selected,
  tint,
  thumb,
  ring,
  onPress,
}: {
  id: ShareBackground
  label: string
  selected: boolean
  tint: string
  thumb: number | null
  ring: string
  onPress: () => void
}) {
  const pal = sharePalette(id, tint)
  return (
    <TouchButton
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onAction={onPress}
      containerStyle={styles.dotHit}
      style={styles.dotHitInner}
    >
      <View style={[styles.dotRing, { borderColor: selected ? ring : "transparent" }]}>
        <View style={[styles.dot, { borderColor: selected ? amColors.white : "rgba(128,128,128,0.35)", borderWidth: selected ? 2 : 1 }]}>
          {id === "photo" && thumb != null ? (
            <Image source={thumb} contentFit="cover" style={StyleSheet.absoluteFill} />
          ) : (
            <LinearGradient colors={[pal.from, pal.to]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
          )}
        </View>
      </View>
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  carousel: { flexGrow: 0 },
  toggleRow: { alignItems: "center", paddingTop: 10 },
  toggle: { flexDirection: "row", borderRadius: 9999, borderWidth: 1, padding: 3, height: 44 },
  togglePill: { position: "absolute", top: 3, left: 3, bottom: 3, borderRadius: 9999 },
  toggleHit: { alignItems: "center", justifyContent: "center", borderRadius: 9999 },
  toggleText: { fontFamily: amFonts.semi, fontSize: 14 },
  onlyMode: { height: 44, minWidth: TOGGLE_W, paddingHorizontal: 22, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  onlyModeText: { fontFamily: amFonts.semi, fontSize: 14 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 2, paddingTop: 6, paddingBottom: 8 },
  dotHit: { width: 48, height: 48 },
  dotHitInner: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  dotRing: { width: 40, height: 40, borderRadius: 9999, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dot: { width: 30, height: 30, borderRadius: 9999, overflow: "hidden" },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 20, marginBottom: 14 },
  targetScroll: { flexGrow: 0 },
  targets: { paddingHorizontal: 16, gap: 4 },
  targetHit: { width: 84 },
  target: { alignItems: "center", gap: 8, paddingVertical: 4 },
  targetLabel: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 15, textAlign: "center" },
})
