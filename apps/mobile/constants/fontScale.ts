/**
 * Largest system font scale (iOS Dynamic Type, Android font size) text is allowed to follow where the
 * layout has a fixed height: catalog rows, the tab bar and the mini player. Above this the text stops
 * growing instead of being clipped. Everywhere else text follows the system setting.
 */
export const MAX_FONT_SCALE = 1.3
