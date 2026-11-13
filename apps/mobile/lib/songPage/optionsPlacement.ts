/**
 * Where the Aa window sits. It hangs under the "Aa" button; when the room below the button is shorter than the card
 * (the button is far down the screen), it opens upwards from the button instead of being cut off and scrolling. Only
 * when neither side has room does it take the larger side and scroll inside. Pure rules, no React.
 */

/** The one height of every row of the Aa window and of its lists (a touch target with air around it). */
export const OPTION_ROW_HEIGHT = 60

/** The air between the button and the card, and from the card to the screen edge. */
export const POPOVER_GAP = 8
export const POPOVER_EDGE = 24
/** The card never gets shorter than this when it has to scroll. */
export const POPOVER_MIN = 240
/** The card's own padding above the first row and under the last. */
const CARD_PAD = 16
/** What a hint under a row's name adds to that row. */
const HINT_EXTRA = 22

export type PopoverPlacement = { placement: "below" | "above"; top: number | null; bottom: number | null; maxHeight: number }

/** The height of the card for `rows` equal rows, plus `hints` rows that carry a hint under the name. */
export function estimateCardHeight(rows: number, hints = 0): number {
  return CARD_PAD + rows * OPTION_ROW_HEIGHT + hints * HINT_EXTRA
}

export function placePopover(input: { anchorBottom: number; anchorHeight: number; windowHeight: number; cardHeight: number; topInset: number }): PopoverPlacement {
  const { anchorBottom, anchorHeight, windowHeight, cardHeight, topInset } = input
  const below = windowHeight - POPOVER_EDGE - (anchorBottom + POPOVER_GAP)
  const anchorTop = anchorBottom - anchorHeight
  const above = anchorTop - POPOVER_GAP - topInset
  if (below >= cardHeight || below >= above) {
    return { placement: "below", top: anchorBottom + POPOVER_GAP, bottom: null, maxHeight: Math.max(POPOVER_MIN, below) }
  }
  return { placement: "above", top: null, bottom: windowHeight - (anchorTop - POPOVER_GAP), maxHeight: Math.max(POPOVER_MIN, above) }
}
