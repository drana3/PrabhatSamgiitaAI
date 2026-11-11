import Svg, { Circle, Path, Rect } from "react-native-svg"

/** Small line glyphs of the song page that the shared icon set does not have. 24x24, stroked, one colour. */
type GlyphProps = { size?: number; color: string; strokeWidth?: number }

const base = (color: string, strokeWidth: number) => ({ stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" })

/** An arrow leaving a box: "open on the video's own site". */
export function OpenOutGlyph({ size = 20, color, strokeWidth = 1.9 }: GlyphProps) {
  const p = base(color, strokeWidth)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path {...p} d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0116.5 20h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" />
    </Svg>
  )
}

/** A flag: "report this". */
export function FlagGlyph({ size = 20, color, strokeWidth = 1.9 }: GlyphProps) {
  const p = base(color, strokeWidth)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path {...p} d="M6 21V4M6 5h11l-2 4 2 4H6" />
    </Svg>
  )
}

/** A guitar: round body, neck going up to the right. */
export function GuitarGlyph({ size = 20, color, strokeWidth = 1.8 }: GlyphProps) {
  const p = base(color, strokeWidth)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path {...p} d="M11.5 12.5l7.5-7.5M17 3l4 4M15.5 6.5l2 2" />
      <Path {...p} d="M10 9.5c-2.6-.6-5 1.2-5 3.9 0 .9-.5 1.4-1.2 2.1-1.2 1.2-.6 3.2 1 4.2 1.5.9 3.2.9 4.5-.2.6-.5 1.200-.8 2-.8 2.7 0 4.600-2.500 4-5.100" />
      <Circle cx={9.500} cy={14.500} r={1} fill={color} stroke="none" />
    </Svg>
  )
}

/** A harmonium: a box with a row of keys. */
export function HarmoniumGlyph({ size = 20, color, strokeWidth = 1.8 }: GlyphProps) {
  const p = base(color, strokeWidth)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Rect {...p} x={3} y={7} width={18} height={11} rx={2.500} />
      <Path {...p} d="M9 12.500V18M15 12.500V18M3 12.500h18" />
    </Svg>
  )
}

/** A piano keyboard. */
export function PianoGlyph({ size = 20, color, strokeWidth = 1.8 }: GlyphProps) {
  const p = base(color, strokeWidth)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Rect {...p} x={3} y={5} width={18} height={14} rx={2} />
      <Path {...p} d="M8.500 5v8M15.500 5v8M12 13v6" />
    </Svg>
  )
}

/** Two sliders: "tune it" (the key and the capo). */
export function TuneGlyph({ size = 18, color, strokeWidth = 1.9 }: GlyphProps) {
  const p = base(color, strokeWidth)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path {...p} d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <Circle {...p} cx={15} cy={8} r={2} />
      <Circle {...p} cx={9} cy={16} r={2} />
    </Svg>
  )
}
