import { Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { screenTopInset, sheetTopInset } from "@/lib/screenTop"

/**
 * Top padding for a CARD screen (a pushed page, a tab): clears the status bar and the Dynamic Island.
 * Use it for the first row's `paddingTop`. One rule for every screen: lib/screenTop.ts.
 */
export function useScreenTop(): number {
  return screenTopInset(useSafeAreaInsets().top)
}

/** Top padding for a screen in MODAL presentation (a sheet with a grabber and a close button). */
export function useSheetTop(): number {
  return sheetTopInset(useSafeAreaInsets().top, Platform.OS)
}
