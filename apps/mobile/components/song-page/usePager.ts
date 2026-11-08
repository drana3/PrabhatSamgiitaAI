import { useCallback, useEffect, useMemo } from "react"
import { Gesture } from "react-native-gesture-handler"
import {
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"
import { PAGE_COUNT, decideAxis, dotMarkX, heightAt, landingPage, pageAt, rowOffset } from "@/lib/songPage/pager"

const REDUCED_MS = 150

export type PagerController = {
  /** spring to page `index` */
  goTo: (index: number) => void
}

type Input = {
  /** the width of one page */
  width: number
  /** the measured heights of the pages (the window follows them as the row moves) */
  heights: readonly number[]
  /** the page nearest to the row changed (JS side: the label, the dots) */
  onPage: (index: number) => void
}

/**
 * The motion of the text block's pages. The row of pages is pulled one to one by a finger that moves sideways, from
 * where the finger took it, and meets a rubber band at the first and last page. On release the finger's speed goes
 * into a spring and the landing is the projection of the throw. The spring can be caught at any moment: a finger put
 * down freezes it where it is, and a finger that turns out to scroll lets it carry on to the nearest page.
 *
 * Which way a finger is going is decided by `decideAxis` (lib/songPage/pager.ts): up and down wins every doubt, so the
 * page scrolls as it always did and only a clear sideways move turns the pages. On the web the view says
 * `touch-action: pan-y` (see the GestureDetector in TextBlock), so the browser keeps the vertical scroll for itself.
 * The height of the window between the pages is the only thing that is not a transform: it is interpolated on the UI
 * thread from the heights of the two pages the row is between, so the sections below move once, smoothly, and not twice.
 */
export function usePager({ width, heights, onPage }: Input) {
  const reduce = useReducedMotion()
  const count = PAGE_COUNT

  const widthSv = useSharedValue(width)
  const heightsSv = useSharedValue<number[]>([...heights])
  useEffect(() => {
    widthSv.value = width
  }, [width, widthSv])
  useEffect(() => {
    heightsSv.value = [...heights]
  }, [heights, heightsSv])

  /** where the row rests or is settling to, as a page number (0, 1, 2; fractional while a spring runs) */
  const pos = useSharedValue(0)
  /** the finger's extra offset of the row, px */
  const drag = useSharedValue(0)
  const start = useSharedValue(0)
  const slop = useSharedValue(0)
  const from = useSharedValue(0)
  /** a spring was caught by this touch */
  const frozen = useSharedValue(0)
  /** 0 undecided, 1 sideways (the pager has it), 2 up/down (the page has it) */
  const axis = useSharedValue(0)
  const downX = useSharedValue(0)
  const downY = useSharedValue(0)

  const rowX = useDerivedValue(() => rowOffset({ pos: pos.value, drag: drag.value, width: widthSv.value, count, rubber: true }))
  /** the row's place as a fractional page number, for the dots, the label and the window's height */
  const place = useDerivedValue(() => Math.max(0, Math.min(count - 1, -rowX.value / Math.max(1, widthSv.value))))

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rowX.value }] }))
  const windowStyle = useAnimatedStyle(() => ({ height: heightAt(place.value, heightsSv.value) }))
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dotMarkX(place.value) }] }))

  useAnimatedReaction(
    () => pageAt(place.value),
    (index, before) => {
      if (before !== null && index !== before) runOnJS(onPage)(index)
    },
    [onPage],
  )

  /** One spring from where the row is to page `index`, with the finger's speed (dp/s, negative towards the next page). */
  const run = (index: number, velocity: number, fling: boolean) => {
    "worklet"
    cancelAnimation(pos)
    // from here the spring owns the row: what the finger held becomes the spring's start, so nothing jumps
    pos.value = pos.value - drag.value / Math.max(1, widthSv.value)
    drag.value = 0
    if (reduce) {
      pos.value = withTiming(index, { duration: REDUCED_MS, reduceMotion: ReduceMotion.Never })
      return
    }
    pos.value = withSpring(index, { ...(fling ? amSpring.fling : amSpring.default), velocity: -velocity / Math.max(1, widthSv.value), reduceMotion: ReduceMotion.Never })
  }

  const goTo = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(count - 1, index))
      if (reduce) pos.value = withTiming(target, { duration: REDUCED_MS, reduceMotion: ReduceMotion.Never })
      else pos.value = withSpring(target, { ...amSpring.default, reduceMotion: ReduceMotion.Never })
    },
    [count, pos, reduce],
  )

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((event) => {
          const touch = event.allTouches[0]
          axis.value = 0
          downX.value = touch?.x ?? 0
          downY.value = touch?.y ?? 0
          // a spring in flight is caught where it is
          frozen.value = 0
          cancelAnimation(pos)
          if (Math.abs(pos.value - Math.round(pos.value)) > 0.001) frozen.value = 1
          from.value = pageAt(place.value)
        })
        .onTouchesMove((event, manager) => {
          if (axis.value !== 0) return
          const touch = event.allTouches[0]
          if (!touch) return
          const decided = decideAxis(touch.x - downX.value, touch.y - downY.value)
          if (decided === "x") {
            axis.value = 1
            manager.activate()
          } else if (decided === "y") {
            axis.value = 2
            manager.fail()
          }
        })
        .onStart((event) => {
          start.value = drag.value
          slop.value = event.translationX
          frozen.value = 0
        })
        .onUpdate((event) => {
          drag.value = start.value + event.translationX - slop.value
        })
        .onEnd((event) => {
          // a release is judged by the finger (raw offset), not by the rubber band
          const raw = -pos.value * widthSv.value + drag.value
          const land = landingPage({ from: from.value, x: raw, velocity: event.velocityX, width: widthSv.value, count })
          run(land.index, event.velocityX, land.fling)
        })
        .onFinalize((_event, success) => {
          // a touch that caught the spring and went on to scroll the page: carry on to the nearest page
          if (!success && frozen.value) {
            frozen.value = 0
            run(pageAt(place.value), 0, false)
          }
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reduce],
  )

  return { rowStyle, windowStyle, markStyle, place, gesture, goTo }
}
