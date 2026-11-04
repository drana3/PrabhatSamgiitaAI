import { create } from "zustand"
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useEffect } from "react"

/**
 * Counts the sheets that are open. A bottom sheet covers the tab pill and the mini player in the
 * prototype (the sheet layer sits above both), so while a sheet is open they fade out instead of
 * floating over it.
 */
export const useSheetCover = create<{ count: number }>(() => ({ count: 0 }))

export function coverSheet(): () => void {
  useSheetCover.setState((s) => ({ count: s.count + 1 }))
  return () => useSheetCover.setState((s) => ({ count: Math.max(0, s.count - 1) }))
}

/** Opacity for a floating bar: 1, fading to 0 while a sheet is open. */
export function useCoverFade() {
  const covered = useSheetCover((s) => s.count > 0)
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withTiming(covered ? 0 : 1, { duration: 180 })
  }, [covered, opacity])
  return useAnimatedStyle(() => ({ opacity: opacity.value }))
}
