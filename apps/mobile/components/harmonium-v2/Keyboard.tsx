import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { StyleSheet, Text, View, type GestureResponderEvent } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import type { HarmoniumKeyboardKey } from "@prabhat/core"

import { amColors, type AmTheme } from "@/constants/tokens/amColors"
import { amSpring } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import { hitTestHarmoniumKey } from "@/lib/harmoniumHitTest"
import { startWesternNote, stopActiveHarmoniumNote, warmHarmoniumCaptureAudio } from "@/lib/harmoniumPlayback"
import { createMultiTouchKeyTracker } from "@/lib/multiTouchKeyTracker"

const WHITE_HEIGHT = 168
const BLACK_HEIGHT = 104
const BLACK_WIDTH_RATIO = 0.62

type Props = {
  theme: AmTheme
  /** keys of the window to draw, with geometry re-based (see sliceKeyboard) */
  keys: HarmoniumKeyboardKey[]
  width: number
  /** indexes in `keys` lit by a chord, drawn orange */
  lit?: ReadonlySet<number>
  /** play the reed sample when a key is touched */
  sound?: boolean
  /** Sa the keyboard is tuned to, used to warm the sound pool */
  tonic?: string
  onKeyDown?: (key: HarmoniumKeyboardKey, index: number) => void
  onKeyUp?: (key: HarmoniumKeyboardKey, index: number) => void
}

/**
 * One octave (or a window of the 25-key layout) of white and black keys with the
 * swara printed on every key and Sa in orange. Uppercase swara = shuddha,
 * lowercase = komal.
 *
 * Touches are read on touch-down, one id per finger, so chords of three or more
 * keys sound together. The key changes on touch-down, before the sound loads. The
 * press fill is a spring on opacity that starts from where it is.
 */
export function HarmoniumKeyboard({ theme, keys, width, lit, sound = true, tonic, onKeyDown, onKeyUp }: Props) {
  const whiteKeys = useMemo(() => keys.filter((key) => !key.isBlack), [keys])
  const blackKeys = useMemo(() => keys.filter((key) => key.isBlack), [keys])
  const whiteWidth = width / Math.max(1, whiteKeys.length)
  const blackWidth = whiteWidth * BLACK_WIDTH_RATIO
  const layout = useMemo(
    () => ({ width, height: WHITE_HEIGHT, blackKeyWidth: blackWidth, blackKeyHeight: BLACK_HEIGHT }),
    [width, blackWidth],
  )

  const [pressed, setPressed] = useState<ReadonlySet<number>>(new Set())
  const tracker = useRef(createMultiTouchKeyTracker())
  const stops = useRef(new Map<number, () => void>())
  const keysRef = useRef(keys)
  keysRef.current = keys

  useEffect(() => {
    if (!sound || !tonic) return
    void warmHarmoniumCaptureAudio(tonic)
  }, [sound, tonic])

  useEffect(() => {
    const held = stops.current
    const touches = tracker.current
    return () => {
      held.forEach((stop) => stop())
      held.clear()
      touches.reset()
      void stopActiveHarmoniumNote()
    }
  }, [])

  // a different window or key means different notes: let go of everything
  useEffect(() => {
    stops.current.forEach((stop) => stop())
    stops.current.clear()
    tracker.current.reset()
    setPressed(new Set())
  }, [keys])

  const press = useCallback(
    (index: number) => {
      const key = keysRef.current[index]
      if (!key || stops.current.has(index)) return
      stops.current.set(index, () => undefined)
      setPressed((current) => new Set(current).add(index))
      onKeyDown?.(key, index)
      if (!sound) return
      void startWesternNote(key.western)
        .then((stop) => {
          if (stops.current.has(index)) stops.current.set(index, stop)
          else stop()
        })
        .catch(() => undefined)
    },
    [onKeyDown, sound],
  )

  const release = useCallback(
    (index: number) => {
      const stop = stops.current.get(index)
      if (!stop) return
      stop()
      stops.current.delete(index)
      setPressed((current) => {
        const next = new Set(current)
        next.delete(index)
        return next
      })
      const key = keysRef.current[index]
      if (key) onKeyUp?.(key, index)
    },
    [onKeyUp],
  )

  const handleTouches = (event: GestureResponderEvent, phase: "start" | "move" | "end") => {
    const touches = event.nativeEvent.changedTouches
    for (let i = 0; i < touches.length; i += 1) {
      const touch = touches[i]
      if (!touch) continue
      const id = Number(touch.identifier)
      if (phase === "end") {
        const result = tracker.current.touchUp(id)
        if (result?.lastOnKey) release(result.keyIndex)
        continue
      }
      const index = hitTestHarmoniumKey(touch.locationX, touch.locationY, layout, keys, whiteKeys, blackKeys)
      if (index < 0) continue
      if (phase === "start") {
        if (tracker.current.touchDown(id, index)) press(index)
        continue
      }
      const moved = tracker.current.touchMove(id, index)
      if (!moved) continue
      if (moved.releasedLast) release(moved.releasedKey)
      if (moved.pressedFirst) press(moved.pressedKey)
    }
  }

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel="Harmonium keyboard"
      style={{ width, height: WHITE_HEIGHT }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onTouchStart={(event) => handleTouches(event, "start")}
      onTouchMove={(event) => handleTouches(event, "move")}
      onTouchEnd={(event) => handleTouches(event, "end")}
      onTouchCancel={(event) => handleTouches(event, "end")}
    >
      <View style={styles.whiteRow} pointerEvents="none">
        {whiteKeys.map((key) => {
          const index = keys.indexOf(key)
          return (
            <KeyFace
              key={`${key.western}-${index}`}
              theme={theme}
              keyData={key}
              black={false}
              pressed={pressed.has(index)}
              lit={Boolean(lit?.has(index))}
              style={{ width: whiteWidth, height: WHITE_HEIGHT }}
            />
          )
        })}
      </View>
      {blackKeys.map((key) => {
        const index = keys.indexOf(key)
        const left = (key.blackLeftPercent / 100) * width - blackWidth / 2
        return (
          <KeyFace
            key={`${key.western}-${index}`}
            theme={theme}
            keyData={key}
            black
            pressed={pressed.has(index)}
            lit={Boolean(lit?.has(index))}
            style={{ position: "absolute", left, top: 0, width: blackWidth, height: BLACK_HEIGHT }}
            pointerEvents="none"
          />
        )
      })}
    </View>
  )
}

type KeyFaceProps = {
  theme: AmTheme
  keyData: HarmoniumKeyboardKey
  black: boolean
  pressed: boolean
  lit: boolean
  style: object
  pointerEvents?: "none"
}

/** One key. The pressed and lit fills are overlays whose opacity springs. */
const KeyFace = memo(function KeyFace({ theme, keyData, black, pressed, lit, style, pointerEvents }: KeyFaceProps) {
  const reduce = useReducedMotion()
  const press = useSharedValue(0)
  const glow = useSharedValue(lit ? 1 : 0)

  useEffect(() => {
    // pressed is immediate on touch-down; letting go eases out
    press.value = pressed ? withTiming(1, { duration: 0 }) : reduce ? withTiming(0, { duration: 120 }) : withSpring(0, amSpring.default)
  }, [pressed, reduce, press])

  useEffect(() => {
    glow.value = reduce ? withTiming(lit ? 1 : 0, { duration: 150 }) : withSpring(lit ? 1 : 0, amSpring.default)
  }, [lit, reduce, glow])

  const pressStyle = useAnimatedStyle(() => ({ opacity: press.value }))
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  const active = pressed || lit
  const base = black ? amColors.ink800 : amColors.white
  const textColor = active ? amColors.white : black ? amColors.white : theme.textHeading
  const isSa = keyData.isSa

  return (
    <View
      pointerEvents={pointerEvents}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${keyData.latin}, ${keyData.keyLabel}`}
      accessibilityState={{ selected: active }}
      style={[
        black ? styles.black : styles.white,
        { backgroundColor: base, borderColor: black ? amColors.ink900 : theme.line },
        style,
      ]}
    >
      <Animated.View style={[styles.overlay, { backgroundColor: amColors.orange500 }, glowStyle]} pointerEvents="none" />
      <Animated.View style={[styles.overlay, { backgroundColor: amColors.sage700 }, pressStyle]} pointerEvents="none" />
      <View style={styles.labels} pointerEvents="none">
        <Text
          style={[
            black ? styles.swaraBlack : styles.swara,
            { color: isSa && !active ? (black ? amColors.gold300 : amColors.orange700) : textColor },
          ]}
          numberOfLines={1}
        >
          {keyData.latin}
        </Text>
        <Text style={[styles.note, { color: active ? amColors.white : black ? "rgba(255,255,255,0.7)" : theme.textBody }]}>
          {keyData.keyLabel}
        </Text>
      </View>
      {isSa ? <View style={[styles.saDot, { backgroundColor: active ? amColors.white : amColors.orange500 }]} /> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  whiteRow: { flexDirection: "row", height: WHITE_HEIGHT },
  white: {
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  black: {
    borderWidth: 1,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 2,
  },
  overlay: { ...StyleSheet.absoluteFillObject },
  labels: { alignItems: "center", paddingBottom: 10, gap: 2 },
  swara: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16 },
  swaraBlack: { fontFamily: amFonts.bold, fontSize: 11, lineHeight: 14 },
  note: { fontFamily: amFonts.medium, fontSize: 11, lineHeight: 14 },
  saDot: { position: "absolute", top: 10, width: 8, height: 8, borderRadius: 4 },
})
