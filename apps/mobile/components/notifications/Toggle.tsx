import { useEffect } from "react"
import { StyleSheet, View } from "react-native"
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"
import type { AmProto } from "@/constants/tokens/amToday"

const W = 52
const H = 32
const PAD = 4
const THUMB = H - PAD * 2
/** inside width (track minus the 2dp borders and the padding) minus the thumb */
const TRAVEL = W - 4 - (PAD - 2) * 2 - (THUMB - 2)

/**
 * The look of a switch: a pill with a round thumb. On = action fill (orange700) with a white thumb;
 * off = an ink300 outline and thumb on the row's surface (a ring, like the radio, so the state never
 * rests on colour alone). The row around it is the control (role switch); this only draws and moves.
 * The thumb springs from where it is, so a quick second tap never jumps.
 */
export function Toggle({ p, on }: { p: AmProto; on: boolean }) {
  const reduce = useReducedMotion()
  const x = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    x.value = reduce ? (on ? 1 : 0) : withSpring(on ? 1 : 0, amSpring.default)
  }, [on, reduce, x])
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * TRAVEL }] }))
  return (
    <View
      style={[s.track, on ? { backgroundColor: p.action, borderColor: p.action } : { borderColor: p.ink300 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[s.thumb, { backgroundColor: on ? "#FFFFFF" : p.ink300 }, thumb]} />
    </View>
  )
}

const s = StyleSheet.create({
  track: { width: W, height: H, borderRadius: H / 2, borderWidth: 2, justifyContent: "center", paddingHorizontal: PAD - 2 },
  thumb: { width: THUMB - 2, height: THUMB - 2, borderRadius: (THUMB - 2) / 2 },
})
