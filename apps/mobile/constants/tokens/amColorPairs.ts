import { amColors, amDark, amDarkSurface, amLight, amPhotoChip } from "./amColors"

/**
 * The colour system as data: every text/background pair the app may use, per theme, with the
 * minimum WCAG contrast it must reach. `__tests__/colorPairs.test.ts` computes the ratios, so a
 * token change that breaks a pair fails the build. docs/ui-colour-system.md explains the rules.
 *
 * Rules in one breath:
 *  - neutrals (sand / near-black) are about 80% of a screen; forest green is deep tiles only
 *    (up to 10%); orange is the ONE action fill, the selected chip/tab pill and small accents
 *    (up to 10%). At most one orange-filled button per view.
 *  - text on neutrals: heading / body / muted. ink400, ink300, ink200 are never text colours.
 *  - action fill = `brand` (orange700) with WHITE text, in Light and Dark. Pressed = orange800.
 *  - bright orange500 is graphics only (icons, progress, dots, glows) or accent TEXT on dark.
 *  - dark text only on light tints (luminance above 0.8); white text only on deep fills.
 *  - text over a photo always sits on a scrim; chips on photos are neutral only.
 */

export type PairKind = "text" | "largeText" | "graphic" | "decor"

/** Minimum contrast per kind: AA body text, AA large text, WCAG non-text, and the floor for decoration. */
export const amPairMin: Record<PairKind, number> = { text: 4.5, largeText: 3, graphic: 3, decor: 2.2 }

export interface AmColorPair {
  theme: "light" | "dark" | "both"
  /** what it is, for the docs table */
  role: string
  fg: string
  bg: string
  kind: PairKind
  /** colour the (translucent) bg sits on, for glass and scrims; default the bg itself */
  over?: string
}

const L = amLight
const D = amDark
const S = amDarkSurface
const c = amColors

function pair(theme: AmColorPair["theme"], role: string, fg: string, bg: string, kind: PairKind, over?: string): AmColorPair {
  return { theme, role, fg, bg, kind, over }
}

/** Light-theme surfaces text may sit on. */
const lightFlat = [
  ["page", L.page],
  ["raised", L.raised],
  ["card", L.card],
] as const
/** Light tints: dark text only. */
const lightTints = [
  ["peach", c.tintPeach],
  ["tintGreen", c.tintGreen],
  ["olive100", c.olive100],
  ["sage200", c.sage200],
  ["gold300", c.gold300],
] as const
const darkFlat = [
  ["page", S.page],
  ["raised", S.raised],
  ["card", S.card],
  ["inner", S.inner],
] as const

export const amColorPairs: AmColorPair[] = [
  // ---- Light: text on neutral surfaces
  ...lightFlat.flatMap(([n, bg]) => [
    pair("light", `heading on ${n}`, L.textHeading, bg, "text"),
    pair("light", `body on ${n}`, L.textBody, bg, "text"),
    pair("light", `muted on ${n}`, L.textMuted, bg, "text"),
    pair("light", `accent text / eyebrow on ${n}`, L.accentText, bg, "text"),
    pair("light", `error text on ${n}`, L.dangerText, bg, "text"),
  ]),
  pair("light", "two-tone heading second line on page", L.headingSecond, L.page, "largeText"),
  pair("light", "two-tone heading second line on card", L.headingSecond, L.card, "largeText"),
  // ---- Light: tinted tiles (dark text, accent text orange800 only)
  ...lightTints.flatMap(([n, bg]) => [
    pair("light", `heading on ${n} tile`, c.ink800, bg, "text"),
    pair("light", `accent text on ${n} tile`, c.orange800, bg, "text"),
  ]),
  ...lightTints
    .filter(([n]) => n !== "gold300")
    .map(([n, bg]) => pair("light", `body on ${n} tile`, c.ink600, bg, "text")),
  pair("light", "body on gold300 tile", c.ink600, c.gold300, "text"),
  pair("light", "muted on peach tile", c.ink500, c.tintPeach, "text"),
  pair("light", "muted on tintGreen tile", c.ink500, c.tintGreen, "text"),
  pair("light", "heading two-tone second line on peach page wash", L.headingSecond, c.tintPeach, "largeText"),
  // ---- Light: action fill and deep tiles (white text only)
  pair("light", "label on action fill (orange700)", L.onBrand, L.brand, "text"),
  pair("light", "label on pressed action fill (orange800)", L.onBrand, L.brandPress, "text"),
  pair("light", "white on forest tile (sage900)", c.white, c.sage900, "text"),
  pair("light", "sand50 on forest tile (sage800)", c.sand50, c.sage800, "text"),
  pair("light", "gold300 eyebrow on forest tile (sage900)", c.gold300, c.sage900, "text"),
  pair("light", "tintGreen on forest tile (sage800)", c.tintGreen, c.sage800, "text"),
  // ---- Light: graphics. Meaningful icons use `brand`; bright orange is decoration (it sits beside text)
  ...lightFlat.map(([n, bg]) => pair("light", `action-coloured icon on ${n}`, L.brand, bg, "graphic")),
  ...lightFlat.map(([n, bg]) => pair("light", `bright orange decor (progress, dots, glows) on ${n}`, L.accentBright, bg, "decor")),
  pair("light", "action fill against the page", L.brand, L.page, "graphic"),
  // the DOWNLOADED disc (forest green sage700, white arrow-to-tray glyph; the Save disc is orange)
  pair("light", "white glyph on downloaded disc (sage700)", c.white, c.sage700, "graphic"),
  pair("light", "downloaded disc (sage700) against the page", c.sage700, L.page, "graphic"),
  pair("light", "downloaded disc (sage700) against a card", c.sage700, L.card, "graphic"),

  // ---- Dark: text on neutral surfaces
  ...darkFlat.flatMap(([n, bg]) => [
    pair("dark", `heading on ${n}`, D.textHeading, bg, "text"),
    pair("dark", `body on ${n}`, D.textBody, bg, "text"),
    pair("dark", `muted on ${n}`, D.textMuted, bg, "text"),
    pair("dark", `accent text on ${n} (orange500)`, D.accentText, bg, "text"),
    pair("dark", `eyebrow on ${n} (gold300)`, D.eyebrow, bg, "text"),
    pair("dark", `error text on ${n}`, D.dangerText, bg, "text"),
    pair("dark", `bright orange graphics on ${n}`, D.accentBright, bg, "graphic"),
  ]),
  // `tile` (progress tracks, pressed fills): body, never muted
  pair("dark", "heading on tile", S.heading, S.tile, "text"),
  pair("dark", "body on tile (muted is NOT allowed here)", S.body, S.tile, "text"),
  pair("dark", "accent text on tile (orange500)", D.accentText, S.tile, "text"),
  pair("dark", "heading on peach tile", S.heading, S.peach, "text"),
  pair("dark", "body on peach tile", S.body, S.peach, "text"),
  pair("dark", "accent text on peach tile", D.accentText, S.peach, "text"),
  pair("dark", "two-tone heading second line on page", D.headingSecond, S.page, "largeText"),
  // ---- Dark: action fill, white label
  pair("dark", "label on action fill (orange700)", D.onBrand, D.brand, "text"),
  pair("dark", "label on pressed action fill (orange800)", D.onBrand, D.brandPress, "text"),
  pair("dark", "action fill against the page", D.brand, S.page, "graphic"),
  pair("dark", "action fill against a card", D.brand, S.card, "graphic"),
  pair("dark", "action fill against an inner surface", D.brand, S.inner, "graphic"),
  // the DOWNLOADED disc in Dark: sage700 alone is 2.3:1 on the page, so it carries a sage300 edge
  pair("dark", "white glyph on downloaded disc (sage700)", c.white, c.sage700, "graphic"),
  pair("dark", "downloaded disc edge (sage300) against the page", c.sage300, S.page, "graphic"),
  pair("dark", "downloaded disc edge (sage300) against a card", c.sage300, S.card, "graphic"),
  pair("dark", "ink label on a light control in dark", S.onLight, c.sand50, "text"),

  // ---- Both: photographs. Scrims and neutral chips only.
  pair("both", "white title on bottom photo scrim (worst case: white photo)", "#FFFFFF", "rgba(0, 0, 0, 0.72)", "text", "#FFFFFF"),
  // the top scrim is lighter; a pure-white photo is out of scope, so a bright photo (#C8C8C8) is the worst case
  pair("both", "white label on top photo scrim (worst case: bright photo)", "#FFFFFF", "rgba(0, 0, 0, 0.45)", "text", "#C8C8C8"),
  pair("both", "white label on dark-glass chip over a photo", amPhotoChip.glass.fg, amPhotoChip.glass.bg, "text", "#FFFFFF"),
  pair("both", "ink800 label on white chip over a photo", amPhotoChip.white.fg, amPhotoChip.white.bg, "text"),
]

export interface AmForbiddenPair {
  fg: string
  bg: string
  why: string
  /** "contrast": the pair fails WCAG and must measure below 4.5. "rule": it may pass but the system bans it. */
  reason: "contrast" | "rule"
}

/** Pairs the app must never render. The test checks these are not in `amColorPairs` and (for "contrast") really fail. */
export const amForbiddenPairs: AmForbiddenPair[] = [
  { fg: L.onBrand, bg: L.accentBright, why: "white on bright orange500: 2.73:1", reason: "contrast" },
  { fg: c.white, bg: c.orange600, why: "white on orange600: 3.47:1; mid-tone fills never carry text", reason: "contrast" },
  { fg: c.white, bg: c.gold500, why: "white on gold500: mid-tone fill", reason: "contrast" },
  { fg: c.ink900, bg: c.orange500, why: "dark text on bright orange: passes numerically (6.1) but banned, Dada dislikes it", reason: "rule" },
  { fg: c.ink800, bg: c.orange700, why: "dark text on the action fill: 2.48:1", reason: "contrast" },
  { fg: c.ink400, bg: L.page, why: "ink400 text on sand200: 2.36:1 (was textMuted)", reason: "contrast" },
  { fg: c.ink300, bg: L.page, why: "ink300 is never a text colour", reason: "contrast" },
  { fg: c.ink200, bg: L.page, why: "ink200 is never a text colour", reason: "contrast" },
  { fg: c.orange700, bg: L.page, why: "orange700 text on sand200: 4.22:1; accent text is orange800", reason: "contrast" },
  { fg: c.orange700, bg: c.tintPeach, why: "orange700 text on peach: 3.95:1; accent text is orange800", reason: "contrast" },
  { fg: c.orange500, bg: L.card, why: "bright orange500 as text on light: 2.73:1", reason: "contrast" },
  { fg: c.danger, bg: L.page, why: "danger #EC221F as text on sand200: 3.62:1; error text is dangerText", reason: "contrast" },
  { fg: S.muted, bg: S.tile, why: "muted dark text on the tile fill: 4.38:1; use body", reason: "contrast" },
  { fg: c.orange700, bg: S.page, why: "orange700 as text on the dark page: 3.71:1; accent text on dark is orange500 or gold300", reason: "contrast" },
]
