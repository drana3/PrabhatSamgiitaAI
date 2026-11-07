import { Platform } from "react-native"
import { useAnimatedKeyboard, useSharedValue, type SharedValue } from "react-native-reanimated"

/**
 * How far the on-screen keyboard has risen, as a shared value that follows the keyboard's own animation (iOS). A view
 * that sits at the very bottom subtracts it from its translateY and so stays above the keyboard, frame for frame.
 * Android resizes the window itself (app.json: softwareKeyboardLayoutMode "resize") and the web has no keyboard to
 * speak of, so there the value stays 0 and nothing moves twice.
 */
function useIosKeyboardLift(): SharedValue<number> {
  return useAnimatedKeyboard().height
}

function useNoKeyboardLift(): SharedValue<number> {
  return useSharedValue(0)
}

export const useKeyboardLift: () => SharedValue<number> = Platform.OS === "ios" ? useIosKeyboardLift : useNoKeyboardLift
