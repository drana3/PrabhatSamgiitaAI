import { amNav } from "@/constants/tokens/amNav"
import { miniBottomFor } from "@/lib/navV2"

/** Height of the floating action pill (Delete selected / Clear all). */
export const STORAGE_BAR_HEIGHT = 56
/** Quiet gap between the action pill and whatever sits under it. */
export const STORAGE_BAR_GAP = 12

/**
 * Where the action pill sits, measured up from the bottom edge. Alone it floats 28px (or the safe area
 * plus 8) above the bottom. When the floating tab bar and/or the mini-player are showing, the pill goes
 * ABOVE them so nothing ever covers it: the mini-player and the tab bar are drawn above every screen.
 */
export function storageBarBottom(input: { safeBottom: number; miniVisible: boolean; tabBarVisible: boolean }): number {
  const { safeBottom, miniVisible, tabBarVisible } = input
  const alone = Math.max(28, safeBottom + 8)
  if (miniVisible) return miniBottomFor(safeBottom, tabBarVisible) + amNav.miniHeight + STORAGE_BAR_GAP
  if (tabBarVisible) return Math.max(safeBottom, amNav.tabBottom) + amNav.tabHeight + STORAGE_BAR_GAP
  return alone
}

/** Bottom padding of the scrolling list so the last row clears the pill with a little air. */
export function storageListInset(barBottom: number): number {
  return barBottom + STORAGE_BAR_HEIGHT + 24
}
