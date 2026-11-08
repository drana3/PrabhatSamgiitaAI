import { useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { PianoKeyboard } from "@/components/piano/PianoKeyboard"
import { ActionButton, CheckRow, Chip, Hint } from "@/components/song-chords/parts"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { authHeadersFromStore } from "@/lib/memberAuth"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { bookletPianoSheet } from "@/lib/pianoNotes/booklet"
import { pianoBackend, pianoFailure } from "@/lib/pianoNotes/backend"
import { BEAT_CHOICES, appendToken, draftFromEditor, dropLastToken, editorRowsOf, newEditorRow, rowsFromEditor, type EditorRow } from "@/lib/pianoNotes/editor"
import { EASY_SA, MIDDLE_C, SA_NAMES, keyMidi, saMidi, swaraOfMidi, windowFor } from "@/lib/pianoNotes/keys"
import { pianoHref, targetFromParams } from "@/lib/pianoNotes/links"
import { MAX_ROWS, midisOf, validateDraft } from "@/lib/pianoNotes/rules"
import { forgetPianoRecordingIds } from "@/lib/pianoNotes/shelf"
import { formatSargamLine, parseSargamLine } from "@/lib/pianoNotes/sargamText"
import type { PianoFailure, PianoHand, PianoSheet } from "@/lib/pianoNotes/types"
import { pianoFailureText } from "@/lib/pianoNotes/words"
import { playPianoKey } from "@/lib/pianoPlayback"
import { postingAccess } from "@/lib/songComments/rules"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

/**
 * Write piano notes for a recording or a song: tap the keyboard or type a line like `Sa Re Ga Ma:2 (Sa Ga Pa) 0`. The
 * notes are kept as semitones above Sa, so the person who reads them plays in their own key. A new sheet of a stranger
 * waits for the team; the team's, and the author of the recording's, go live at once, and the screen says which happened.
 * A failure never throws the text away. Needs sign-in; the screen says so in place of the form.
 */
export default function PianoNotesEditScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const bottomInset = useScrollBottomInset(24)
  const params = useLocalSearchParams<{ recording?: string; song?: string; title?: string; edit?: string; copy?: string; from?: string }>()
  const target = useMemo(() => targetFromParams(params), [params.recording, params.song]) // eslint-disable-line react-hooks/exhaustive-deps
  const title = typeof params.title === "string" ? params.title : ""
  const editId = typeof params.edit === "string" ? params.edit : ""
  const copyId = typeof params.copy === "string" ? params.copy : ""
  const fromId = typeof params.from === "string" ? params.from : ""
  const startId = editId || copyId || fromId
  const mode = useAuthStore((s) => s.mode)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const access = postingAccess({ preview: MOCKUP_DATA, signedIn: mode === "signed_in", canProve: Object.keys(authHeadersFromStore()).length > 0 })

  const [saKey, setSaKey] = useState(EASY_SA)
  const [rows, setRows] = useState<EditorRow[]>([newEditorRow()])
  const [active, setActive] = useState(0)
  const [beats, setBeats] = useState<number>(1)
  const [chordMode, setChordMode] = useState(false)
  const [pending, setPending] = useState<number[]>([])
  const [linkUrl, setLinkUrl] = useState("")
  const [note, setNote] = useState("")
  const [anonymous, setAnonymous] = useState(false)
  const [loaded, setLoaded] = useState(!startId)
  const [loadFailure, setLoadFailure] = useState<PianoFailure | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<PianoFailure | null>(null)
  const [sent, setSent] = useState<PianoSheet["status"] | null>(null)
  const [touched, setTouched] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  useEffect(() => {
    if (!startId || !target || access !== "ok") return
    let active0 = true
    const find = async (): Promise<PianoSheet | undefined> => {
      if (fromId && fromId.startsWith("booklet-") && target.kind === "song") return bookletPianoSheet(target.number) ?? undefined
      const list = editId || copyId ? await pianoBackend().mine() : await pianoBackend().list(target)
      return list.find((s) => s.id === startId)
    }
    void find()
      .then((found) => {
        if (!active0) return
        if (found) {
          setSaKey(found.saKey)
          setRows(editorRowsOf(found))
          setLinkUrl(found.linkUrl ?? "")
          setNote(found.note ?? "")
          setAnonymous(found.isAnonymous)
        } else setLoadFailure("gone")
        setLoaded(true)
      })
      .catch((error) => {
        if (!active0) return
        setLoadFailure(pianoFailure(error))
        setLoaded(true)
      })
    return () => {
      active0 = false
    }
  }, [startId, editId, copyId, fromId, target, access])

  const built = useMemo(() => rowsFromEditor(rows), [rows])
  const draft = useMemo(
    () => draftFromEditor({ saKey, rows: built.rows, linkUrl, note, isAnonymous: anonymous, replacesId: copyId || null, basedOnId: fromId && !fromId.startsWith("booklet-") ? fromId : null }),
    [saKey, built.rows, linkUrl, note, anonymous, copyId, fromId],
  )
  const problem: PianoFailure | "words" | null = built.problems.length > 0 ? "words" : built.rows.length === 0 ? null : validateDraft(draft)
  const window = useMemo(() => windowFor([...midisOf(built.rows, saKey), MIDDLE_C, MIDDLE_C + 23]), [built.rows, saKey])
  const back = () => {
    if (router.canGoBack()) router.back()
    else router.replace(href(target ? pianoHref(target, title) : "/kiirtan"))
  }

  const setRow = (index: number, patch: Partial<EditorRow>) => {
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    if (failure) setFailure(null)
  }
  const commit = (token: string) => setRow(active, { text: appendToken(rows[active]?.text ?? "", token) })
  const tail = beats === 1 ? "" : `:${beats}`
  const tapKey = (midi: number) => {
    void playPianoKey(midi)
    const k = midi - saMidi(saKey)
    if (chordMode) setPending((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k].slice(0, 6)))
    else commit(formatSargamLine([{ k: [k], b: beats }]))
  }
  const lit = useMemo(() => new Map(pending.map((k) => [keyMidi(k, saKey), "right" as PianoHand])), [pending, saKey])

  const ready = built.rows.length > 0 && !problem && !busy && target !== null
  const submit = async () => {
    setTouched(true)
    if (!ready || !target) return
    setBusy(true)
    setFailure(null)
    try {
      const sheet = editId ? await pianoBackend().update(editId, draft) : await pianoBackend().offer(target, draft)
      forgetPianoRecordingIds()
      if (alive.current) setSent(sheet.status)
    } catch (error) {
      if (alive.current) setFailure(pianoFailure(error))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const input = [s.input, { backgroundColor: theme.page, borderColor: theme.line, color: theme.textHeading }]
  const body = () => {
    if (!target) return <Hint theme={theme} tone="danger">{t("piano.missing")}</Hint>
    if (access !== "ok") {
      return (
        <View style={s.stack}>
          <Hint theme={theme}>{t("piano.signin.text")}</Hint>
          {access === "signin" ? <ActionButton theme={theme} label={t("piano.signin.action")} onPress={() => router.push(href("/signin"))} /> : null}
        </View>
      )
    }
    if (sent) {
      return (
        <View style={s.stack}>
          <Text style={[s.sent, { color: theme.textHeading }]} accessibilityLiveRegion="polite">{t(sent === "published" ? "piano.sent.published" : "piano.sent.pending")}</Text>
          <ActionButton theme={theme} label={t("piano.sent.back")} onPress={back} />
        </View>
      )
    }
    if (!loaded) return <Hint theme={theme}>{t("piano.loading")}</Hint>
    if (loadFailure) return <Hint theme={theme} tone="danger">{pianoFailureText(t, loadFailure)}</Hint>
    return (
      <View style={s.stack}>
        {MOCKUP_DATA ? <Hint theme={theme}>{t("piano.preview")}</Hint> : null}
        <Hint theme={theme}>{t("piano.edit.intro")}</Hint>

        <View style={s.gap6}>
          <Text style={[s.label, { color: theme.textHeading }]}>{t("piano.edit.sa")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} accessibilityRole="tablist">
            {SA_NAMES.map((name) => (
              <Chip key={name} theme={theme} label={name} on={saKey === name} onPress={() => setSaKey(name)} minWidth={52} />
            ))}
          </ScrollView>
          <Hint theme={theme}>{t("piano.edit.sa.hint")}</Hint>
        </View>

        {rows.map((row, index) => {
          const bad = built.problems.find((p) => p.row === index)
          const isActive = index === active
          return (
            <View key={index} style={[s.rowCard, { borderColor: isActive ? theme.ink900 : theme.line, backgroundColor: theme.card }]}>
              <View style={s.rowHead}>
                <Chip theme={theme} role="radio" label={t("piano.row", { n: index + 1 })} on={isActive} onPress={() => setActive(index)} />
                <TextInput
                  value={row.label}
                  onChangeText={(label) => setRow(index, { label })}
                  placeholder={t("piano.edit.label")}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("piano.edit.label")}
                  maxLength={40}
                  style={[...input, s.labelInput]}
                />
              </View>
              <TextInput
                value={row.text}
                onChangeText={(text) => setRow(index, { text })}
                onFocus={() => setActive(index)}
                placeholder="Sa Re Ga Ma:2 (Sa Ga Pa) 0"
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t("piano.edit.line")}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                style={[...input, s.lineInput]}
              />
              {bad ? <Hint theme={theme} tone="danger">{t("piano.edit.bad", { words: bad.bad.join(" ") })}</Hint> : <Hint theme={theme}>{t("piano.edit.count", { count: parseSargamLine(row.text).steps.length })}</Hint>}
              <View style={s.rowTools}>
                <Chip theme={theme} role="radio" label={t("piano.hand.right")} on={row.hand === "right"} onPress={() => setRow(index, { hand: "right" })} />
                <Chip theme={theme} role="radio" label={t("piano.hand.left")} on={row.hand === "left"} onPress={() => setRow(index, { hand: "left" })} />
                <View style={s.repeatBox}>
                  <Chip theme={theme} role="button" label="−" a11y={t("piano.edit.repeat.less")} onPress={() => setRow(index, { repeat: Math.max(1, row.repeat - 1) })} minWidth={44} />
                  <Text style={[s.repeat, { color: theme.textHeading }]}>{t("piano.repeat", { count: row.repeat })}</Text>
                  <Chip theme={theme} role="button" label="+" a11y={t("piano.edit.repeat.more")} onPress={() => setRow(index, { repeat: Math.min(16, row.repeat + 1) })} minWidth={44} />
                </View>
                {rows.length > 1 ? (
                  <Chip
                    theme={theme}
                    role="button"
                    danger
                    label={t("piano.edit.removeRow")}
                    onPress={() => {
                      setRows((list) => list.filter((_, i) => i !== index))
                      setActive(0)
                    }}
                  />
                ) : null}
              </View>
            </View>
          )
        })}
        {rows.length < MAX_ROWS ? (
          <ActionButton
            theme={theme}
            tone="quiet"
            label={t("piano.edit.addRow")}
            onPress={() => {
              setRows((list) => [...list, newEditorRow()])
              setActive(rows.length)
            }}
          />
        ) : null}

        <View style={s.gap6}>
          <Text style={[s.label, { color: theme.textHeading }]}>{t("piano.edit.keys", { row: active + 1 })}</Text>
          <PianoKeyboard theme={theme} window={window} sa={saKey} lit={lit} onPressKey={tapKey} />
          <View style={s.chips}>
            {BEAT_CHOICES.map((b) => (
              <Chip key={b} theme={theme} label={t("piano.edit.beats", { beats: b })} on={beats === b} onPress={() => setBeats(b)} />
            ))}
          </View>
          <View style={s.chips}>
            <Chip theme={theme} role="checkbox" label={t("piano.edit.chord")} on={chordMode} onPress={() => { setChordMode((v) => !v); setPending([]) }} />
            {chordMode ? (
              <Chip
                theme={theme}
                role="button"
                label={t("piano.edit.chord.add", { count: pending.length })}
                onPress={() => {
                  if (pending.length === 0) return
                  commit(formatSargamLine([{ k: [...pending].sort((a, b) => a - b), b: beats }]))
                  setPending([])
                }}
              />
            ) : null}
            <Chip theme={theme} role="button" label={t("piano.edit.rest")} onPress={() => commit(`0${tail}`)} />
            <Chip theme={theme} role="button" label={t("piano.edit.undo")} onPress={() => setRow(active, { text: dropLastToken(rows[active]?.text ?? "") })} />
          </View>
          {chordMode && pending.length > 0 ? <Hint theme={theme}>{pending.map((k) => swaraOfMidi(keyMidi(k, saKey), saKey)).join(" ")}</Hint> : null}
        </View>

        <View style={s.gap6}>
          <Text style={[s.label, { color: theme.textHeading }]}>{t("piano.edit.note")}</Text>
          <TextInput value={note} onChangeText={setNote} placeholder={t("piano.edit.note.placeholder")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("piano.edit.note")} maxLength={300} style={input} />
          <Text style={[s.label, { color: theme.textHeading }]}>{t("piano.edit.link")}</Text>
          <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="https://" placeholderTextColor={theme.textMuted} accessibilityLabel={t("piano.edit.link")} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={300} style={input} />
          <Hint theme={theme}>{t("piano.edit.link.hint")}</Hint>
          <CheckRow theme={theme} on={anonymous} label={t("piano.edit.anonymous")} onToggle={() => setAnonymous((v) => !v)} />
        </View>

        {touched && problem ? <Hint theme={theme} tone="danger">{problem === "words" ? t("piano.edit.fixWords") : pianoFailureText(t, problem)}</Hint> : null}
        {touched && !problem && built.rows.length === 0 ? <Hint theme={theme} tone="danger">{pianoFailureText(t, "tooFew")}</Hint> : null}
        {failure ? <Hint theme={theme} tone="danger">{pianoFailureText(t, failure)}</Hint> : null}
        {!isAdmin && !editId ? <Hint theme={theme}>{t("piano.edit.review")}</Hint> : null}
        <ActionButton theme={theme} label={busy ? t("piano.sending") : t(editId ? "piano.save" : "piano.submit")} onPress={() => void submit()} disabled={busy || built.rows.length === 0} busy={busy} />
      </View>
    )
  }

  return (
    <View style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("piano.close")} onClose={back} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingBottom: bottomInset }]}>
          <Reveal index={0} style={s.head}>
            {title ? <Text style={[s.over, { color: theme.accent }]} numberOfLines={2}>{`${t("piano.edit.over")} ${title}`}</Text> : null}
            <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">{t(editId ? "piano.edit.titleEdit" : "piano.edit.title")}</Text>
          </Reveal>
          <Reveal index={1}>{body()}</Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  head: { gap: 8 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8, textTransform: "uppercase" },
  stack: { gap: 16 },
  gap6: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  sent: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 28 },
  input: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, minHeight: 48, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, outlineStyle: "none" as never },
  labelInput: { flex: 1, minHeight: 44 },
  lineInput: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  rowCard: { borderWidth: 1.5, borderRadius: 20, padding: 12, gap: 8 },
  rowHead: { flexDirection: "row", gap: 8, alignItems: "center" },
  rowTools: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  repeatBox: { flexDirection: "row", alignItems: "center", gap: 8 },
  repeat: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, minWidth: 32, textAlign: "center" },
})
