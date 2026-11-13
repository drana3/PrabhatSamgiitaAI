import { useMemo, type ReactNode } from "react"
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import Svg, { Path } from "react-native-svg"

import { SpIcon } from "@/components/song-v2/SpIcon"
import { SpPress } from "@/components/song-v2/SpUi"
import type { SpTheme } from "@/constants/tokens/amSong"
import { amFonts } from "@/constants/tokens/amTypography"
import { lineKind, piecesOf } from "@/lib/recordingChords/transpose"

/** Corners of the song page: soft cards 24, fields 20, a small box 8, round buttons 9999. */
export const R_CARD = 24
export const R_FIELD = 20
export const R_BOX = 8
export const R_ROUND = 9999

/**
 * A fixed-pitch face is the one place the app leaves Roboto: a chord sits over a syllable only while every letter
 * is the same width. Each platform's own monospace is used (none is bundled), and nothing else is set in it.
 */
export const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "ui-monospace, Menlo, Consolas, monospace" }) as string

/**
 * A plain-text chord sheet as drawn on the page: the chords (a line of them, or `[Am]` marks in words) in the
 * accent, the words in ink, columns kept. Long lines scroll sideways instead of wrapping, because wrapping would
 * slide a chord off its word.
 */
export function ChartText({ t, body, size = 15 }: { t: SpTheme; body: string; size?: number }) {
  const lines = useMemo(
    () =>
      body.split("\n").map((line) => {
        const kind = lineKind(line)
        return { kind, pieces: piecesOf(line, kind) }
      }),
    [body],
  )
  const lineHeight = Math.round(size * 1.5)
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled style={[styles.chartBox, { backgroundColor: t.white, borderColor: t.sand400 }]} contentContainerStyle={styles.chartPad}>
      <View accessibilityRole="text">
        {lines.map((line, index) => (
          <Text key={index} style={{ fontFamily: MONO, fontSize: size, lineHeight, color: t.ink900, minHeight: lineHeight }}>
            {line.pieces.length === 0 ? " " : null}
            {line.pieces.map((piece, i) => (
              <Text key={i} style={piece.chord ? { color: t.accentText, fontWeight: "700" } : undefined}>
                {piece.text}
              </Text>
            ))}
          </Text>
        ))}
      </View>
    </ScrollView>
  )
}

/** "- Transpose +" : a stepper of semitones; the label says where the chart is now. */
export function Stepper({
  t,
  label,
  value,
  onDown,
  onUp,
  downLabel,
  upLabel,
  canDown,
  canUp,
}: {
  t: SpTheme
  label: string
  value: string
  onDown: () => void
  onUp: () => void
  downLabel: string
  upLabel: string
  canDown: boolean
  canUp: boolean
}) {
  return (
    <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: value }}>
      <Text style={[styles.stepLabel, { color: t.ink500 }]}>{label}</Text>
      <View style={styles.stepRow}>
        <StepButton t={t} label={downLabel} onPress={onDown} disabled={!canDown} icon="minus" />
        <Text style={[styles.stepValue, { color: t.ink900 }]} accessibilityLiveRegion="polite">
          {value}
        </Text>
        <StepButton t={t} label={upLabel} onPress={onUp} disabled={!canUp} icon="plus" />
      </View>
    </View>
  )
}

function StepButton({ t, label, onPress, disabled, icon }: { t: SpTheme; label: string; onPress: () => void; disabled: boolean; icon: "minus" | "plus" }) {
  return (
    <SpPress onPress={onPress} disabled={disabled} accessibilityLabel={label} accessibilityState={{ disabled }} pressedScale={0.92} style={[styles.stepBtn, { borderColor: t.ink800, opacity: disabled ? 0.4 : 1 }]}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d={icon === "plus" ? "M12 5v14M5 12h14" : "M5 12h14"} stroke={t.ink900} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </SpPress>
  )
}

/** A labelled checkbox row (48 high), like the comments' "Share anonymously". */
export function CheckLine({ t, on, label, onToggle }: { t: SpTheme; on: boolean; label: string; onToggle: () => void }) {
  return (
    <SpPress onPress={onToggle} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: on }} pressedScale={0.99} style={styles.check}>
      <View style={[styles.box, { borderColor: on ? t.action : t.ink900, backgroundColor: on ? t.action : "transparent" }]}>{on ? <SpIcon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}</View>
      <Text style={[styles.checkLabel, { color: t.ink900 }]}>{label}</Text>
    </SpPress>
  )
}

/** A soft card holding one block of a page. */
export function Card({ t, children }: { t: SpTheme; children: ReactNode }) {
  return <View style={[styles.card, { backgroundColor: t.white, borderColor: t.sand400 }]}>{children}</View>
}

/** A quiet line of small text. */
export function Note({ t, children, tone = "quiet" }: { t: SpTheme; children: ReactNode; tone?: "quiet" | "danger" | "body" }) {
  return (
    <Text accessibilityLiveRegion={tone === "danger" ? "polite" : undefined} style={[styles.note, { color: tone === "danger" ? t.dangerText : tone === "body" ? t.ink800 : t.ink500 }]}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  chartBox: { borderRadius: R_FIELD, borderWidth: 1 },
  chartPad: { paddingHorizontal: 16, paddingVertical: 16 },
  stepper: { gap: 4 },
  stepLabel: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 48, height: 48, borderRadius: R_ROUND, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepValue: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 24, minWidth: 64, textAlign: "center" },
  check: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  box: { width: 24, height: 24, borderWidth: 2, borderRadius: R_BOX, alignItems: "center", justifyContent: "center" },
  checkLabel: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 22, flexShrink: 1 },
  card: { borderWidth: 1, borderRadius: R_CARD, padding: 16, gap: 12 },
  note: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
})
