/**
 * THE rule for the space at the top of a screen: content starts below the status bar, the camera cut-out and the
 * Dynamic Island. Pure, so it is unit tested (__tests__/screenTop.test.ts); screens call useScreenTop() or
 * useSheetTop() (hooks/useScreenTop.ts) and never write `Platform.OS === "web" ? 54 : insets.top` themselves.
 *
 * Why this exists. Screens used to hard-code the browser case (`web ? 54`, or `web ? 24` on the modal sheets), from
 * the days when the preview had no safe area. Now the phone frame (public/phone.html) draws the status bar and the
 * island over the app and hands the app the real insets (lib/framePreview.ts, 59 at the top), so a hard-coded
 * number is wrong: the Upload sheet's close button sat behind the battery and its eyebrow touched the island.
 * The real inset always wins; a number is only the fallback for where no inset is reported.
 */

/** The status bar area of the prototype, used where no inset is reported (a plain browser tab, an old Android). */
export const SCREEN_TOP_FALLBACK = 54

/** Smallest top padding of a sheet on a phone: the grabber needs air even where the system reports no inset. */
export const SHEET_TOP_MIN_NATIVE = 16

/** Top padding of a sheet in a plain browser tab (no frame, no inset). */
export const SHEET_TOP_MIN_WEB = 24

/** Height of the close button of a sheet; the sheet's top row reserves it so nothing sits beside the button. */
export const SHEET_CLOSE_SIZE = 40

/** Air under the top row of a sheet. */
export const SHEET_BAR_GAP = 6

/**
 * Top padding of a screen that is a card (a pushed page, a tab): the reported inset, else the fallback.
 * `insetTop` is what useSafeAreaInsets() says, which inside the phone frame is the frame's 59.
 */
export function screenTopInset(insetTop: number): number {
  return insetTop > 0 ? insetTop : SCREEN_TOP_FALLBACK
}

/**
 * Top padding of a screen in modal presentation (Upload, Add recording, Content rules ...). On iOS a page sheet is
 * drawn under the status bar already and reports a small or zero inset, so it keeps a minimum for the grabber; in the
 * browser preview a modal is a full-screen card under the island, so the frame's inset is used as it is.
 */
export function sheetTopInset(insetTop: number, platform: string): number {
  const min = platform === "web" ? SHEET_TOP_MIN_WEB : SHEET_TOP_MIN_NATIVE
  return platform === "web" ? (insetTop > 0 ? insetTop : min) : Math.max(insetTop, min)
}

/** Height of the top row of a sheet: its padding, the close button and the gap. Content starts below it. */
export function sheetBarHeight(top: number): number {
  return top + SHEET_CLOSE_SIZE + SHEET_BAR_GAP
}
