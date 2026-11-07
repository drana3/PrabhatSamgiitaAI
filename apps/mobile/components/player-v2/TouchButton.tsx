import { useRef, type ReactNode } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSpring, useReducedMotion } from "react-native-reanimated"

import { amSpring } from "@/constants/tokens/amMotion"

type Props = Omit<PressableProps, "style" | "onPress" | "onPressIn" | "children"> & {
  /** Fires on touch-down. Screen-reader activation (which sends only a press) fires it too, once. */
  onAction?: () => void
  /** Style of the visible element (it scales). */
  style?: StyleProp<ViewStyle>
  /** Style of the touch area that sits in the parent's layout. */
  containerStyle?: StyleProp<ViewStyle>
  pressedScale?: number
  children?: ReactNode
}

/**
 * A control that responds on pointer-down (spec section 1: "press feedback on
 * pointer down") with a spring scale that starts from the on-screen value, so
 * a quick release never jumps. Same feel as PressScale on the Today screen,
 * plus an action on touch-down and a layout style for the touch area. Use it
 * for transport and toolbar buttons, not for rows inside a scrolling list.
 */
export function TouchButton({
  onAction,
  style,
  containerStyle,
  pressedScale = 0.95,
  children,
  ...rest
}: Props) {
  const firedByTouch = useRef(false)
  const action = useRef(onAction)
  action.current = onAction
  const scale = useSharedValue(1)
  const reduce = useReducedMotion()
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      {...rest}
      style={containerStyle}
      onPressIn={() => {
        scale.value = reduce ? 1 : withSpring(pressedScale, amSpring.default)
        firedByTouch.current = true
        action.current?.()
      }}
      onPressOut={() => {
        scale.value = reduce ? 1 : withSpring(1, amSpring.default)
      }}
      onPress={() => {
        if (firedByTouch.current) {
          firedByTouch.current = false
          return
        }
        action.current?.()
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  )
}
