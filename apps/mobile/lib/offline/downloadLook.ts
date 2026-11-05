/**
 * The look of the download mark, kept apart from the components so a test can pin it.
 *
 * Shape: a ROUNDED SQUARE with an arrow (lucide "square-arrow-down"). Save is a CIRCLE (circle-plus, then a
 * filled orange circle-check), so the two can never be confused: the shape differs, the colour differs
 * (green, not orange) and the glyph differs (an arrow on a tray line, never a check).
 *   idle         square outline + arrow-down
 *   downloading  the square outline fills clockwise from the top (progress), percent inside
 *   done         solid green square, arrow-down-to-tray in the contrast colour
 * Colours per theme keep every icon part at 3:1 or more against the page and the card:
 *   Light: sage700 fill (6.9:1 on the page), white glyph (8.3:1 on the fill), orange700 progress (4.2:1)
 *   Dark:  sage300 fill (11.2:1 on the page), sage900 glyph (9.1:1 on the fill), orange500 progress (6.9:1)
 * (orange500 on the Light page is only 2.3:1, so Light uses orange700 for the running outline.)
 */
import { amColors } from "@/constants/tokens/amColors"

/** the rounded square, drawn from the top centre clockwise so the progress outline starts at 12 o'clock */
export const DOWNLOAD_SQUARE_PATH = "M12 3H16a5 5 0 0 1 5 5V16a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Z"
/** length of the square outline: 32 of straight edge plus four quarter arcs of radius 5 (for the progress dash) */
export const DOWNLOAD_SQUARE_LENGTH = 32 + 2 * Math.PI * 5
/** the arrow-down inside the square outline: "download" (idle) */
export const DOWNLOAD_ARROW_PATH = "M12 8v7.5M8.5 12.2l3.5 3.5 3.5-3.5"
/** the arrow-down-to-tray on the done square: "downloaded" (the tray line is what a check is not) */
export const DOWNLOADED_GLYPH = "M12 6.8v7.4M8.6 11l3.4 3.4 3.4-3.4M8 17.4h8"
/** the check of the Save disc (components/save/SaveMark.tsx) */
export const SAVED_CHECK_PATH = "M7.4 12.4l3.3 3.3 6-6.6"

/** the done square is the forest green of the palette (sage700) in Light, NOT the orange700 of the save disc */
export const DOWNLOADED_FILL = amColors.sage700
export const DOWNLOADED_GLYPH_COLOR = amColors.white
/** on a dark ground sage700 is only 2.3:1, so the done square turns pale sage with a dark glyph */
export const DOWNLOADED_FILL_ON_DARK = amColors.sage300
export const DOWNLOADED_GLYPH_ON_DARK = amColors.sage900
export const SAVED_FILL = amColors.orange700

/** the running outline: orange700 on Light (4.2:1), orange500 on Dark (6.9:1) */
export const DOWNLOAD_PROGRESS = amColors.orange700
export const DOWNLOAD_PROGRESS_ON_DARK = amColors.orange500

/** the empty part of the running outline (decoration: the percent and the label carry the state) */
export const DOWNLOAD_TRACK = amColors.sand400
export const DOWNLOAD_TRACK_ON_DARK = "#4A4540"

/** Colours of the done square and the running outline for a ground. */
export function downloadColors(dark: boolean): { fill: string; glyph: string; progress: string; track: string } {
  return dark
    ? { fill: DOWNLOADED_FILL_ON_DARK, glyph: DOWNLOADED_GLYPH_ON_DARK, progress: DOWNLOAD_PROGRESS_ON_DARK, track: DOWNLOAD_TRACK_ON_DARK }
    : { fill: DOWNLOADED_FILL, glyph: DOWNLOADED_GLYPH_COLOR, progress: DOWNLOAD_PROGRESS, track: DOWNLOAD_TRACK }
}
