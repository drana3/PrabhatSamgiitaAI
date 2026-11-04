import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"

import { amReveal } from "@/constants/tokens/amMotion"

const REVEAL_EASING = Easing.bezier(...amReveal.easing)

/** Prototype: `rz` flips to "still" 1.6s after the screen opens; later blocks never animate. */
export const REVEAL_WINDOW_MS = 1600

/** When the screen opened (ms). Blocks that mount after the window appear at once. */
export const RevealClock = createContext<number>(0)

export function useRevealClock(): number {
  const ref = useRef(Date.now())
  return ref.current
}

/**
 * The prototype `.r` block: rises 16dp and fades in, 80ms per `index`. Differs from the shared
 * Today Reveal in one thing: a block that mounts after the first 1.6s (a segment switch, a row
 * scrolled into view) shows at once instead of replaying the entrance.
 */
export function SongsReveal({
  index,
  style,
  children,
}: {
  index: number
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  const openedAt = useContext(RevealClock)
  const live = openedAt > 0 && Date.now() - openedAt < REVEAL_WINDOW_MS
  const progress = useSharedValue(live ? 0 : 1)

  useEffect(() => {
    if (!live) return
    const wait = Math.max(0, index * amReveal.stepMs - (Date.now() - openedAt))
    progress.value = withDelay(wait, withTiming(1, { duration: amReveal.durationMs, easing: REVEAL_EASING }))
    // runs once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduce ? 0 : (1 - progress.value) * amReveal.riseDp }],
  }))

  return <Animated.View style={[style, animated]}>{children}</Animated.View>
}
