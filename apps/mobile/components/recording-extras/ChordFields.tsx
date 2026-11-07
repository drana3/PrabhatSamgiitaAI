import { Platform, StyleSheet, Text, TextInput, View } from "react-native"

import { CORNER, CheckRow, Chip, Hint, Label } from "@/components/song-chords/parts"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { SHEET_MAX_LENGTH, SHEET_NOTE_MAX } from "@/lib/recordingChords/rules"
import type { SheetDraft, SheetInstrument } from "@/lib/recordingChords/types"

import { MONO } from "./ui"

const INSTRUMENTS: SheetInstrument[] = ["guitar", "harmonium"]

/**
 * The fields of a chord chart, shared by the upload prompt and the "Add chords" screen: instrument, key (optional),
 * the chart as plain text in a fixed-pitch face, a note (optional), "I played or checked these", and the anonymous
 * choice with an honest line about who still sees the name. Keeps no state of its own: the draft belongs to the caller.
 * `problem` is a sentence already worded; it is shown under the chart.
 */
export function ChordFields({
  theme,
  draft,
  onChange,
  name,
  problem,
  disabled,
  review,
}: {
  theme: SongsTheme
  draft: SheetDraft
  onChange: (next: SheetDraft) => void
  /** the viewer's own name for the "shown with your name" line; "" when not known */
  name: string
  problem?: string | null
  disabled?: boolean
  /** say that a new chart waits for the team (members), not for team members who publish at once */
  review?: boolean
}) {
  const t = useT()
  const set = (patch: Partial<SheetDraft>) => onChange({ ...draft, ...patch })
  const webField = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null
  return (
    <View style={s.root}>
      <Hint theme={theme}>{t("recChordsForm.intro")}</Hint>

      <View style={s.group}>
        <Label theme={theme}>{t("recChordsForm.instrument")}</Label>
        <View style={s.row} accessibilityRole="radiogroup">
          {INSTRUMENTS.map((i) => (
            <Chip key={i} theme={theme} label={t(`recChords.instrument.${i}`)} on={draft.instrument === i} onPress={() => !disabled && set({ instrument: i })} />
          ))}
        </View>
      </View>

      <View style={s.group}>
        <Label theme={theme}>{t("recChordsForm.key")}</Label>
        <TextInput
          value={draft.key}
          onChangeText={(key) => set({ key: key.replace(/\s/g, "") })}
          maxLength={3}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!disabled}
          placeholder="Am"
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t("recChordsForm.key")}
          style={[s.small, webField, { color: theme.textHeading, backgroundColor: theme.card, borderColor: theme.line }]}
        />
      </View>

      <View style={s.group}>
        <Label theme={theme}>{t("recChordsForm.body")}</Label>
        <View style={[s.box, { backgroundColor: theme.card, borderColor: problem ? theme.dangerText : theme.line }]}>
          <TextInput
            value={draft.body}
            onChangeText={(body) => set({ body })}
            multiline
            maxLength={SHEET_MAX_LENGTH + 200}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            editable={!disabled}
            placeholder={t("recChordsForm.body.placeholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t("recChordsForm.body")}
            style={[s.chart, webField, { color: theme.textHeading }]}
          />
        </View>
        <Hint theme={theme}>{t("recChordsForm.example")}</Hint>
        {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : null}
      </View>

      <View style={s.group}>
        <Label theme={theme}>{t("recChordsForm.note")}</Label>
        <TextInput
          value={draft.note}
          onChangeText={(note) => set({ note })}
          maxLength={SHEET_NOTE_MAX + 50}
          editable={!disabled}
          placeholder={t("recChordsForm.note.placeholder")}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={t("recChordsForm.note")}
          style={[s.small, s.wide, webField, { color: theme.textHeading, backgroundColor: theme.card, borderColor: theme.line }]}
        />
      </View>

      <CheckRow theme={theme} on={draft.playedIt} label={t("recChordsForm.played")} onToggle={() => !disabled && set({ playedIt: !draft.playedIt })} />
      <CheckRow theme={theme} on={draft.isAnonymous} label={t("recChordsForm.anonymous")} onToggle={() => !disabled && set({ isAnonymous: !draft.isAnonymous })} />
      <Hint theme={theme}>{draft.isAnonymous ? t("recChordsForm.as.anonymous") : name ? t("recChordsForm.as.named", { name }) : t("recChordsForm.as.namedNoName")}</Hint>
      {draft.isAnonymous ? <Hint theme={theme}>{t("recChordsForm.as.team")}</Hint> : null}
      {review ? <Hint theme={theme}>{t("recChordsForm.review")}</Hint> : null}
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 16 },
  group: { gap: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  small: { minHeight: 52, minWidth: 96, paddingHorizontal: 14, paddingVertical: 12, borderRadius: CORNER, borderWidth: 1.5, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, alignSelf: "flex-start" },
  wide: { alignSelf: "stretch" },
  box: { borderRadius: CORNER, borderWidth: 1.5, minHeight: 200 },
  chart: { minHeight: 200, paddingHorizontal: 16, paddingVertical: 16, fontFamily: MONO, fontSize: 15, lineHeight: 22, textAlignVertical: "top" },
})

/** A small standalone line used by the prompt and the screen. */
export function Plain({ theme, children }: { theme: SongsTheme; children: string }) {
  return <Text style={{ color: theme.textBody, fontFamily: amFonts.medium, fontSize: 14, lineHeight: 20 }}>{children}</Text>
}
