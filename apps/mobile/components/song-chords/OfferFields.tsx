import { useState, type MutableRefObject, type ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native"

import { SpringSheet } from "@/components/assistant-v2/SpringSheet"
import { KeyPicker } from "@/components/kirtan/add/KeyPicker"
import { ChartPreview } from "@/components/song-chords/ChartPreview"
import { ChordPasteBox } from "@/components/song-chords/ChordPasteBox"
import { ChordSlotEditor, type Slot } from "@/components/song-chords/ChordSlotEditor"
import { ActionButton, CheckRow, Chip, CORNER, Hint, Label } from "@/components/song-chords/parts"
import { amColors } from "@/constants/tokens/amColors"
import type { SpTheme } from "@/constants/tokens/amSong"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import type { useFormFocus } from "@/lib/forms/useFormFocus"
import { useT } from "@/lib/i18n"
import { keyOptions } from "@/lib/kirtan/keyPicker"
import { ROOTS, suggestedChords } from "@/lib/songChords/chordName"
import type { ParseMeta } from "@/lib/songChords/chordPro"
import { NOTE_MAX, STRUM_MAX, countChords, linesWithChords, setCapo, setInstrument, soundingKey, toPayload, type Draft, type Placement } from "@/lib/songChords/draft"
import type { FormField } from "@/lib/songChords/fields"
import { CHORD_INSTRUMENT_CHOICES } from "@/lib/recordingChords/instruments"
import { MAX_CAPO } from "@/lib/songPage/chords"

/**
 * The fields the two "offer chords" screens share: the one for a Prabhat Samgiita song (app/upload-chords.tsx) and the one
 * for a Bhajan or a Spiritual song (app/recording-chart.tsx). The same instrument, key and capo questions, the same line
 * editor, the same preview, the same optional strum and note, the same confirmation. Each takes the `Draft` and a `patch`.
 * Only what differs (the song, or the text of the song) stays in the screens.
 */
export type FormFocus = ReturnType<typeof useFormFocus>
export type Patch = (change: Partial<Draft>) => void

const KEY_OPTIONS = keyOptions(ROOTS)

/** The instrument chips. `locked` shows only the chosen one (a chart being fixed keeps its instrument). */
export function InstrumentField({ theme, draft, locked, patch }: { theme: SongsTheme; draft: Draft; locked: boolean; patch: (next: Draft) => void }) {
  const t = useT()
  return (
    <>
      <Label theme={theme}>{t("chordOffer.instrument.label")}</Label>
      <Hint theme={theme}>{t("chordOffer.instrument.hint")}</Hint>
      <View style={s.chips} accessibilityRole="radiogroup">
        {locked ? (
          <Chip theme={theme} label={t(`chordOffer.instrument.${draft.instrument}` as "chordOffer.instrument.guitar")} on minWidth={104} onPress={() => {}} />
        ) : (
          // Harmonium, Piano, Guitar: the same three for every kind that takes chords
          CHORD_INSTRUMENT_CHOICES.map((id) => (
            <Chip key={id} theme={theme} label={t(`chordOffer.instrument.${id}` as "chordOffer.instrument.guitar")} on={draft.instrument === id} minWidth={104} onPress={() => patch(setInstrument(draft, id))} />
          ))
        )}
      </View>
    </>
  )
}

/** The key (Sa for a harmonium) as a question in plain words, an answer to pick and an example; for a guitar also the capo. */
export function KeyCapoField({ theme, draft, patch }: { theme: SongsTheme; draft: Draft; patch: Patch }) {
  const t = useT()
  const guitar = draft.instrument === "guitar"
  return (
    <>
      <KeyPicker
        theme={theme}
        label={draft.instrument === "harmonium" ? t("chordOffer.key.harmonium.label") : t("chordOffer.key.guitar.label")}
        explain={t(draft.instrument === "harmonium" ? "keyPicker.explain.harmonium" : draft.instrument === "piano" ? "keyPicker.explain.piano" : "keyPicker.explain.guitar")}
        options={KEY_OPTIONS}
        value={draft.key}
        onChange={(root) => patch({ key: root })}
        noteOf={(root) => t("keyPicker.usual", { chords: suggestedChords(root).slice(0, 4).join(" · ") })}
        a11yOf={(root) => t("chordOffer.key.a11y", { key: root })}
        testID="chord-key-field"
      />
      {guitar ? (
        <>
          <Label theme={theme}>{t("chordOffer.capo.label")}</Label>
          <View style={s.stepper}>
            <Chip theme={theme} role="button" label="−" a11y={t("chordOffer.capo.lower")} minWidth={52} onPress={() => patch(setCapo(draft, draft.capo - 1))} />
            <Text style={[s.capoValue, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
              {draft.capo === 0 ? t("chordOffer.capo.none") : t("chordOffer.capo.fret", { capo: draft.capo })}
            </Text>
            <Chip theme={theme} role="button" label="+" a11y={t("chordOffer.capo.raise")} minWidth={52} onPress={() => patch(setCapo(draft, Math.min(MAX_CAPO, draft.capo + 1)))} />
          </View>
          {draft.capo > 0 ? <Hint theme={theme}>{t("chordOffer.capo.sounds", { key: soundingKey(draft) })}</Hint> : null}
        </>
      ) : null}
    </>
  )
}

/**
 * Putting chords on the words: "Tap words" (the line editor, a tap on a word opens the chord sheet) or "Paste text"
 * (`[Am]word`), and how many chords there are. `status` is whatever the screen has to say about the words themselves.
 */
export function ChordEntryField({
  theme,
  form,
  error,
  draft,
  lines,
  entryMode,
  onMode,
  selected,
  onSelect,
  nodes,
  onClose,
  onApply,
  status,
}: {
  theme: SongsTheme
  form: FormFocus
  error: string | null
  draft: Draft
  /** the words of the song, one entry per line; null while there are none to put chords on */
  lines: readonly string[] | null
  entryMode: "tap" | "paste"
  onMode: (mode: "tap" | "paste") => void
  selected: Slot | null
  onSelect: (slot: Slot | null) => void
  nodes: MutableRefObject<Record<string, View | null>>
  onClose: () => void
  onApply: (lines: Placement[][], meta: ParseMeta) => void
  status?: ReactNode
}) {
  const t = useT()
  const total = countChords(draft)
  return (
    <View {...form.field("chords")} style={s.field}>
      <Label theme={theme}>{t("chordOffer.chords.label")}</Label>
      <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("chordOffer.chords.mode.a11y")}>
        <Chip theme={theme} label={t("chordOffer.chords.mode.tap")} on={entryMode === "tap"} minWidth={130} onPress={() => onMode("tap")} />
        <Chip theme={theme} label={t("chordOffer.chords.mode.paste")} on={entryMode === "paste"} minWidth={130} onPress={() => onMode("paste")} />
      </View>
      {error ? (
        <Hint theme={theme} tone="danger">
          {error}
        </Hint>
      ) : null}
      {status}
      {lines ? (
        entryMode === "tap" ? (
          <>
            <Hint theme={theme}>{t("chordOffer.chords.tapHint")}</Hint>
            {/* a tap on the blank part of the sheet puts the chord sheet away; a word catches its own tap */}
            <Pressable accessible={false} onPress={onClose} style={s.editorTap}>
              <ChordSlotEditor theme={theme} lines={lines} placements={draft.lines} selected={selected} onSelect={onSelect} nodes={nodes} />
            </Pressable>
          </>
        ) : (
          <ChordPasteBox theme={theme} lyricLines={lines} placements={draft.lines} onApply={onApply} />
        )
      ) : null}
      {lines ? (
        <Text style={[s.count, { color: theme.textBody }]} accessibilityLiveRegion="polite">
          {t("chordOffer.chords.count", { count: total })}
          {total > 0 ? ` · ${linesWithChords(draft)}/${lines.filter(Boolean).length}` : ""}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * "How it will look": ONE button on the page (the preview used to be a block as tall as the song). A tap opens a plain white window
 * (the spring sheet) with the chart drawn by the song page's own chord view, or the line that says there is nothing to show yet.
 */
export function PreviewField({ theme, spTheme, draft, lines, counts }: { theme: SongsTheme; spTheme: SpTheme; draft: Draft; lines: readonly string[]; counts: readonly number[] }) {
  const t = useT()
  const am = useAmTheme()
  const { height } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const guitar = draft.instrument === "guitar"
  const payload = countChords(draft) === 0 ? null : toPayload({ ...draft, songId: draft.songId ?? 0 }, counts)
  const proposal = payload ? { baseKey: payload.baseKey, strum: payload.strum, lines: payload.lines, instrument: payload.instrument } : null
  return (
    <View style={s.field}>
      <ActionButton theme={theme} tone="quiet" label={t("chordOffer.preview.button")} onPress={() => setOpen(true)} />
      <SpringSheet visible={open} onClose={() => setOpen(false)} title={t("chordOffer.preview.title")} theme={am} surface={amColors.white}>
        <ScrollView style={{ maxHeight: Math.round(height * 0.6) }} contentContainerStyle={s.previewContent} showsVerticalScrollIndicator>
          {proposal ? (
            <>
              <Hint theme={theme}>{t("chordOffer.preview.hint")}</Hint>
              <ChartPreview
                t={spTheme}
                romanLines={lines}
                proposal={proposal}
                capo={guitar ? draft.capo : 0}
                harmoniumKey={draft.key}
                caption={
                  guitar
                    ? draft.capo > 0
                      ? t("chordOffer.preview.summary.guitar", { capo: draft.capo })
                      : t("chordOffer.preview.summary.guitarNoCapo")
                    : draft.instrument === "piano"
                      ? t("chordOffer.preview.summary.piano", { key: draft.key })
                      : t("chordOffer.preview.summary.harmonium", { key: draft.key })
                }
              />
            </>
          ) : (
            <Hint theme={theme}>{t("chordOffer.preview.empty")}</Hint>
          )}
        </ScrollView>
      </SpringSheet>
    </View>
  )
}

/** The optional part (strumming pattern for a guitar, a note), shut until asked for or filled in. */
export function OptionalFields({
  theme,
  form,
  draft,
  patch,
  fieldError,
  open,
  onOpen,
  onFocus,
}: {
  theme: SongsTheme
  form: FormFocus
  draft: Draft
  patch: Patch
  fieldError: (field: FormField) => string | null
  open: boolean
  onOpen: () => void
  /** a field took the focus: the chord sheet goes away */
  onFocus: () => void
}) {
  const t = useT()
  const guitar = draft.instrument === "guitar"
  if (!(open || draft.strum || draft.note || fieldError("strum") || fieldError("note"))) {
    return <ActionButton theme={theme} tone="quiet" label={guitar ? t("chordOffer.details.show.guitar") : t("chordOffer.details.show.harmonium")} onPress={onOpen} />
  }
  return (
    <>
      {guitar ? (
        <View {...form.field("strum")} style={s.field}>
          <Label theme={theme}>{t("chordOffer.strum.label")}</Label>
          <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: fieldError("strum") ? amColors.danger : theme.line }]}>
            <TextInput
              ref={form.input("strum") as never}
              value={draft.strum}
              onChangeText={(text) => patch({ strum: text.slice(0, STRUM_MAX) })}
              onFocus={onFocus}
              placeholder={t("chordOffer.strum.placeholder")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("chordOffer.strum.label")}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={STRUM_MAX}
              style={[s.input, { color: theme.textHeading }]}
            />
          </View>
          {fieldError("strum") ? (
            <Hint theme={theme} tone="danger">
              {fieldError("strum")}
            </Hint>
          ) : (
            <Hint theme={theme}>{t("chordOffer.strum.hint")}</Hint>
          )}
        </View>
      ) : null}
      <View {...form.field("note")} style={s.field}>
        <Label theme={theme}>{t("chordOffer.note.label")}</Label>
        <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: theme.line, alignItems: "flex-start" }]}>
          <TextInput
            ref={form.input("note") as never}
            value={draft.note}
            onChangeText={(text) => patch({ note: text.slice(0, NOTE_MAX) })}
            onFocus={onFocus}
            placeholder={t("chordOffer.note.placeholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t("chordOffer.note.label")}
            maxLength={NOTE_MAX}
            multiline
            style={[s.input, s.noteInput, { color: theme.textHeading }]}
          />
        </View>
        <Hint theme={theme}>{t("chordOffer.note.left", { count: NOTE_MAX - draft.note.length })}</Hint>
      </View>
    </>
  )
}

/** "I played it", "Send without my name", and the line that says whose name the chart will carry. */
export function ConfirmFields({ theme, form, draft, patch, fieldError, name }: { theme: SongsTheme; form: FormFocus; draft: Draft; patch: Patch; fieldError: (field: FormField) => string | null; name: string }) {
  const t = useT()
  return (
    <>
      <View {...form.field("played")} style={s.field}>
        <CheckRow theme={theme} on={draft.playedIt} label={t("chordOffer.played.label")} onToggle={() => patch({ playedIt: !draft.playedIt })} invalid={fieldError("played") !== null} />
        {fieldError("played") ? (
          <Hint theme={theme} tone="danger">
            {fieldError("played")}
          </Hint>
        ) : null}
      </View>
      <CheckRow theme={theme} on={draft.isAnonymous} label={t("chordOffer.anonymous.label")} onToggle={() => patch({ isAnonymous: !draft.isAnonymous })} />
      <Hint theme={theme}>{draft.isAnonymous ? t("chordOffer.as.anonymous") : name ? t("chordOffer.as.named", { name }) : t("chordOffer.as.namedNoName")}</Hint>
    </>
  )
}

const s = StyleSheet.create({
  field: { gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  capoValue: { minWidth: 110, textAlign: "center", fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  inputBox: { minHeight: 56, borderRadius: CORNER, borderWidth: 1.5, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  editorTap: { paddingVertical: 8 },
  previewContent: { gap: 12, paddingHorizontal: 10, paddingBottom: 16 },
  example: { borderRadius: CORNER, paddingHorizontal: 16, paddingVertical: 12 },
  exampleText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  count: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
})
