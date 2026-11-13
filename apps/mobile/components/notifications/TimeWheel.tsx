import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native"

import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"

/** Height of one row; five rows are visible, the middle one is the chosen one. */
export const WHEEL_ITEM = 48
const ROWS = 5
export const WHEEL_HEIGHT = WHEEL_ITEM * ROWS
const PAD = WHEEL_ITEM * 2
/** How long the wheel must rest before the nearest row is taken (web has no momentum end event). */
const SETTLE_MS = 130

type Props = {
  p: AmProto
  /** what a screen reader calls it ("Hour") */
  label: string
  /** one text per row, in order */
  labels: readonly string[]
  /** the chosen row */
  index: number
  onIndex: (index: number) => void
  width: number
}

/**
 * A vertical wheel that snaps to a row. Scroll it, flick it, or tap a row. The row in the middle is the
 * value; it is read when the wheel comes to rest, and the wheel is pulled onto the row. For a screen
 * reader it is one adjustable control (swipe up or down to change the value).
 */
export function TimeWheel({ p, label, labels, index, onIndex, width }: Props) {
  const ref = useRef<ScrollView>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const y = useRef(index * WHEEL_ITEM)
  const dragging = useRef(false)
  const committed = useRef(index)
  const [live, setLive] = useState(index)
  const last = labels.length - 1

  const clamp = useCallback((i: number) => Math.min(last, Math.max(0, i)), [last])

  const goTo = useCallback(
    (i: number, animated = true) => {
      ref.current?.scrollTo({ y: clamp(i) * WHEEL_ITEM, animated })
    },
    [clamp],
  )

  const settle = useCallback(() => {
    const i = clamp(Math.round(y.current / WHEEL_ITEM))
    if (Math.abs(y.current - i * WHEEL_ITEM) > 0.5) goTo(i)
    setLive(i)
    if (i !== committed.current) {
      committed.current = i
      onIndex(i)
    }
  }, [clamp, goTo, onIndex])

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    y.current = event.nativeEvent.contentOffset.y
    const i = clamp(Math.round(y.current / WHEEL_ITEM))
    setLive((current) => (current === i ? current : i))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      if (!dragging.current) settle()
    }, SETTLE_MS)
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // the value changed from outside (not by this wheel): move to it
  useEffect(() => {
    if (index !== committed.current) {
      committed.current = index
      setLive(index)
      goTo(index, false)
    }
  }, [goTo, index])

  const step = (delta: number) => {
    const next = clamp(committed.current + delta)
    goTo(next)
  }

  return (
    <View
      style={{ width, height: WHEEL_HEIGHT }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: labels[committed.current] ?? "" }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") step(1)
        if (event.nativeEvent.actionName === "decrement") step(-1)
      }}
    >
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        scrollEventThrottle={16}
        snapToInterval={WHEEL_ITEM}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: index * WHEEL_ITEM }}
        onContentSizeChange={() => goTo(committed.current, false)}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          dragging.current = true
        }}
        onScrollEndDrag={() => {
          dragging.current = false
        }}
        onMomentumScrollEnd={settle}
        contentContainerStyle={{ paddingVertical: PAD }}
      >
        {labels.map((text, i) => {
          const distance = Math.abs(i - live)
          return (
            <Pressable
              key={`${text}-${i}`}
              accessible={false}
              importantForAccessibility="no"
              onPress={() => goTo(i)}
              style={s.item}
            >
              <Text
                style={[
                  s.text,
                  { color: distance === 0 ? p.orange700 : p.ink500 },
                  distance === 0 ? s.textOn : null,
                  { opacity: distance === 0 ? 1 : distance === 1 ? 0.75 : 0.45 },
                ]}
              >
                {text}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  item: { height: WHEEL_ITEM, alignItems: "center", justifyContent: "center" },
  text: { fontFamily: amFonts.medium, fontSize: 22, lineHeight: 28 },
  textOn: { fontFamily: amFonts.semi, fontSize: 32, lineHeight: 38 },
})
