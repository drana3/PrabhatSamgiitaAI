import Svg, { Circle, Path } from "react-native-svg"

/**
 * The prototype's own icons (Main.dc.html, 24 x 24 viewBox, `.app svg`: no fill, currentColor
 * stroke 1.75, round caps and joins). Drawn here with the same path data so sizes and weights match
 * the boards; lucide's glyphs are heavier and larger.
 */
type GlyphProps = { size?: number; color: string; strokeWidth?: number }

function Stroke({ d, size = 22, color, strokeWidth = 1.75 }: GlyphProps & { d: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** `.f` class: filled with currentColor, no stroke. */
export function PlayGlyph({ size = 18, color }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5l11 7-11 7z" fill={color} />
    </Svg>
  )
}

export const PlusGlyph = (p: GlyphProps) => <Stroke size={18} {...p} d="M12 5v14M5 12h14" />
export const ChevronRightGlyph = (p: GlyphProps) => <Stroke size={22} {...p} d="M9 5l7 7-7 7" />
export const BackGlyph = (p: GlyphProps) => <Stroke size={22} {...p} d="M15 5l-7 7 7 7" />
export const SortGlyph = (p: GlyphProps) => (
  <Stroke size={20} {...p} d="M7 5v14M7 19l-3-3M7 19l3-3M17 19V5M17 5l-3 3M17 5l3 3" />
)
export const CloseGlyph = (p: GlyphProps) => <Stroke size={20} {...p} d="M6 6l12 12M18 6L6 18" />

export function SearchGlyph({ size = 20, color, strokeWidth = 1.75 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={6.5} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M16 16l4.5 4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  )
}
