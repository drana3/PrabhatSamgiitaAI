import { useRef, type ReactNode } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring, useReducedMotion } from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"

type Props = Omit<PressableProps, "style" | "children"> & {
  /** layout of the touch area */
  outerStyle?: StyleProp<ViewStyle>
  /** look of the pressed surface */
  style?: StyleProp<ViewStyle>
  pressedScale?: number
  /** runs on touch-down; if the platform never delivers touch-down, it runs on press instead (never twice) */
  onActivate?: () => void
  children?: ReactNode
}

/** Feedback on touch-down: a spring scale that starts from the on-screen value, so a quick release never jumps. */
export function KPress({ outerStyle, style, pressedScale = 0.97, onActivate, children, ...rest }: Props) {
  const fired = useRef(false)
  const scale = useSharedValue(1)
  const reduce = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      onPressIn={(event) => {
        scale.value = reduce ? 1 : withSpring(pressedScale, amSpring.default)
        if (onActivate) {
          fired.current = true
          onActivate()
        }
        rest.onPressIn?.(event)
      }}
      onPress={(event) => {
        if (onActivate && !fired.current) onActivate()
        fired.current = false
        rest.onPress?.(event)
      }}
      onPressOut={(event) => {
        scale.value = reduce ? 1 : withSpring(1, amSpring.default)
        setTimeout(() => {
          fired.current = false
        }, 0)
        rest.onPressOut?.(event)
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  )
}
