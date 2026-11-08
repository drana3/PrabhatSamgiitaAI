import { useMemo } from "react"
import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle, Path } from "react-native-svg"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"

/**
 * One ring of a chord cycle (docs/kiirtan-cycle.md): the chords sit on a circle, clockwise from the top, the way a round
 * is played. The chord the round STARTS on is a filled disc with a "Start" tag, so a listener never has to guess where a
 * round begins; the others are outlined. Small arrowheads on the track show the direction. Nothing is ever highlighted
 * as "playing now": a cycle carries no timing.
 *
 * Read-only on a recording page; in the entry screen every place can be tapped (`onPress`) and one can be `selected`.
 * Only transform-free layout and an SVG track: depth comes from the outline and the fill, not from shadows.
 */

/** Centres of `count` places on a circle of radius `r` around (cx, cy), the first at the top, going clockwise. */
export function ringPoints(count: number, r: number, cx: number, cy: number): Array<{ x: number; y: number; angle: number }> {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), angle }
  })
}

/** Disc size for a ring: smaller when there are more places, never under the 44 touch target of the entry screen. */
export function discSize(count: number): number {
  return count <= 5 ? 56 : count <= 6 ? 52 : 48
}

export function CycleRing({
  t,
  chords,
  start,
  size,
  selected,
  onPress,
  centre,
  label,
}: {
  t: SpTheme
  /** chord names; null for a place that is still empty (the entry screen) */
  chords: ReadonlyArray<string | null>
  start: number
  size: number
  selected?: number | null
  onPress?: (slot: number) => void
  /** a short line in the middle of the ring ("x4", "Round") */
  centre?: string
  /** read aloud for the whole ring */
  label: string
}) {
  const tr = useT()
  const disc = discSize(chords.length)
  // the "Start" tag sits above the first disc, so keep room for it at the top
  const pad = 20
  const box = size + pad
  const radius = (size - disc) / 2
  const cx = box / 2
  const cy = pad + size / 2
  const points = useMemo(() => ringPoints(chords.length, radius, cx, cy), [chords.length, radius, cx, cy])
  // an arrowhead half way between two neighbouring places, pointing the way round
  const arrows = useMemo(() => {
    const n = chords.length
    return points.map((p, i) => {
      const a = p.angle + Math.PI / n
      const x = cx + radius * Math.cos(a)
      const y = cy + radius * Math.sin(a)
      const tangent = a + Math.PI / 2
      const s = 5
      const tip = { x: x + s * Math.cos(tangent), y: y + s * Math.sin(tangent) }
      const left = { x: x + s * Math.cos(tangent + 2.5), y: y + s * Math.sin(tangent + 2.5) }
      const right = { x: x + s * Math.cos(tangent - 2.5), y: y + s * Math.sin(tangent - 2.5) }
      return { key: i, d: `M ${left.x.toFixed(1)} ${left.y.toFixed(1)} L ${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L ${right.x.toFixed(1)} ${right.y.toFixed(1)}` }
    })
  }, [points, chords.length, cx, cy, radius])

  return (
    <View style={{ width: box, height: box + 0, alignSelf: "center" }} accessible={!onPress} accessibilityRole={onPress ? undefined : "image"} accessibilityLabel={onPress ? undefined : label} testID="cycle-ring">
      <Svg width={box} height={box} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={cx} cy={cy} r={radius} fill="none" stroke={t.sand400} strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" />
        {arrows.map((a) => (
          <Path key={a.key} d={a.d} fill="none" stroke={t.ink500} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
      {centre ? (
        <View style={[styles.centre, { left: cx - 48, top: cy - 20 }]} pointerEvents="none">
          <Text style={[styles.centreText, { color: t.ink500 }]}>{centre}</Text>
        </View>
      ) : null}
      {points.map((p, i) => {
        const chord = chords[i] ?? null
        const isStart = i === start
        const isSelected = selected === i
        const a11y = chord ? tr("recCycle.slot.a11y", { n: i + 1, chord }) : tr("recCycle.slot.a11y.empty", { n: i + 1 })
        const spoken = isStart ? `${a11y}. ${tr("recCycle.slot.a11y.start")}` : a11y
        const fill = isStart ? t.action : chord ? t.white : "transparent"
        const stroke = isSelected ? t.ink900 : isStart ? t.action : chord ? t.ink800 : t.ink300
        const text = isStart ? t.onAction : t.ink900
        const body = (
          <View style={[styles.disc, { width: disc, height: disc, borderRadius: disc / 2, backgroundColor: fill, borderColor: stroke, borderWidth: isSelected ? 3 : 2, borderStyle: chord ? "solid" : "dashed" }]}>
            <Text style={[styles.chord, { color: text, fontSize: chord && chord.length > 4 ? 13 : 17 }]} numberOfLines={1} adjustsFontSizeToFit>
              {chord ?? "+"}
            </Text>
          </View>
        )
        return (
          <View key={i} style={{ position: "absolute", left: p.x - disc / 2, top: p.y - disc / 2, width: disc, height: disc }}>
            {onPress ? (
              <SpPress onPress={() => onPress(i)} accessibilityLabel={spoken} accessibilityState={{ selected: isSelected }} pressedScale={0.94} style={{ width: disc, height: disc }}>
                {body}
              </SpPress>
            ) : (
              <View accessible={false}>{body}</View>
            )}
            {isStart ? (
              <View style={[styles.tag, { backgroundColor: t.ink900, left: disc / 2 - 24, top: -18 }]} pointerEvents="none">
                <Text style={[styles.tagText, { color: t.white }]}>{tr("recCycle.start.tag")}</Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  disc: { alignItems: "center", justifyContent: "center" },
  chord: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, textAlign: "center", maxWidth: 44 },
  centre: { position: "absolute", width: 96, height: 40, alignItems: "center", justifyContent: "center" },
  centreText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, textAlign: "center" },
  tag: { position: "absolute", width: 48, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tagText: { fontFamily: amFonts.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.8, textTransform: "uppercase" },
})
