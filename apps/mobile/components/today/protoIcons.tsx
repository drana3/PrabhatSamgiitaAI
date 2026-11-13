import Svg, { Circle, Path, Rect } from "react-native-svg"

/**
 * The glyphs of the prototype, drawn with the same paths (24 x 24 viewBox, stroke 1.75, round
 * caps and joins). Outlines take `color` as stroke, solid shapes as fill.
 */
type IconProps = { size?: number; color: string; strokeWidth?: number }

const STROKE = 1.75

export function PlayGlyph({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5l11 7-11 7z" fill={color} />
    </Svg>
  )
}

/** The mini-player variant of the play triangle (slightly left of the other one). */
export function PlayGlyphMini({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5l13 7.5-13 7.5z" fill={color} />
    </Svg>
  )
}

export function PauseGlyph({ size = 22, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="6.5" y="5" width="4" height="14" fill={color} />
      <Rect x="13.5" y="5" width="4" height="14" fill={color} />
    </Svg>
  )
}

export function SearchGlyph({ size = 20, color, strokeWidth = STROKE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="M16 16l4.5 4.5" />
    </Svg>
  )
}

export function ChevronGlyph({ size = 22, color, strokeWidth = STROKE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 5l7 7-7 7" />
    </Svg>
  )
}

/** Tab bar glyphs (Main.dc.html lines 1917-1920). */
export function TabGlyph({ name, size = 22, color }: IconProps & { name: "today" | "songs" | "kiirtan" | "learn" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round">
      {name === "today" ? (
        <Path d="M3 18h18M7 18a5 5 0 0110 0M12 6v3M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8" />
      ) : name === "songs" ? (
        <Path d="M4 6h16M4 12h16M4 18h10" />
      ) : name === "kiirtan" ? (
        <Path d="M4 10v4M8 6.5v11M12 3.5v17M16 7v10M20 10v4" />
      ) : (
        <Path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14" />
      )}
    </Svg>
  )
}
