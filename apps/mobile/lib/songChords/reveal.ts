/**
 * Keep the word being edited in sight above the docked chord sheet. All numbers are window coordinates (what
 * `measureInWindow` gives) plus the scroll offset; the answer is the offset to scroll to, or null when the word is
 * already comfortably visible. When it has to move, it is centred in the free part above the sheet, so that stepping to
 * the next word does not need a scroll every time.
 */
export type RevealInput = {
  itemTop: number
  itemBottom: number
  /** the scroll view's top and bottom edge in the window */
  viewTop: number
  viewBottom: number
  /** how much of the bottom of the scroll view the sheet covers */
  covered: number
  offset: number
  /** air kept above and below the word */
  margin?: number
  /** the scrollable height, so the offset can be clamped (optional) */
  maxOffset?: number
}

export function revealOffset(input: RevealInput): number | null {
  const margin = input.margin ?? 32
  const freeBottom = input.viewBottom - Math.max(0, input.covered)
  const free = freeBottom - input.viewTop
  if (free <= 0) return null
  const tooHigh = input.itemTop - margin < input.viewTop
  const tooLow = input.itemBottom + margin > freeBottom
  if (!tooHigh && !tooLow) return null
  const itemMiddle = (input.itemTop + input.itemBottom) / 2
  const wantedMiddle = input.viewTop + free / 2
  let next = input.offset + (itemMiddle - wantedMiddle)
  if (input.maxOffset !== undefined) next = Math.min(next, input.maxOffset)
  next = Math.max(0, next)
  return Math.abs(next - input.offset) < 1 ? null : next
}
