import type { ReactNode } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"

type Props = Omit<PressableProps, "style" | "children"> & {
  /** layout of the touch area (flex, width, alignSelf) */
  outerStyle?: StyleProp<ViewStyle>
  /** look of the pressed surface */
  style?: StyleProp<ViewStyle>
  pressedScale?: number
  children?: ReactNode
}

/**
 * Same feedback as PressScale (spring on touch-down, from the on-screen
 * value) but the Pressable itself takes layout props, so it can sit in a row
 * and fill a grid cell. PressScale in components/today stays untouched.
 */
export function Press({ outerStyle, style, pressedScale = 0.97, children, ...rest }: Props) {
  const scale = useSharedValue(1)
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Pressable
      {...rest}
      style={outerStyle}
      onPressIn={(event) => {
        scale.value = withSpring(pressedScale, amSpring.default)
        rest.onPressIn?.(event)
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, amSpring.default)
        rest.onPressOut?.(event)
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  )
}
