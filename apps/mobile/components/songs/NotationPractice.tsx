import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import type { TransposedNotation } from "@prabhat/core"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"
import {
  buildDisplayNotes,
  distributeNotesToWords,
  formatPracticeSequence,
  resolveLineLyrics,
  splitLyricLines,
  type NotationLine,
} from "@/lib/sargamDisplay"

const TONICS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

function LinePracticeCard({
  line,
  lineIndex,
  songLyricLines,
}: {
  line: NotationLine
  lineIndex: number
  songLyricLines: string[]
}) {
  const notes = buildDisplayNotes(line)
  const lyrics = resolveLineLyrics(line, lineIndex, songLyricLines)
  const wordGroups = distributeNotesToWords(lyrics.roman.split(/\s+/).filter(Boolean), notes)
  const hasNotes = notes.length > 0

  return (
    <View style={styles.lineCard}>
      <View style={styles.lineHeader}>
        <Text style={styles.lineEyebrow}>
          पंक्ति {lineIndex + 1} · Song line {lineIndex + 1}
        </Text>
        <Text style={styles.lineLyrics}>{lyrics.roman}</Text>
        {line.transliteration && line.transliteration !== lyrics.roman ? (
          <Text style={styles.lineTranslit}>{line.transliteration}</Text>
        ) : null}
      </View>

      {hasNotes ? (
        <View style={styles.practiceBlock}>
          <Text style={styles.practiceEyebrow}>
            Play this Sargam for the line above · इस पंक्ति का सारगम
          </Text>

          {wordGroups.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.wordRow}
            >
              {wordGroups.map((group, index) => (
                <View key={`${line.line_number}-word-${index}`} style={styles.wordCard}>
                  <Text style={styles.wordLabel} numberOfLines={1}>
                    {group.word}
                  </Text>
                  <Text style={styles.wordDevanagari} numberOfLines={2}>
                    {formatPracticeSequence(group.notes, "devanagari").replace(/ · /g, " ")}
                  </Text>
                  <Text style={styles.wordLatin} numberOfLines={2}>
                    {formatPracticeSequence(group.notes, "latin").replace(/ · /g, " ")}
                  </Text>
                  <Text style={styles.wordKeys} numberOfLines={1}>
                    {formatPracticeSequence(group.notes, "key").replace(/ · /g, " ")}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <Text style={styles.fullLabel}>पूरी पंक्ति · Full line Sargam</Text>
          <Text style={styles.fullDevanagari}>{formatPracticeSequence(notes, "devanagari")}</Text>
          <Text style={styles.fullLatin}>{formatPracticeSequence(notes, "latin")}</Text>
          <Text style={styles.fullKeys}>Keys: {formatPracticeSequence(notes, "key")}</Text>
        </View>
      ) : (
        <Text style={styles.missing}>Notation for this line is not available yet.</Text>
      )}
    </View>
  )
}

export function NotationPractice({
  songNumber,
  embedded = false,
  lyricText,
}: {
  songNumber: number
  /** Drop outer card chrome when nested in an accordion. */
  embedded?: boolean
  /** Song lyrics / transliteration — same line split as the website. */
  lyricText?: string | null
}) {
  const [notation, setNotation] = useState<TransposedNotation | null>(null)
  const [tonic, setTonic] = useState("C")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const songLyricLines = useMemo(() => splitLyricLines(lyricText), [lyricText])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    void api.fetchNotation(songNumber, tonic).then((next) => {
      if (!active) return
      setNotation(next)
      setLoading(false)
      if (!next) setError("Notation is not available for this song yet.")
    })
    return () => {
      active = false
    }
  }, [songNumber, tonic])

  return (
    <View style={embedded ? styles.embedded : styles.card}>
      {embedded ? null : <Text style={styles.title}>Practise on harmonium</Text>}
      <Text style={styles.lead}>
        Choose your Sa, then follow Sa Re Ga Ma under each lyric line — same layout as the website.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tonicRow}>
        {TONICS.map((value) => (
          <Pressable
            key={value}
            onPress={() => setTonic(value)}
            style={[styles.tonicChip, tonic === value && styles.tonicActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: tonic === value }}
            accessibilityLabel={`Tonic ${value}`}
          >
            <Text style={[styles.tonicText, tonic === value && styles.tonicTextActive]}>{value}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.meta}>Loading notation…</Text>
        </View>
      ) : null}

      {error && !loading ? <Text style={styles.error}>{error}</Text> : null}

      {notation && !loading ? (
        <>
          <Text style={styles.meta}>
            Scale {notation.target_scale}
            {notation.notation.tala ? ` · ${notation.notation.tala.name}` : ""}
            {" · "}
            {notation.verification_status}
          </Text>
          <Text style={styles.sectionHeading}>Lyric · Sargam · Harmonium keys</Text>
          {notation.notation.lines.map((line, index) => (
            <LinePracticeCard
              key={line.line_number}
              line={line}
              lineIndex={index}
              songLyricLines={songLyricLines}
            />
          ))}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...softShadow(1),
  },
  embedded: {
    gap: spacing.sm,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  lead: { ...typography.bodySmall, color: colors.textSecondary },
  tonicRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  tonicChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tonicActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tonicText: { ...typography.caption, color: colors.textPrimary },
  tonicTextActive: { color: colors.primaryDark, fontWeight: "700" },
  loading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.bodySmall, color: colors.error },
  sectionHeading: {
    ...typography.label,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  lineCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
    marginBottom: spacing.md,
    ...softShadow(1),
  },
  lineHeader: {
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(215,163,65,0.25)",
    gap: 4,
  },
  lineEyebrow: {
    ...typography.caption,
    color: colors.spiritualGold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 10,
  },
  lineLyrics: {
    fontFamily: "Lora_700Bold",
    fontSize: 17,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  lineTranslit: { ...typography.caption, color: colors.textMuted },
  practiceBlock: {
    borderLeftWidth: 4,
    borderLeftColor: colors.spiritualGold,
    backgroundColor: "rgba(215,163,65,0.08)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  practiceEyebrow: {
    ...typography.caption,
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 10,
  },
  wordRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  wordCard: {
    minWidth: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  wordLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    fontSize: 9,
  },
  wordDevanagari: {
    fontFamily: "Lora_700Bold",
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 4,
    textAlign: "center",
  },
  wordLatin: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
    textAlign: "center",
  },
  wordKeys: {
    ...typography.caption,
    color: colors.spiritualGold,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
    fontSize: 10,
  },
  fullLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 10,
    marginTop: spacing.xs,
  },
  fullDevanagari: {
    fontFamily: "Lora_700Bold",
    fontSize: 24,
    lineHeight: 34,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  fullLatin: {
    fontFamily: "Lora_700Bold",
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  fullKeys: {
    ...typography.label,
    color: colors.primaryDark,
    marginTop: 2,
  },
  missing: {
    ...typography.bodySmall,
    color: colors.textMuted,
    padding: spacing.md,
  },
})
