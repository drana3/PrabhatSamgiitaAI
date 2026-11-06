import { useCallback, useEffect, useMemo } from "react"
import { Gesture } from "react-native-gesture-handler"
import {
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated"
import type Animated from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"
import {
  PANEL_COUNT,
  dotMarkX,
  jumpScroll,
  landingPanel,
  panelAt,
  panelPosAt,
  pinDistance,
  readOffsetAt,
  readingScroll,
  rowOffset,
  settleScroll,
  stageShift,
  type PanelsFrame,
  type PanelsLayout,
} from "@/lib/songPage/blockPanels"

const REDUCED_MS = 150
/** The scroll has to be this close to the settle's end for the row to hand back to it. */
const NEAR = 1.5
/** If the scroll never arrives (the page could not go that far) the row hands back after this long. */
const GUARD_MS = 140

export type PanelController = {
  /** spring to panel `index`: the page scrolls to the pinned stage with that panel at rest on top */
  goTo: (index: number) => void
}

type Input = {
  scrollY: SharedValue<number>
  touch: SharedValue<number>
  scrollRef: AnimatedRef<Animated.ScrollView>
  /** page y of the top of the block (where the stage sits before it pins) */
  blockTop: number
  /** the bars the stage pins under: the compact bar and the section strip */
  topInset: number
  frame: PanelsFrame
  /** the nearest panel changed (JS side: the label, the dots, the strip) */
  onPanel: (index: number) => void
  /** the reading strip's idea of the page scroll, in steps of 8 */
  onReading: (y: number) => void
}

/**
 * The motion of the pinned text block. The page's scroll is the one source of truth (lib/songPage/blockPanels.ts is the
 * timeline). Everything below runs on the UI thread; nothing here touches React state per frame.
 *
 *  - A finger moving sideways on the stage drags the row one to one from where it was taken (`tx`), meeting a rubber
 *    band at the first and last panel. On release the finger's speed goes into a spring and the landing is the
 *    projection of the throw. The spring runs on `u` (0 to 1): it carries both the row and the page scroll to the
 *    landing, so a swipe leaves the page exactly where plain scrolling would have put it.
 *  - While that spring runs, everything on screen is drawn straight from the spring's own number `u` (the real scroll is
 *    driven by the same number through scrollTo), so the picture never waits for a scroll event and never trails the
 *    scroll by a frame.
 *  - The spring can be caught at any moment: a finger on the stage freezes it where it is, a finger on the page hands the
 *    row back to the scroll.
 */
export function usePanelMotion({ scrollY, touch, scrollRef, blockTop, topInset, frame, onPanel, onReading }: Input) {
  const reduce = useReducedMotion()
  const count = PANEL_COUNT

  const layoutSv = useSharedValue<PanelsLayout>(frame.layout)
  const pinSv = useSharedValue(blockTop - topInset)
  useEffect(() => {
    layoutSv.value = frame.layout
  }, [frame.layout, layoutSv])
  useEffect(() => {
    pinSv.value = blockTop - topInset
  }, [blockTop, topInset, pinSv])

  const animating = useSharedValue(0)
  /** the finger's extra offset of the row, px */
  const tx = useSharedValue(0)
  const u = useSharedValue(0)
  const x0 = useSharedValue(0)
  const xT = useSharedValue(0)
  const s0 = useSharedValue(0)
  const sT = useSharedValue(0)
  const pend = useSharedValue(0)
  const guard = useSharedValue(0)
  const start = useSharedValue(0)
  /** how far the finger had gone when the pan took over (the slop is not the row's to follow) */
  const slop = useSharedValue(0)
  const from = useSharedValue(0)
  const frozen = useSharedValue(0)

  // While a spring settles, everything on screen is drawn straight from `u` (the same number the scroll is driven by),
  // never through another shared value that the settle would have to write first: a value written by a reaction reaches
  // its readers a frame late, and the pinned stage would drift against the scroll.
  const eff = useDerivedValue(() => (animating.value ? s0.value + (sT.value - s0.value) * u.value : scrollY.value))
  /** where the row is on screen (px, left is negative) */
  const rowX = useDerivedValue(() =>
    animating.value
      ? x0.value + (xT.value - x0.value) * u.value
      : rowOffset({ pos: panelPosAt(layoutSv.value, scrollY.value - pinSv.value), drag: tx.value, width: layoutSv.value.width, count, rubber: true }),
  )
  /** the row's place as a fractional panel number, for the dots and the label */
  const pos = useDerivedValue(() => Math.max(0, Math.min(count - 1, -rowX.value / Math.max(1, layoutSv.value.width))))

  // ---- the picture ----
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: stageShift(eff.value, pinSv.value, pinDistance(layoutSv.value)) }],
  }))
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rowX.value }] }))
  const readStyle = [0, 1, 2].map((i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({ transform: [{ translateY: -readOffsetAt(layoutSv.value, eff.value - pinSv.value, i) }] })),
  )
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dotMarkX(pos.value) }] }))

  // ---- what JS needs to know ----
  useAnimatedReaction(
    () => panelAt(pos.value),
    (index, before) => {
      if (index !== before) runOnJS(onPanel)(index)
    },
    [onPanel],
  )
  useAnimatedReaction(
    () => Math.round(readingScroll(layoutSv.value, eff.value, pinSv.value) / 8),
    (step, before) => {
      if (step !== before) runOnJS(onReading)(step * 8)
    },
    [onReading],
  )

  // ---- settling ----
  const finish = () => {
    "worklet"
    pend.value = 0
    cancelAnimation(guard)
    animating.value = 0
    tx.value = 0
  }
  /** The scroll has arrived (or the page could not go that far): the row goes back to following the scroll. */
  useAnimatedReaction(
    () => scrollY.value,
    (y) => {
      if (pend.value && Math.abs(y - sT.value) < NEAR) finish()
    },
  )
  useAnimatedReaction(
    () => u.value,
    (value) => {
      if (!animating.value) return
      scrollTo(scrollRef, 0, s0.value + (sT.value - s0.value) * value, false)
    },
  )
  const arrived = () => {
    "worklet"
    if (Math.abs(scrollY.value - sT.value) < NEAR) return finish()
    pend.value = 1
    guard.value = 0
    guard.value = withTiming(1, { duration: GUARD_MS, reduceMotion: ReduceMotion.Never }, (done) => {
      if (done && pend.value) finish()
    })
  }
  /** One spring from where things are to a landing: the row from `fromX` to `toX`, the page from `fromS` to `toS`. */
  const run = (fromX: number, toX: number, fromS: number, toS: number, velocity: number, fling: boolean) => {
    "worklet"
    cancelAnimation(u)
    pend.value = 0
    cancelAnimation(guard)
    animating.value = 1
    x0.value = fromX
    xT.value = toX
    s0.value = fromS
    sT.value = toS
    u.value = 0
    const span = toX - fromX
    // the finger's speed along the way, as a share of the way per second
    const v = span !== 0 ? Math.max(-20, Math.min(20, velocity / span)) : 0
    u.value = reduce
      ? withTiming(1, { duration: REDUCED_MS, reduceMotion: ReduceMotion.Never }, (done) => {
          if (done) arrived()
        })
      : withSpring(
          1,
          { ...(fling ? amSpring.fling : amSpring.default), velocity: v, reduceMotion: ReduceMotion.Never },
          (done) => {
            if (done) arrived()
          },
        )
  }

  /** The picture as it is on screen, so a catch or a jump starts from it. */
  const here = () => {
    "worklet"
    const layout = layoutSv.value
    const s = eff.value
    const x = rowX.value
    // `raw` is where the row is without the rubber band (a release is judged by the finger, not by the elastic)
    const raw = animating.value ? x : -panelPosAt(layout, s - pinSv.value) * layout.width + tx.value
    return { s, x, raw }
  }
  const jump = (index: number) => {
    "worklet"
    const layout = layoutSv.value
    const h = here()
    run(h.x, -index * layout.width, h.s, jumpScroll(layout, pinSv.value, index), 0, false)
  }
  const goTo = useCallback(
    (index: number) => {
      runOnUI(() => {
        "worklet"
        jump(Math.max(0, Math.min(count - 1, index)))
      })()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const settle = (velocity: number) => {
    "worklet"
    const layout = layoutSv.value
    const h = here()
    const land = landingPanel({ from: from.value, x: h.raw, velocity, width: layout.width, count })
    run(h.x, -land.index * layout.width, h.s, pinSv.value + settleScroll(layout, h.s - pinSv.value, land.index), velocity, land.fling)
  }
  /**
   * Stops the spring and hands the row to the scroll without it moving: `tx` becomes whatever is left between where the
   * row is and where the scroll alone would put it.
   */
  const handBack = () => {
    "worklet"
    const x = rowX.value
    cancelAnimation(u)
    pend.value = 0
    cancelAnimation(guard)
    animating.value = 0
    tx.value = x + panelPosAt(layoutSv.value, scrollY.value - pinSv.value) * layoutSv.value.width
  }
  /** A finger on the page itself: the spring lets go and the row eases back to the scroll. */
  useAnimatedReaction(
    () => touch.value,
    (now, before) => {
      if (before === null || now === before || !animating.value) return
      handBack()
      tx.value = reduce ? withTiming(0, { duration: REDUCED_MS, reduceMotion: ReduceMotion.Never }) : withSpring(0, amSpring.default)
    },
  )
  /** Catches a spring in flight: from now the finger holds the row where the spring had it. */
  const freeze = () => {
    "worklet"
    if (!animating.value) return
    handBack()
    frozen.value = 1
  }

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-14, 14])
        .onTouchesDown(() => {
          freeze()
          cancelAnimation(tx)
          from.value = panelAt(-here().raw / Math.max(1, layoutSv.value.width))
        })
        .onStart((e) => {
          freeze()
          cancelAnimation(tx)
          frozen.value = 0
          start.value = tx.value
          slop.value = e.translationX
        })
        .onUpdate((e) => {
          tx.value = start.value + e.translationX - slop.value
        })
        .onEnd((e) => {
          settle(e.velocityX)
        })
        .onFinalize((_e, success) => {
          // a touch that caught the spring and turned out to be a tap: carry on to the nearest panel
          if (!success && frozen.value) {
            frozen.value = 0
            settle(0)
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return { stageStyle, rowStyle, readStyle, markStyle, pos, gesture, goTo }
}
