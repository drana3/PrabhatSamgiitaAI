import { StyleSheet, Text, View } from "react-native"

import { Card, Pill, SectionHeading } from "@/components/song-v2/common"
import { scriptTextStyle } from "@/components/song-v2/scriptText"
import { PressScale } from "@/components/today/motion"
import type { AmTheme } from "@/constants/tokens/amColors"
import { amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amFonts, amFontSize, amType } from "@/constants/tokens/amTypography"
import type { WordColumn } from "@/lib/songPage/chordChart"
import type { ScriptLines } from "@/lib/songPage/scripts"
import { isRtl } from "@/lib/songPage/translations"

export type TranslationUnder = { code: string; lines: string[] }

function ChordColumns({
  theme,
  columns,
  script,
  onChord,
}: {
  theme: AmTheme
  columns: WordColumn[]
  script: ScriptLines["primaryScript"]
  onChord: (shown: string) => void
}) {
  return (
    <View style={styles.columns}>
      {columns.map((column, index) => (
        <View key={`${column.word}-${index}`} style={styles.column}>
          {column.chord ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Chord ${column.chord}. Show fingering`}
              onPress={() => onChord(column.chord as string)}
              pressedScale={0.92}
              hitSlop={amSpace.s3}
              style={styles.chordHit}
            >
              <Text style={[styles.chord, { color: theme.eyebrow }]}>{column.chord}</Text>
            </PressScale>
          ) : (
            <View style={styles.chordHit} />
          )}
          <Text style={[scriptTextStyle(script, amFontSize.lead), { color: theme.textHeading }]}>{column.word}</Text>
        </View>
      ))}
    </View>
  )
}

/**
 * Lyrics (SCR-16): the chosen script, up to two translation lines under each
 * line, and with Chords on each chord letter above the word where it changes.
 * Chord letters sit in their own row, so they never cover a word.
 */
export function LyricsSection({
  theme,
  lines,
  translations,
  columnsByLine,
  summary,
  onChangeChords,
  onChord,
  emptyText,
}: {
  theme: AmTheme
  lines: ScriptLines
  translations: TranslationUnder[]
  /** chord columns per line already in the primary script, or null for no chords */
  columnsByLine: Array<WordColumn[] | null> | null
  /** "Guitar, capo 5" when chords are on */
  summary: string | null
  onChangeChords: () => void
  onChord: (shown: string) => void
  emptyText: string
}) {
  return (
    <View style={styles.section}>
      <SectionHeading theme={theme}>Lyrics</SectionHeading>
      {summary ? (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[amType.label, { color: theme.eyebrow }]}>{summary}</Text>
          </View>
          <Pill theme={theme} label="Change" onPress={onChangeChords} accessibilityLabel="Change chord settings" />
        </View>
      ) : null}
      <Card theme={theme} style={styles.card}>
        {lines.primary.length === 0 ? (
          <Text style={[amType.body, { color: theme.textBody }]}>{emptyText}</Text>
        ) : (
          lines.primary.map((line, index) => {
            const columns = columnsByLine?.[index] ?? null
            const secondary = lines.secondary?.[index]
            return (
              <View
                key={index}
                style={[styles.line, index > 0 && { borderTopColor: theme.line }, index > 0 && styles.lineRule]}
              >
                {columns ? (
                  <ChordColumns theme={theme} columns={columns} script={lines.primaryScript} onChord={onChord} />
                ) : (
                  <Text style={[scriptTextStyle(lines.primaryScript, amFontSize.lead), { color: theme.textHeading }]}>
                    {line}
                  </Text>
                )}
                {secondary ? (
                  <Text
                    style={[
                      scriptTextStyle(lines.secondaryScript ?? "devanagari", amFontSize.body),
                      { color: theme.textMuted },
                    ]}
                  >
                    {secondary}
                  </Text>
                ) : null}
                {translations.map((t) =>
                  t.lines[index] ? (
                    <Text key={t.code} style={[amType.body, { color: theme.textBody }, isRtl(t.code) && styles.rtl]}>
                      {t.lines[index]}
                    </Text>
                  ) : null,
                )}
              </View>
            )
          })
        )}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: amSpace.s3 },
  card: { paddingVertical: amSpace.s2 },
  line: { paddingVertical: amSpace.s3, gap: amSpace.s1 },
  lineRule: { borderTopWidth: StyleSheet.hairlineWidth },
  columns: { flexDirection: "row", flexWrap: "wrap", columnGap: amSpace.s2 },
  column: { alignItems: "flex-start" },
  chordHit: { minWidth: amSpace.s6, height: amSpace.s6, justifyContent: "flex-end" },
  chord: { fontFamily: amFonts.bold, fontSize: amFontSize.body },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: amSpace.s2 },
  summaryChip: {
    minHeight: amTouchTarget,
    justifyContent: "center",
    paddingHorizontal: amSpace.s4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  rtl: { writingDirection: "rtl", textAlign: "right" },
})
