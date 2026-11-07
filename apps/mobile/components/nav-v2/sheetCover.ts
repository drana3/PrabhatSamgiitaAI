import { useEffect } from "react"
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

import { useSheetCover } from "@/lib/sheetCover"

// The counting itself lives in lib/sheetCover.ts (no native imports, so it is unit tested).
export { coverSheet, sheetIsOpen, useCoverWhile, useSheetCover } from "@/lib/sheetCover"

/** Opacity for a floating bar: 1, fading to 0 while a sheet is open. */
export function useCoverFade() {
  const covered = useSheetCover((s) => s.count > 0)
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withTiming(covered ? 0 : 1, { duration: 180 })
  }, [covered, opacity])
  return useAnimatedStyle(() => ({ opacity: opacity.value }))
}
