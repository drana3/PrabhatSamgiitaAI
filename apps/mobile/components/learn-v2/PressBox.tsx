import type { ReactNode } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring, useReducedMotion } from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"

type Props = Omit<PressableProps, "style" | "children"> & {
  /** layout of the touch area (flex, alignSelf, width) */
  outerStyle?: StyleProp<ViewStyle>
  /** look of the pressed surface (colour, radius, padding) */
  style?: StyleProp<ViewStyle>
  pressedScale?: number
  children?: ReactNode
}

/**
 * Like PressScale from components/today/motion, but the layout style goes to the
 * touch area, so a PressBox can sit in a flex row. It scales on touch-down with a
 * spring that starts from the value on screen, so it is interruptible.
 */
export function PressBox({ outerStyle, style, pressedScale = 0.97, children, ...rest }: Props) {
  const scale = useSharedValue(1)
  const reduce = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      onPressIn={(event) => {
        scale.value = reduce ? 1 : withSpring(pressedScale, amSpring.default)
        rest.onPressIn?.(event)
      }}
      onPressOut={(event) => {
        scale.value = reduce ? 1 : withSpring(1, amSpring.default)
        rest.onPressOut?.(event)
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  )
}
