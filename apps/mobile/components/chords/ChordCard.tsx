import { useMemo } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg"

import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useT } from "@/lib/i18n"
import { diagramOf, guitarFingering, DIAGRAM_ROWS } from "@/lib/chordCard/guitar"
import { CHORD_INSTRUMENTS, distinctChords, type ChordInstrument } from "@/lib/chordCard/instrument"
import { chordKeys, isWhite, keyWindow, swaraOfKey, whiteKeyCount, chordSwaraLine, type LitKey } from "@/lib/chordCard/keys"
import { chordNoteLine, chordSpec } from "@/lib/chordCard/theory"

/**
 * THE chord card (docs/chord-card.md): one chord drawn for one instrument.
 *
 *   <ChordCard chord="F#m" instrument="guitar" />
 *
 * - `guitar`: the fingering as a fretboard diagram (open and muted strings, the dots, a bar for a barre chord);
 * - `piano`: the keys of the chord lit on a keyboard (root in the strong colour), with the note names;
 * - `harmonium`: the same keys on a harmonium keyboard, with the swara of each key (Sa Re Ga ...) for the Sa in use.
 *
 * `size="large"` is the card of the sheet; `size="compact"` is the small card of a strip of all the chords of a tune.
 * The chord is any name the app's chord picker produces; a name the card cannot draw (it is not major, minor, 7, m7, maj7,
 * sus2, sus4, dim, aug or add9) shows its name and one honest line instead of a wrong picture. Colours come from the
 * song theme, so dark mode follows by itself; nothing here is timed or animated.
 */
export function ChordCard({
  chord,
  instrument,
  size = "large",
  sa = 0,
  t: themeProp,
}: {
  chord: string
  instrument: ChordInstrument
  size?: "large" | "compact"
  /** the Sa of the harmonium as a pitch class (0 = C, the default: the white keys are Sa Re Ga Ma Pa Dha Ni) */
  sa?: number
  /** the theme; the song theme of the current appearance when left out */
  t?: SpTheme
}) {
  const own = useSpTheme()
  const t = themeProp ?? own
  const tr = useT()
  const spec = useMemo(() => chordSpec(chord), [chord])
  const large = size === "large"
  const kind = spec ? tr(`chordCard.kind.${spec.kind}`) : ""
  const notes = chordNoteLine(chord)
  const swaras = instrument === "harmonium" ? chordSwaraLine(chord, sa) : ""
  const spoken = spec
    ? tr(`chordCard.a11y.${instrument}`, { chord: spec.name, kind, notes })
    : tr("chordCard.a11y.unknown", { chord })

  return (
    <View
      style={[styles.card, large ? styles.cardLarge : styles.cardCompact, { backgroundColor: t.sand100, borderColor: t.sand400 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={spoken}
      testID={`chord-card-${chord}`}
    >
      <Text style={[large ? styles.nameLarge : styles.nameCompact, { color: t.ink900 }]} numberOfLines={1}>
        {chord}
      </Text>
      {large && spec ? <Text style={[styles.kind, { color: t.ink800 }]}>{kind}</Text> : null}
      {spec ? (
        <>
          {instrument === "guitar" ? <GuitarDiagram chord={chord} t={t} large={large} /> : <KeysDiagram chord={chord} t={t} large={large} harmonium={instrument === "harmonium"} sa={sa} />}
          {large ? (
            <View style={styles.facts}>
              <Text style={[styles.fact, { color: t.ink900 }]}>{tr("chordCard.notes", { notes })}</Text>
              {swaras ? <Text style={[styles.fact, { color: t.ink800 }]}>{tr("chordCard.swaras", { swaras })}</Text> : null}
              {instrument === "guitar" ? <GuitarNote chord={chord} t={t} /> : null}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={[styles.none, { color: t.ink800 }]}>{tr("chordCard.none")}</Text>
      )}
    </View>
  )
}

function GuitarNote({ chord, t }: { chord: string; t: SpTheme }) {
  const tr = useT()
  const fingering = guitarFingering(chord)
  if (!fingering) return null
  const pressed = fingering.frets.filter((f) => f > 0)
  const base = pressed.length ? Math.min(...pressed) : 1
  const parts = [fingering.barre ? tr("chordCard.guitar.barre") : fingering.open ? tr("chordCard.guitar.open") : "", base > 3 || (fingering.barre && base > 1) ? tr("chordCard.guitar.fret", { n: base }) : "", fingering.frets.includes(-1) ? tr("chordCard.guitar.muted") : ""].filter(Boolean)
  return parts.length ? <Text style={[styles.fact, { color: t.ink800 }]}>{parts.join(" · ")}</Text> : null
}

/* ---------------- guitar ---------------- */

const G_W = 120
const G_H = 140
const G_LEFT = 26
const G_GAP = 14
const G_TOP = 30
const G_ROW = 20

function GuitarDiagram({ chord, t, large }: { chord: string; t: SpTheme; large: boolean }) {
  const fingering = guitarFingering(chord)
  const diagram = useMemo(() => (fingering ? diagramOf(fingering.frets, fingering.barre) : null), [fingering])
  if (!fingering || !diagram) return null
  const x = (string: number) => G_LEFT + string * G_GAP
  const y = (row: number) => G_TOP + row * G_ROW
  const width = large ? 168 : 84
  const height = Math.round((width * G_H) / G_W)
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${G_W} ${G_H}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* the nut, or the number of the first fret when the shape sits higher up */}
      {diagram.baseFret === 1 ? <Line x1={x(0) - 1} y1={y(0)} x2={x(5) + 1} y2={y(0)} stroke={t.ink900} strokeWidth={4} /> : null}
      {Array.from({ length: DIAGRAM_ROWS + 1 }, (_, r) => (diagram.baseFret === 1 && r === 0 ? null : <Line key={`h${r}`} x1={x(0)} y1={y(r)} x2={x(5)} y2={y(r)} stroke={t.ink500} strokeWidth={1.2} />))}
      {Array.from({ length: 6 }, (_, s) => (
        <Line key={`v${s}`} x1={x(s)} y1={y(0)} x2={x(s)} y2={y(DIAGRAM_ROWS)} stroke={t.ink500} strokeWidth={1.2} />
      ))}
      {diagram.baseFret > 1 ? (
        <SvgText x={x(5) + 8} y={y(0) + G_ROW * 0.68} fontSize={13} fontFamily={amFonts.bold} fill={t.ink900}>
          {`${diagram.baseFret}fr`}
        </SvgText>
      ) : null}
      {diagram.barre ? <Line x1={x(diagram.barre.from)} y1={y(diagram.barre.row - 1) + G_ROW / 2} x2={x(diagram.barre.to)} y2={y(diagram.barre.row - 1) + G_ROW / 2} stroke={t.action} strokeWidth={11} strokeLinecap="round" /> : null}
      {diagram.dots.map((d) => (
        <Circle key={`d${d.string}`} cx={x(d.string)} cy={y(d.row - 1) + G_ROW / 2} r={6.2} fill={t.action} />
      ))}
      {diagram.open.map((s) => (
        <Circle key={`o${s}`} cx={x(s)} cy={G_TOP - 12} r={4.6} fill="none" stroke={t.ink900} strokeWidth={1.6} />
      ))}
      {diagram.muted.map((s) => (
        <G key={`m${s}`}>
          <Line x1={x(s) - 4} y1={G_TOP - 16} x2={x(s) + 4} y2={G_TOP - 8} stroke={t.ink900} strokeWidth={1.8} strokeLinecap="round" />
          <Line x1={x(s) + 4} y1={G_TOP - 16} x2={x(s) - 4} y2={G_TOP - 8} stroke={t.ink900} strokeWidth={1.8} strokeLinecap="round" />
        </G>
      ))}
    </Svg>
  )
}

/* ---------------- piano and harmonium ---------------- */

const PIANO = { white: "#FBF8F4", black: "#1E1E1E", edge: "#8C857E", frame: "#D8D1CA" }
const HARMONIUM = { white: "#F4E6C8", black: "#3B2417", edge: "#7A5632", frame: "#9A6B3E" }

function KeysDiagram({ chord, t, large, harmonium, sa }: { chord: string; t: SpTheme; large: boolean; harmonium: boolean; sa: number }) {
  const lit = useMemo(() => chordKeys(chord), [chord])
  const window = useMemo(() => keyWindow(lit), [lit])
  const palette = harmonium ? HARMONIUM : PIANO
  const whites = useMemo(() => {
    const out: number[] = []
    for (let midi = window.start; midi <= window.end; midi += 1) if (isWhite(midi)) out.push(midi)
    return out
  }, [window])
  const count = whiteKeyCount(window)
  const width = large ? 304 : 164
  const wWidth = width / count
  const wHeight = large ? 112 : 64
  const bWidth = wWidth * 0.6
  const bHeight = wHeight * 0.6
  const byMidi = new Map<number, LitKey>(lit.map((k) => [k.midi, k]))
  const fillOf = (midi: number, base: string) => {
    const key = byMidi.get(midi)
    return !key ? base : key.isRoot ? t.action : t.orange500
  }
  const textOf = (midi: number) => (byMidi.get(midi)?.isRoot ? t.onAction : "#1E1E1E")
  const label = (key: LitKey) => (harmonium ? swaraOfKey(key.midi, sa) : key.name)
  // x of a white key by its place in the row; a black key sits on the line between two whites
  const whiteIx = (midi: number) => whites.indexOf(midi)
  const blacks: number[] = []
  for (let midi = window.start; midi <= window.end; midi += 1) if (!isWhite(midi)) blacks.push(midi)
  const pad = 3
  return (
    <Svg width={width + pad * 2} height={wHeight + pad * 2} viewBox={`${-pad} ${-pad} ${width + pad * 2} ${wHeight + pad * 2}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={-pad} y={-pad} width={width + pad * 2} height={wHeight + pad * 2} rx={6} fill={palette.frame} />
      {whites.map((midi, i) => (
        <Rect key={`w${midi}`} x={i * wWidth + 0.5} y={0} width={wWidth - 1} height={wHeight} rx={2.5} fill={fillOf(midi, palette.white)} stroke={palette.edge} strokeWidth={0.8} />
      ))}
      {blacks.map((midi) => {
        const left = whiteIx(midi - 1)
        const cx = (left + 1) * wWidth
        return <Rect key={`b${midi}`} x={cx - bWidth / 2} y={0} width={bWidth} height={bHeight} rx={2} fill={fillOf(midi, palette.black)} stroke={byMidi.has(midi) ? "#1E1E1E" : palette.black} strokeWidth={byMidi.has(midi) ? 1.2 : 0} />
      })}
      {large
        ? lit.map((key) => {
            const white = isWhite(key.midi)
            const cx = white ? whiteIx(key.midi) * wWidth + wWidth / 2 : (whiteIx(key.midi - 1) + 1) * wWidth
            const cy = white ? wHeight - 14 : bHeight - 12
            return (
              <SvgText key={`t${key.midi}`} x={cx} y={cy} fontSize={white ? 12 : 10} fontFamily={amFonts.bold} fill={textOf(key.midi)} textAnchor="middle">
                {label(key)}
              </SvgText>
            )
          })
        : null}
    </Svg>
  )
}

/* ---------------- a strip of cards ---------------- */

/**
 * All the chords of a tune at once: a row of small cards that scrolls sideways, each chord once, in the order of the ring.
 * Tap a card (`onOpen`) to open it large.
 */
export function ChordStrip({
  chords,
  instrument,
  onOpen,
  t: themeProp,
  sa = 0,
}: {
  chords: ReadonlyArray<string | null | undefined>
  instrument: ChordInstrument
  onOpen?: (chord: string) => void
  t?: SpTheme
  sa?: number
}) {
  const own = useSpTheme()
  const t = themeProp ?? own
  const list = useMemo(() => distinctChords(chords), [chords])
  const tr = useT()
  if (list.length === 0) return null
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} accessibilityLabel={tr("chordCard.strip")} testID="chord-strip">
      {list.map((chord) => {
        const card = <ChordCard chord={chord} instrument={instrument} size="compact" t={t} sa={sa} />
        return onOpen ? (
          <SpPress key={chord} onPress={() => onOpen(chord)} accessibilityLabel={tr("chordCard.open", { chord })} pressedScale={0.96}>
            {card}
          </SpPress>
        ) : (
          <View key={chord}>{card}</View>
        )
      })}
    </ScrollView>
  )
}

/* ---------------- the instrument picker ---------------- */

/** Guitar, Piano, Harmonium: three pills. The chosen one is filled. */
export function InstrumentPicker({ value, onChange, t: themeProp }: { value: ChordInstrument; onChange: (next: ChordInstrument) => void; t?: SpTheme }) {
  const own = useSpTheme()
  const t = themeProp ?? own
  const tr = useT()
  return (
    <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel={tr("chordCard.instrument.label")} testID="chord-instrument">
      {CHORD_INSTRUMENTS.map((id) => {
        const on = id === value
        return (
          <SpPress
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityLabel={tr(`chordCard.instrument.${id}`)}
            accessibilityState={{ selected: on }}
            pressedScale={0.96}
            style={[styles.pill, { backgroundColor: on ? t.action : "transparent", borderColor: on ? t.action : t.ink800 }]}
          >
            <Text style={[styles.pillText, { color: on ? t.onAction : t.ink900 }]}>{tr(`chordCard.instrument.${id}`)}</Text>
          </SpPress>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { alignItems: "center", borderWidth: 1, borderRadius: 24 },
  cardLarge: { paddingVertical: 24, paddingHorizontal: 16, gap: 12, alignSelf: "stretch" },
  cardCompact: { paddingVertical: 12, paddingHorizontal: 8, gap: 8, minWidth: 112 },
  nameLarge: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 44 },
  nameCompact: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 26 },
  kind: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
  facts: { gap: 4, alignItems: "center" },
  fact: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22, textAlign: "center" },
  none: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20, textAlign: "center", paddingHorizontal: 8 },
  strip: { gap: 8, paddingRight: 16 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { minHeight: 44, minWidth: 44, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
