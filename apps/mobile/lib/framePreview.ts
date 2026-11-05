/**
 * Browser preview only (public/phone.html). The phone frame draws the status bar, the Dynamic Island and the
 * home indicator ON TOP of the app, so the app fills the whole screen like on a real iPhone. A browser reports
 * no safe-area insets, so the frame hands them over as data-safe-top / data-safe-bottom on its iframe and
 * the root layout feeds them into the safe-area context. On a device, or in a plain browser tab, nothing here
 * does anything.
 */
export type FrameInsets = { top: number; bottom: number; left: number; right: number }

/** The default of an iPhone with a Dynamic Island. */
export const FRAME_DEFAULT_INSETS: FrameInsets = { top: 59, bottom: 34, left: 0, right: 0 }

function toInset(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * Insets from the iframe's dataset, or null when the page is not inside the phone frame
 * (no dataset, or neither value present).
 */
export function parseFrameInsets(dataset: { safeTop?: string; safeBottom?: string } | null | undefined): FrameInsets | null {
  if (!dataset || (dataset.safeTop === undefined && dataset.safeBottom === undefined)) return null
  return {
    top: toInset(dataset.safeTop, FRAME_DEFAULT_INSETS.top),
    bottom: toInset(dataset.safeBottom, FRAME_DEFAULT_INSETS.bottom),
    left: 0,
    right: 0,
  }
}

/** Reads the frame element of the current page (same origin only). Null everywhere except in phone.html. */
export function readFrameInsets(): FrameInsets | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null
  try {
    if (window.parent === window) return null
    const frame = window.frameElement as HTMLElement | null
    return parseFrameInsets(frame ? (frame.dataset as { safeTop?: string; safeBottom?: string }) : null)
  } catch {
    return null
  }
}

/** Tells the frame whether the status bar and the home indicator should be light (over dark) or dark. */
export function postFrameStatusBar(style: "light" | "dark"): void {
  if (typeof window === "undefined" || window.parent === window) return
  try {
    window.parent.postMessage({ type: "ps-status-bar", style }, "*")
  } catch {
    // no frame, nothing to tell
  }
}
