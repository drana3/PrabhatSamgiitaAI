/** How far down the page the reader is when the story counts as read. */
export const FINISH_AT = 0.92

/**
 * Reading progress 0..1 from the scroll offset. A page that fits on the screen has nothing to scroll: 0, so a
 * short page is never "finished" just by opening it.
 */
export function readingProgress(offset: number, contentHeight: number, viewHeight: number): number {
  "worklet"
  const scrollable = contentHeight - viewHeight
  if (!(scrollable > 0)) return 0
  const p = offset / scrollable
  return p < 0 ? 0 : p > 1 ? 1 : p
}

export function isFinished(progress: number): boolean {
  "worklet"
  return progress >= FINISH_AT
}
