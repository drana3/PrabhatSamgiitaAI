import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native"

import { SP_STATUS_BAR, type SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { startWesternNote, stopActiveHarmoniumNote, warmHarmoniumCaptureAudio } from "@/lib/harmoniumPlayback"
import { createMultiTouchKeyTracker } from "@/lib/multiTouchKeyTracker"
import {
  hitSpKey,
  whiteRects,
  KBD_BLACK_HEIGHT,
  KBD_BLACK_WIDTH_PCT,
  KBD_HEIGHT,
  type SpKey,
} from "@/lib/songPage/spKeyboard"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { over } from "./spType"
import { SpRound } from "./SpUi"

/** `.search` overlay: sand page, 54 under the status bar, a header row (`.ovl-h`) and a scrolling body (`.ovl-b`). */
export function SpOverlayPage({
  t,
  title,
  onBack,
  children,
}: {
  t: SpTheme
  title: string
  onBack: () => void
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.page, { backgroundColor: t.sand200, paddingTop: insets.top || SP_STATUS_BAR }]}>
      <View style={styles.head}>
        <SpRound t={t} tone="white" icon="back" label="Back" onPress={onBack} />
        <Text style={over(t)} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  )
}

/** `.readout`: a big caps word and a quiet line beside it, on one baseline. */
export function SpReadout({
  t,
  big,
  small,
  live,
  keepCase,
}: {
  t: SpTheme
  big: string
  small: string
  live?: boolean
  /** chord names keep their case (`Am`), swaras are caps */
  keepCase?: boolean
}) {
  return (
    <View style={styles.readout} accessibilityLiveRegion={live ? "polite" : undefined}>
      <Text style={[styles.readoutB, { color: t.ink800 }, keepCase && { textTransform: "none" }]}>{big}</Text>
      <Text style={[styles.readoutS, { color: t.ink500 }]}>{small}</Text>
    </View>
  )
}

/** `.chips` row: chord letters, 44 high, scrolling sideways. */
export function SpChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {children}
    </ScrollView>
  )
}

/**
 * `.kbd`: eight white keys and five black keys on a dark bed, a swara and a note printed on each key, Sa in
 * orange. With `interactive` a key sounds on touch-down, many fingers at once on a phone (a chord is three
 * keys), and the last key touched stays orange. Without it the orange keys are the chord that is explained.
 */
export function SpKeyboard({
  t,
  whites,
  blacks,
  lit,
  selected,
  onPressKey,
  interactive = false,
  tonic,
}: {
  t: SpTheme
  whites: SpKey[]
  blacks: SpKey[]
  /** keys shown orange as a chord */
  lit?: (key: SpKey) => boolean
  /** the key the readout shows, orange until another is pressed */
  selected?: string | null
  onPressKey?: (key: SpKey) => void
  interactive?: boolean
  /** Sa name for warming the sound pool */
  tonic?: string
}) {
  const { width: windowWidth } = useWindowDimensions()
  const [width, setWidth] = useState(Math.max(0, windowWidth - 20))
  const tracker = useRef(createMultiTouchKeyTracker())
  const stops = useRef(new Map<string, () => void>())
  const saFlags = useMemo(() => whites.map((key) => key.isSa), [whites])
  const rects = useMemo(() => whiteRects(width, saFlags), [width, saFlags])
  const byId = useMemo(() => new Map([...whites, ...blacks].map((key) => [key.id, key])), [whites, blacks])
  const byIdRef = useRef(byId)
  byIdRef.current = byId
  const pressRef = useRef(onPressKey)
  pressRef.current = onPressKey

  useEffect(() => {
    if (!interactive || !tonic) return
    void warmHarmoniumCaptureAudio(tonic).catch(() => undefined)
  }, [interactive, tonic])

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

  const press = useCallback((id: string) => {
    const key = byIdRef.current.get(id)
    if (!key || stops.current.has(id)) return
    stops.current.set(id, () => undefined)
    pressRef.current?.(key)
    void startWesternNote(key.western)
      .then((stop) => {
        if (stops.current.has(id)) stops.current.set(id, stop)
        else stop()
      })
      .catch(() => undefined)
  }, [])

  const release = useCallback((id: string) => {
    const stop = stops.current.get(id)
    if (!stop) return
    stop()
    stops.current.delete(id)
  }, [])

  const onTouches = (event: GestureResponderEvent, phase: "start" | "move" | "end") => {
    const touches = event.nativeEvent.changedTouches
    for (let i = 0; i < touches.length; i += 1) {
      const touch = touches[i]
      if (!touch) continue
      const touchId = Number(touch.identifier)
      if (phase === "end") {
        const result = tracker.current.touchUp(touchId)
        if (result?.lastOnKey) release(idOf(result.keyIndex))
        continue
      }
      const id = hitSpKey(touch.locationX, touch.locationY, width, saFlags)
      if (!id) continue
      const index = indexOf(id)
      if (phase === "start") {
        if (tracker.current.touchDown(touchId, index)) press(id)
        continue
      }
      const moved = tracker.current.touchMove(touchId, index)
      if (!moved) continue
      if (moved.releasedLast) release(idOf(moved.releasedKey))
      if (moved.pressedFirst) press(id)
    }
  }

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)
  const native = Platform.OS !== "web"
  const touchProps = interactive && native
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderTerminationRequest: () => false,
        onTouchStart: (event: GestureResponderEvent) => onTouches(event, "start"),
        onTouchMove: (event: GestureResponderEvent) => onTouches(event, "move"),
        onTouchEnd: (event: GestureResponderEvent) => onTouches(event, "end"),
        onTouchCancel: (event: GestureResponderEvent) => onTouches(event, "end"),
      }
    : {}
  // a mouse or a single touch on the web goes through the key itself
  const webPress = (key: SpKey) =>
    interactive && !native
      ? {
          onPressIn: () => press(key.id),
          onPressOut: () => release(key.id),
          // a click so quick that pressIn and pressOut share a frame still selects the key
          onPress: () => pressRef.current?.(key),
        }
      : {}

  return (
    <View style={styles.kbd} onLayout={onLayout} {...touchProps}>
      {whites.map((key, i) => {
        const on = Boolean(lit?.(key)) || selected === key.id
        return (
          <Pressable
            key={key.id}
            disabled={!interactive || native}
            accessibilityRole={interactive ? "button" : "image"}
            accessibilityLabel={key.label}
            accessibilityState={{ selected: on }}
            pointerEvents={interactive && native ? "none" : "auto"}
            {...webPress(key)}
            style={[styles.wk, { width: rects[i]?.w, backgroundColor: on ? t.action : "#FBF8F4" }]}
          >
            <Text style={[styles.wkB, { color: on ? "#FFFFFF" : "#68635F" }]}>{key.swara}</Text>
            <Text style={[styles.wkS, { color: on ? "#FFFFFF" : "#68635F" }]}>{key.note}</Text>
          </Pressable>
        )
      })}
      <View style={styles.bks} pointerEvents="box-none">
        {blacks.map((key) => {
          const on = Boolean(lit?.(key)) || selected === key.id
          return (
            <Pressable
              key={key.id}
              disabled={!interactive || native}
              accessibilityRole={interactive ? "button" : "image"}
              accessibilityLabel={key.label}
              accessibilityState={{ selected: on }}
              pointerEvents={interactive && native ? "none" : "auto"}
              {...webPress(key)}
              style={[
                styles.bk,
                { left: `${key.leftPct}%`, backgroundColor: on ? t.action : "#1E1E1E" },
              ]}
            >
              <Text style={styles.bkT}>{key.note}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function idOf(index: number): string {
  return index < 8 ? `w${index}` : `b${index - 8}`
}

function indexOf(id: string): number {
  const n = Number(id.slice(1))
  return id.startsWith("w") ? n : 8 + n
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 12 },
  body: { gap: 20, paddingHorizontal: 10, paddingBottom: 140 },
  readout: { flexDirection: "row", alignItems: "baseline", gap: 12, paddingHorizontal: 10 },
  readoutB: {
    fontFamily: amFonts.display,
    fontSize: 45,
    lineHeight: 45,
    letterSpacing: -0.9,
    textTransform: "uppercase",
  },
  readoutS: { fontFamily: amFonts.semi, fontSize: 16, flexShrink: 1 },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 10 },
  kbd: {
    flexDirection: "row",
    height: KBD_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
    gap: 2,
  },
  wk: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    paddingBottom: 14,
  },
  // the prototype's `.wk span` rule also lands on the label inside <b>: 12px, 600, #68635F
  wkB: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 18 },
  wkS: { fontFamily: amFonts.semi, fontSize: 12 },
  bks: { position: "absolute", left: 0, right: 0, top: 0, height: 0 },
  bk: {
    position: "absolute",
    top: 0,
    width: `${KBD_BLACK_WIDTH_PCT}%`,
    height: KBD_BLACK_HEIGHT,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  bkT: { fontFamily: amFonts.bold, fontSize: 11, color: "#FFFFFF" },
})
