/**
 * Cover-tinted Player ground. The app has no per-song artwork yet, so a song takes one of six
 * pictures (the same formula the Home shelves use, so a song keeps its picture across screens) and
 * the Player takes the tone of that picture.
 * TODO(api): read the tone from the real cover (a palette from the image) once covers come from the API.
 */

export const COVER_IDS = ["lake", "garland", "portrait", "lotus", "seated", "guitar"] as const
export type CoverId = (typeof COVER_IDS)[number]

/** The Player forest (amColors.sage900); the tint falls back to it when no song is playing. */
export const FOREST = "#20281A"

/**
 * Hand-picked tones, one per picture: dark enough that white text on them passes WCAG AA (4.5:1) and
 * different enough from each other that a change of song is visible.
 */
export const COVER_TINTS: Record<CoverId, string> = {
  lake: "#6B3F33",
  garland: "#6A4531",
  portrait: "#2C3A4E",
  lotus: "#3F5018",
  seated: "#5E4A3A",
  guitar: "#625B1F",
}

/** A stable picture for a song number (same formula as lib/homeShelves coverFor). */
export function coverIdFor(number: number): CoverId {
  const n = Math.abs(Math.trunc(number)) || 0
  return COVER_IDS[(n * 7 + 3) % COVER_IDS.length]!
}

/** The tone of a song's cover, or the forest when nothing plays. */
export function tintForSong(number: number | null | undefined): string {
  return number == null ? FOREST : COVER_TINTS[coverIdFor(number)]
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** "#RRGGBB" and an alpha as an rgba() string. */
export function hexAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Linear mix of two hex colours: t=0 is `a`, t=1 is `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  const k = Math.min(1, Math.max(0, t))
  const ch = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0")
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`.toUpperCase()
}

/** WCAG relative luminance of a hex colour. */
function luminance(hex: string): number {
  const lin = parseHex(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
}

/** WCAG contrast ratio between two hex colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}
