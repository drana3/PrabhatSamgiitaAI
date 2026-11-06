import { useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"

import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { parseChordPro, toChordPro, type ParseIssue, type ParseMeta, type ParseResult } from "@/lib/songChords/chordPro"
import type { Placement } from "@/lib/songChords/draft"

import { ActionButton, CORNER, Hint } from "./parts"

/**
 * The plain-text way in: ChordPro-style `[Am]word`. The text is checked on every change against the words of the
 * song; every problem is listed with its line (and column), and nothing is applied until there are no errors.
 * The box starts from the chords already placed, so switching between "Tap words" and "Paste text" loses nothing.
 */
export function ChordPasteBox({
  theme,
  lyricLines,
  placements,
  onApply,
}: {
  theme: SongsTheme
  lyricLines: readonly string[]
  placements: ReadonlyArray<ReadonlyArray<Placement>>
  onApply: (lines: Placement[][], meta: ParseMeta) => void
}) {
  const t = useT()
  const fromChords = useMemo(() => toChordPro(placements, lyricLines), [placements, lyricLines])
  const [text, setText] = useState(fromChords)
  const [applied, setApplied] = useState<null | "plain" | "meta">(null)

  // the song changed under the box: start from its words
  useEffect(() => {
    setText(fromChords)
    setApplied(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricLines])

  const result: ParseResult = useMemo(() => parseChordPro(text, lyricLines), [text, lyricLines])
  const errors = result.issues.filter((i) => i.level === "error")
  const warnings = result.issues.filter((i) => i.level === "warning")
  const found = result.lines.reduce((sum, line) => sum + line.length, 0)

  return (
    <View style={s.root}>
      <Hint theme={theme}>{t("chordOffer.paste.hint", { capo: "{capo: 2}", key: "{key: G}" })}</Hint>
      <View style={[s.box, { backgroundColor: theme.card, borderColor: errors.length ? theme.dangerText : theme.line }]}>
        <TextInput
          value={text}
          onChangeText={(next) => {
            setText(next)
            setApplied(null)
          }}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholder={t("chordOffer.paste.placeholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t("chordOffer.paste.field.a11y")}
          style={[s.input, { color: theme.textHeading }]}
        />
      </View>

      {text.trim() ? (
        errors.length ? (
          <Text style={[s.status, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
            {t("chordOffer.paste.errors", { count: errors.length })}
          </Text>
        ) : (
          <Text style={[s.status, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
            {t("chordOffer.paste.ok", { count: found })}
          </Text>
        )
      ) : null}
      {errors.map((issue, i) => (
        <Issue key={`e${i}`} theme={theme} issue={issue} />
      ))}
      {warnings.length ? <Text style={[s.status, { color: theme.textBody }]}>{t("chordOffer.paste.warnings", { count: warnings.length })}</Text> : null}
      {warnings.map((issue, i) => (
        <Issue key={`w${i}`} theme={theme} issue={issue} />
      ))}

      <View style={s.actions}>
        <ActionButton
          theme={theme}
          label={t("chordOffer.paste.use")}
          disabled={!result.ok || !text.trim()}
          onPress={() => {
            const meta = result.meta
            onApply(result.lines, meta)
            setApplied(meta.capo !== undefined || meta.key !== undefined ? "meta" : "plain")
          }}
        />
        <ActionButton
          theme={theme}
          tone="quiet"
          label={t("chordOffer.paste.reset")}
          onPress={() => {
            setText(fromChords)
            setApplied(null)
          }}
        />
      </View>
      {applied ? (
        <Text style={[s.status, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
          {t("chordOffer.paste.applied")} {applied === "meta" ? t("chordOffer.paste.appliedMeta") : ""}
        </Text>
      ) : null}
    </View>
  )
}

function Issue({ theme, issue }: { theme: SongsTheme; issue: ParseIssue }) {
  const t = useT()
  const where = issue.column ? t("chordOffer.issue.at", { line: issue.line, column: issue.column }) : t("chordOffer.issue.atLine", { line: issue.line })
  // the key depends on the issue code and each message takes its own variables: typed loosely here, the parity test checks the texts
  const message = (t as unknown as (key: string, params?: Record<string, string | number>) => string)(`chordOffer.issue.${issue.code}`, { line: issue.line, ...(issue.params ?? {}) })
  const bad = issue.level === "error"
  return (
    <View style={[s.issue, { borderLeftColor: bad ? theme.dangerText : theme.line }]}>
      <Text style={[s.where, { color: bad ? theme.dangerText : theme.textHeading }]}>{where}</Text>
      <Text style={[s.message, { color: theme.textBody }]}>{message}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 10 },
  box: { borderWidth: 1.5, borderRadius: CORNER, minHeight: 180 },
  input: { minHeight: 180, padding: 12, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 26, textAlignVertical: "top", outlineStyle: "none" as never },
  status: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  issue: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
  where: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 18 },
  message: { fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 },
  actions: { gap: 8 },
})
