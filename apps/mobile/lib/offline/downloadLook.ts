/**
 * The look of "downloaded", kept apart from the components so a test can pin it: Save is an ORANGE
 * disc with a CHECK; Download is a GREEN disc with an arrow-down-to-tray. They must never be
 * confused, in either theme, and never by colour alone (the glyph differs too).
 */
import { amColors } from "@/constants/tokens/amColors"

/** a plain arrow-down inside the outline circle: "download" (idle) */
export const DOWNLOAD_ARROW_PATH = "M12 7v8.2M8.4 11.8l3.6 3.6 3.6-3.6"
/** the arrow-down-to-tray glyph on the done disc: "downloaded" (the tray is what a check is not) */
export const DOWNLOADED_GLYPH = "M12 5.6v8M8.4 10.6l3.6 3.6 3.6-3.6M7.6 18h8.8"
/** the check of the Save disc (components/save/SaveMark.tsx) */
export const SAVED_CHECK_PATH = "M7.4 12.4l3.3 3.3 6-6.6"

/** the done disc is the forest green of the palette (sage700), NOT the orange700 of the save disc */
export const DOWNLOADED_FILL = amColors.sage700
export const DOWNLOADED_GLYPH_COLOR = amColors.white
/** light edge of the done disc on a dark ground (sage700 alone is only 2.3:1 on the Dark page) */
export const DOWNLOADED_EDGE_ON_DARK = amColors.sage300
export const SAVED_FILL = amColors.orange700
