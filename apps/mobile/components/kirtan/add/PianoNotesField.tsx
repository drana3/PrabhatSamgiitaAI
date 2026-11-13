import { useMemo } from "react"
import { Platform, StyleSheet, Text, TextInput, View } from "react-native"

import { KeyPicker } from "@/components/kirtan/add/KeyPicker"
import { KPress } from "@/components/kirtan/KPress"
import { CORNER, Hint, Label } from "@/components/song-chords/parts"
import { MONO } from "@/components/recording-extras/ui"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useT } from "@/lib/i18n"
import { keyOptions } from "@/lib/kirtan/keyPicker"
import { useUx } from "@/lib/kirtan/useUx"
import { SA_NAMES } from "@/lib/pianoNotes/keys"
import { newPianoUploadDraft, readPianoUpload, type PianoUploadDraft } from "@/lib/pianoNotes/uploadDraft"
import { pianoFailureText } from "@/lib/pianoNotes/words"
import { usePianoNotesPendingStore } from "@/stores/pianoNotesPendingStore"

const SA_OPTIONS = keyOptions(SA_NAMES)

/**
 * Piano notes on the Add Recording form: where Sa sits and the notes typed as text, one line = one row. It reads the text with the
 * same parser as the notes screen (app/piano-notes-edit.tsx) and says at once what it did not understand. Nothing here blocks the
 * upload: the notes go to the recording after it is published (stores/pianoNotesPendingStore.ts), and after the send the field says
 * whether they arrived and offers "Send the notes again".
 */
export function PianoNotesField({ theme, storeKey, title, locked }: { theme: SongsTheme; storeKey: string; title: string; locked?: boolean }) {
  const t = useT()
  const ux = useUx()
  const draft = usePianoNotesPendingStore((s) => s.drafts[storeKey]) ?? newPianoUploadDraft()
  const result = usePianoNotesPendingStore((s) => s.results[storeKey])
  const setDraft = usePianoNotesPendingStore((s) => s.setDraft)
  const retry = usePianoNotesPendingStore((s) => s.retry)
  const reading = useMemo(() => readPianoUpload(draft), [draft])
  const change = (patch: Partial<PianoUploadDraft>) => setDraft(storeKey, { ...draft, ...patch })
  const webField = Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null

  if (result?.status === "sent") return <Hint theme={theme}>{ux("ux.notes.sent", { title })}</Hint>
  if (result?.status === "failed") {
    const reason = result.failure === "words" ? ux("ux.notes.bad", { words: reading.bad.join(" ") }) : pianoFailureText(t, result.failure ?? "server")
    return (
      <View style={s.group}>
        <Hint theme={theme} tone="danger">{ux("ux.notes.failed", { reason })}</Hint>
        <KPress accessibilityRole="button" accessibilityLabel={ux("ux.notes.retry")} onPress={() => void retry(storeKey)} pressedScale={0.97} style={[s.retry, { borderColor: theme.line }]}>
          <Text style={[s.retryText, { color: theme.textHeading }]}>{ux("ux.notes.retry")}</Text>
        </KPress>
      </View>
    )
  }

  const problem = reading.problem === "words" ? ux("ux.notes.bad", { words: reading.bad.join(" ") }) : reading.problem ? pianoFailureText(t, reading.problem) : null
  return (
    <View style={s.root}>
      <KeyPicker theme={theme} label={t("piano.edit.sa")} explain={t("keyPicker.explain.sa")} options={SA_OPTIONS} value={draft.saKey} onChange={(saKey) => !locked && change({ saKey })} testID="upload-piano-sa" />
      <View style={s.group}>
        <Label theme={theme}>{ux("ux.notes.label")}</Label>
        <View style={[s.box, { backgroundColor: theme.card, borderColor: problem ? theme.dangerText : theme.line }]}>
          <TextInput
            value={draft.text}
            onChangeText={(text) => change({ text })}
            multiline
            editable={!locked}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            maxLength={4000}
            placeholder={ux("ux.notes.placeholder")}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={ux("ux.notes.label")}
            style={[s.text, webField, { color: theme.textHeading }]}
          />
        </View>
        <Hint theme={theme}>{ux("ux.notes.hint")}</Hint>
        {problem ? <Hint theme={theme} tone="danger">{problem}</Hint> : reading.notes > 0 ? <Hint theme={theme}>{ux("ux.notes.read", { count: reading.notes })}</Hint> : null}
        <Hint theme={theme}>{ux("ux.notes.live")}</Hint>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { gap: 16 },
  group: { gap: 8 },
  box: { borderRadius: CORNER, borderWidth: 1.5, minHeight: 120 },
  text: { minHeight: 120, paddingHorizontal: 16, paddingVertical: 16, fontFamily: MONO, fontSize: 15, lineHeight: 22, textAlignVertical: "top" },
  retry: { minHeight: 44, paddingHorizontal: 16, borderRadius: 9999, borderWidth: 1.5, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  retryText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
})
