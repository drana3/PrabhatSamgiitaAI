import { useMemo } from "react"
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg"

import type { AmTheme } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { diagramModel, fingeringFor } from "@/lib/songPage/chords"

const W = 100
const H = 124
const LEFT = 20
const RIGHT = 84
const TOP = 30
const FRET_H = 16
const FRETS = 5
const STRINGS = 6
const STRING_GAP = (RIGHT - LEFT) / (STRINGS - 1)

const sx = (string: number) => LEFT + string * STRING_GAP
const fy = (fret: number) => TOP + (fret - 0.5) * FRET_H

/**
 * Fretboard diagram drawn from data in six layers (grid, nut, barre, dots,
 * open, mute) so it scales and takes the theme. Returns null for a chord with
 * no known fingering.
 */
export function ChordDiagram({ theme, chord, width = 160 }: { theme: AmTheme; chord: string; width?: number }) {
  const model = useMemo(() => {
    const fingering = fingeringFor(chord)
    return fingering ? diagramModel(fingering) : null
  }, [chord])
  if (!model) return null

  const ink = theme.textHeading
  const height = (width * H) / W
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={`Fingering for ${chord}`}>
      <G>
        {Array.from({ length: STRINGS }, (_, i) => (
          <Line
            key={`s${i}`}
            x1={sx(i)}
            y1={TOP}
            x2={sx(i)}
            y2={TOP + FRETS * FRET_H}
            stroke={theme.textMuted}
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: FRETS + 1 }, (_, i) => (
          <Line
            key={`f${i}`}
            x1={LEFT}
            y1={TOP + i * FRET_H}
            x2={RIGHT}
            y2={TOP + i * FRET_H}
            stroke={theme.textMuted}
            strokeWidth={1}
          />
        ))}
      </G>
      {model.baseFret === 1 ? (
        <Rect x={LEFT - 1} y={TOP - 3} width={RIGHT - LEFT + 2} height={4} fill={ink} />
      ) : (
        <SvgText x={4} y={fy(1) + 4} fontSize={11} fontFamily={amFonts.semi} fill={ink}>
          {`${model.baseFret}fr`}
        </SvgText>
      )}
      {model.barre ? (
        <Path
          d={`M ${sx(model.barre.from)} ${fy(model.barre.fret)} L ${sx(model.barre.to)} ${fy(model.barre.fret)}`}
          stroke={ink}
          strokeWidth={9}
          strokeLinecap="round"
        />
      ) : null}
      {model.dots.map((dot) => (
        <Circle key={`d${dot.string}-${dot.fret}`} cx={sx(dot.string)} cy={fy(dot.fret)} r={5} fill={ink} />
      ))}
      {model.open.map((string) => (
        <Circle key={`o${string}`} cx={sx(string)} cy={TOP - 12} r={4} stroke={ink} strokeWidth={1.5} fill="none" />
      ))}
      {model.muted.map((string) => (
        <G key={`m${string}`}>
          <Line x1={sx(string) - 4} y1={TOP - 16} x2={sx(string) + 4} y2={TOP - 8} stroke={ink} strokeWidth={1.5} />
          <Line x1={sx(string) + 4} y1={TOP - 16} x2={sx(string) - 4} y2={TOP - 8} stroke={ink} strokeWidth={1.5} />
        </G>
      ))}
    </Svg>
  )
}
