import { useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"
import { Trash2 } from "lucide-react-native"

import { amSpring, projectMomentum } from "@/constants/tokens/amMotion"
import { amFonts } from "@/constants/tokens/amTypography"
import type { AmProto } from "@/constants/tokens/amToday"

/**
 * A row that deletes with a swipe to the left. The row follows the finger one to one from where it was grabbed,
 * pulls back like rubber if dragged to the right, and lands by where the throw would end (position plus
 * velocity projected), not by distance alone: a quick flick deletes, a slow drag that stops short springs back.
 * The spring starts from the row's current position and from the finger's velocity, so it can be caught
 * mid-flight. Only transform moves. With reduced motion the row leaves without the slide.
 * The X button and the "delete" accessibility action stay on the row for people who cannot swipe.
 */
const REVEAL = 88
const RUBBER = 0.35

export function SwipeRow({
  p,
  label,
  onDelete,
  children,
}: {
  p: AmProto
  /** the word under the row while it is pulled ("Delete") */
  label: string
  onDelete: () => void
  children: ReactNode
}) {
  const x = useSharedValue(0)
  const start = useSharedValue(0)
  const width = useSharedValue(360)
  const reduce = useReducedMotion()
  const [gone, setGone] = useState(false)

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      // grab from where the row is on screen right now (it may still be moving)
      start.value = x.value
    })
    .onUpdate((e) => {
      const raw = start.value + e.translationX
      x.value = raw > 0 ? raw * RUBBER : raw
    })
    .onEnd((e) => {
      const landing = projectMomentum(x.value, e.velocityX)
      if (landing < -Math.max(REVEAL * 1.6, width.value * 0.45)) {
        if (reduce) {
          x.value = -width.value
          runOnJS(setGone)(true)
          runOnJS(onDelete)()
        } else {
          x.value = withSpring(-width.value, { ...amSpring.fling, velocity: e.velocityX }, (finished) => {
            if (finished) {
              runOnJS(setGone)(true)
              runOnJS(onDelete)()
            }
          })
        }
      } else {
        x.value = withSpring(0, { ...amSpring.default, velocity: e.velocityX })
      }
    })

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const reveal = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, -x.value / 40)) }))

  if (gone) return null
  return (
    <View onLayout={(e) => (width.value = e.nativeEvent.layout.width)} style={s.wrap}>
      <Animated.View style={[s.under, { backgroundColor: p.dangerText }, reveal]} pointerEvents="none">
        <Trash2 size={20} color="#FFFFFF" strokeWidth={1.9} />
        <Text style={s.underText}>{label}</Text>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={slide}>{children}</Animated.View>
      </GestureDetector>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { position: "relative" },
  under: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingRight: 24 },
  underText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, color: "#FFFFFF" },
})
