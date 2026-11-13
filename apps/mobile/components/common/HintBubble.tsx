import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Platform, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native"
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { amColors, amDark } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { placeTooltip, type Rect, type Size, type TooltipSide } from "@/lib/tooltipPlacement"

const PAD_X = 12
const PAD_Y = 6
const ARROW = 10
/** the arrow is a square turned 45 degrees: its tip reaches this far past the bubble's edge */
const ARROW_REACH = 7
const SCREEN_MARGIN = 8
const FADE_IN_MS = 320
const FADE_OUT_MS = 150

type Listener = () => void
const touchListeners = new Set<Listener>()

/**
 * A screen that shows hint bubbles calls this when a finger lands anywhere on it (View `onStartShouldSetResponderCapture`,
 * which answers false): it only listens, the touch still reaches the button it was meant for. The web preview listens to the
 * window itself.
 */
export function notifyScreenTouch() {
  touchListeners.forEach((listener) => listener())
}

type Measured = { anchor: Rect; avoid: Rect[] }

function measureInWindow(ref: RefObject<View | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current
    if (!node) return resolve(null)
    node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null))
  })
}

type Props = {
  text: string
  /** The bubble shows while this is true; false fades it away. */
  active: boolean
  /** The icon the bubble explains. The bubble is drawn inside the view that holds this ref, which must be that icon's own wrapper. */
  anchorRef: RefObject<View | null>
  /** Rows of controls around the icon: the bubble never sits on them. When no free spot is left, no bubble shows. */
  avoid?: readonly RefObject<View | null>[]
  /** Called when the bubble goes: a tap anywhere, or the time running out. */
  onDismiss: () => void
  /** Wait before it appears, so the screen's own entrance finishes first (the rows are measured after it). */
  delayMs?: number
  /** How long it stays. */
  durationMs?: number
}

/**
 * The one hint bubble of the app (the "i" of the player says what it is; others reuse it). It is a passenger, never
 * in the way:
 *  - it takes no touches at all (pointerEvents none), so every button under it works while it shows;
 *  - it is sized to its text, not to a fixed box, and put on a free side of the icon (lib/tooltipPlacement.ts), never
 *    over the rows named in `avoid`; with no free side it does not show;
 *  - a tap anywhere, or a few seconds, take it away. Only opacity and transform move; Reduce Motion: no movement.
 * Draw it as a child of the icon's wrapper: its position is worked out relative to that wrapper.
 */
export function HintBubble({ text, active, anchorRef, avoid, onDismiss, delayMs = 900, durationMs = 6000 }: Props) {
  const reduce = useReducedMotion()
  const win = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [measured, setMeasured] = useState<Measured | null>(null)
  const [textSize, setTextSize] = useState<Size | null>(null)
  const show = useSharedValue(0)
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  // Measure the icon and the rows around it once the entrance of the screen is over (and again if the window changes).
  const avoidRef = useRef(avoid)
  avoidRef.current = avoid
  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      const anchor = await measureInWindow(anchorRef)
      const others = await Promise.all((avoidRef.current ?? []).map(measureInWindow))
      if (cancelled || !anchor) return
      setMeasured({ anchor, avoid: others.filter((r): r is Rect => r != null) })
    }, delayMs)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [active, anchorRef, delayMs, win.width, win.height])

  const maxWidth = win.width - 2 * SCREEN_MARGIN
  const body = useMemo<Size | null>(
    () => (textSize ? { width: Math.ceil(textSize.width) + 1 + 2 * PAD_X, height: Math.ceil(textSize.height) + 2 * PAD_Y } : null),
    [textSize],
  )
  const placement = useMemo(() => {
    if (!measured || !body) return null
    // the status bar above, and a hair above the bottom edge: a bubble under the last row has only the strip below it
    const bounds: Rect = { x: 0, y: insets.top, width: win.width, height: win.height - insets.top - 2 }
    return placeTooltip({ anchor: measured.anchor, size: body, bounds, avoid: measured.avoid, gap: ARROW_REACH, margin: SCREEN_MARGIN })
  }, [measured, body, insets.top, win.width, win.height])

  const visible = active && placement != null
  useEffect(() => {
    if (!visible) {
      show.value = withTiming(0, { duration: FADE_OUT_MS })
      return undefined
    }
    show.value = reduce ? 1 : withTiming(1, { duration: FADE_IN_MS, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
    const timer = setTimeout(() => dismiss.current(), durationMs)
    const onTouch = () => dismiss.current()
    touchListeners.add(onTouch)
    // the web preview has no root capture: listen to the window (capture phase, so nothing under the bubble is blocked)
    const onPointer = Platform.OS === "web" && typeof globalThis.addEventListener === "function" ? onTouch : null
    if (onPointer) globalThis.addEventListener("pointerdown", onPointer, true)
    return () => {
      clearTimeout(timer)
      touchListeners.delete(onTouch)
      if (onPointer) globalThis.removeEventListener("pointerdown", onPointer, true)
    }
  }, [visible, reduce, durationMs, show])

  // a new text or a new window width means the size must be measured again
  useEffect(() => setTextSize(null), [text, maxWidth])
  const onTextLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setTextSize((previous) => (previous && Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5 ? previous : { width, height }))
  }, [])

  const side: TooltipSide = placement?.side ?? "below"
  const lift = useAnimatedStyle(() => {
    const away = reduce ? 0 : (1 - show.value) * 6
    return {
      opacity: show.value,
      transform: [{ translateX: side === "left" ? away : side === "right" ? -away : 0 }, { translateY: side === "below" ? -away : side === "above" ? away : 0 }],
    }
  })

  if (!active && !measured) return null
  return (
    <>
      {/* the first pass: the text alone, as wide as it wants (up to the screen), invisible, to learn its size */}
      {textSize == null ? (
        <View pointerEvents="none" style={[styles.probe, { width: maxWidth }]}>
          <Text style={styles.text} onLayout={onTextLayout}>
            {text}
          </Text>
        </View>
      ) : null}
      {placement && body && measured ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.bubble,
            lift,
            { left: placement.left - measured.anchor.x, top: placement.top - measured.anchor.y, width: body.width, height: body.height },
          ]}
        >
          <View style={[styles.arrow, arrowPosition(placement.side, placement.arrow)]} />
          <View style={styles.body}>
            <Text style={styles.text}>{text}</Text>
          </View>
        </Animated.View>
      ) : null}
    </>
  )
}

function arrowPosition(side: TooltipSide, along: number) {
  const half = ARROW / 2
  if (side === "below") return { top: -half, left: along - half }
  if (side === "above") return { bottom: -half, left: along - half }
  if (side === "right") return { left: -half, top: along - half }
  return { right: -half, top: along - half }
}

const styles = StyleSheet.create({
  // laid out (so it has a size) but never seen: the text sits at its natural width, the box is only the room it may use
  probe: { position: "absolute", left: 0, top: 0, opacity: 0, paddingHorizontal: PAD_X },
  bubble: { position: "absolute", justifyContent: "center" },
  body: { flex: 1, justifyContent: "center", borderRadius: 14, paddingHorizontal: PAD_X, backgroundColor: amColors.gold300 },
  arrow: { position: "absolute", width: ARROW, height: ARROW, backgroundColor: amColors.gold300, transform: [{ rotate: "45deg" }] },
  text: { alignSelf: "flex-start", fontFamily: amFonts.bold, fontSize: 13, lineHeight: 17, color: amDark.page },
})
