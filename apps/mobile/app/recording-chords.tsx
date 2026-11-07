import { useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { ChordFields } from "@/components/recording-extras/ChordFields"
import { ActionButton, Hint } from "@/components/song-chords/parts"
import { Reveal } from "@/components/today/motion"
import { amFonts } from "@/constants/tokens/amTypography"
import { useScrollBottomInset } from "@/hooks/useScrollBottomInset"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useT } from "@/lib/i18n"
import { authHeadersFromStore } from "@/lib/memberAuth"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { sheetFailure, sheetsBackend } from "@/lib/recordingChords/backend"
import { draftProblem, isBlankDraft, newSheetDraft } from "@/lib/recordingChords/rules"
import type { RecordingSheet, SheetDraft, SheetFailure } from "@/lib/recordingChords/types"
import { draftProblemText, sheetFailureText } from "@/lib/recordingChords/words"
import { recordingPageHref } from "@/lib/recordingExtras/links"
import { postingAccess } from "@/lib/songComments/rules"
import { PREVIEW_NAME } from "@/lib/songComments/mock"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

type Sent = { status: RecordingSheet["status"] }

const draftOf = (sheet: RecordingSheet): SheetDraft => ({
  instrument: sheet.instrument,
  key: sheet.chartKey ?? "",
  body: sheet.body,
  playedIt: sheet.playedIt,
  note: sheet.note ?? "",
  isAnonymous: sheet.isAnonymous,
})

/**
 * "Add chords" to a recording (docs/recording-extras.md), or change a waiting or rejected chart of one's own. A plain
 * text chart, an instrument, an optional key, an optional note, and the anonymous choice. A new chart waits for the
 * team before others see it (the team's own charts go live at once), and the screen says which happened. A failure
 * never throws the text away. Needs sign-in; the screen says so in place of the form.
 */
export default function RecordingChordsScreen() {
  const tr = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const bottomInset = useScrollBottomInset(24)
  const params = useLocalSearchParams<{ recording?: string; title?: string; edit?: string }>()
  const recordingId = typeof params.recording === "string" ? params.recording : ""
  const title = typeof params.title === "string" ? params.title : ""
  const editId = typeof params.edit === "string" ? params.edit : ""
  const mode = useAuthStore((s) => s.mode)
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const myName = useAuthStore((s) => s.displayName)
  const access = postingAccess({ preview: MOCKUP_DATA, signedIn: mode === "signed_in", canProve: Object.keys(authHeadersFromStore()).length > 0 })
  const name = mode === "signed_in" ? myName : MOCKUP_DATA ? PREVIEW_NAME : ""

  const [draft, setDraft] = useState<SheetDraft>(newSheetDraft("guitar"))
  const [loaded, setLoaded] = useState(!editId)
  const [loadFailure, setLoadFailure] = useState<SheetFailure | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<SheetFailure | null>(null)
  const [sent, setSent] = useState<Sent | null>(null)
  const [touched, setTouched] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => void (alive.current = false), [])

  useEffect(() => {
    if (!editId || access !== "ok") return
    let active = true
    void sheetsBackend()
      .mine()
      .then((mine) => {
        if (!active) return
        const found = mine.find((s) => s.id === editId)
        if (found) setDraft(draftOf(found))
        else setLoadFailure("gone")
        setLoaded(true)
      })
      .catch((error) => {
        if (!active) return
        setLoadFailure(sheetFailure(error))
        setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [editId, access])

  const problem = isBlankDraft(draft) ? null : draftProblem(draft)
  const ready = !isBlankDraft(draft) && !problem && !busy && recordingId !== ""
  const back = () => (router.canGoBack() ? router.back() : router.replace(href(recordingId ? recordingPageHref(recordingId) : "/kiirtan")))

  const submit = async () => {
    setTouched(true)
    if (!ready) return
    setBusy(true)
    setFailure(null)
    try {
      const sheet = editId ? await sheetsBackend().update(editId, draft) : await sheetsBackend().offer(recordingId, draft)
      if (alive.current) setSent({ status: sheet.status })
    } catch (error) {
      if (alive.current) setFailure(sheetFailure(error))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const body = () => {
    if (!recordingId) return <Hint theme={theme} tone="danger">{tr("recPage.missing")}</Hint>
    if (access !== "ok") {
      return (
        <View style={styles.stack}>
          <Hint theme={theme}>{tr("recChordsForm.signin.text")}</Hint>
          {access === "signin" ? <ActionButton theme={theme} label={tr("recChordsForm.signin.action")} onPress={() => router.push(href("/signin"))} /> : null}
        </View>
      )
    }
    if (sent) {
      return (
        <View style={styles.stack}>
          <Text style={[styles.sent, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
            {tr(sent.status === "published" ? "recChordsForm.sent.published" : "recChordsForm.sent.pending")}
          </Text>
          <ActionButton theme={theme} label={tr("recChordsForm.back")} onPress={back} />
        </View>
      )
    }
    if (!loaded) return <Hint theme={theme}>{tr("recChords.loading")}</Hint>
    if (loadFailure) return <Hint theme={theme} tone="danger">{sheetFailureText(tr, loadFailure)}</Hint>
    return (
      <View style={styles.stack}>
        {MOCKUP_DATA ? <Hint theme={theme}>{tr("recChordsForm.preview")}</Hint> : null}
        <ChordFields
          theme={theme}
          draft={draft}
          onChange={(next) => {
            setDraft(next)
            if (failure) setFailure(null)
          }}
          name={name}
          problem={touched && problem ? draftProblemText(tr, problem) : null}
          disabled={busy}
          review={!isAdmin && !editId}
        />
        {failure ? <Hint theme={theme} tone="danger">{sheetFailureText(tr, failure)}</Hint> : null}
        <ActionButton theme={theme} label={busy ? tr("recChordsForm.sending") : tr(editId ? "recChordsForm.save" : "recChordsForm.submit")} onPress={() => void submit()} disabled={busy || isBlankDraft(draft)} busy={busy} />
      </View>
    )
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={tr("recChords.close")} onClose={back} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}>
          <Reveal index={0} style={styles.head}>
            {title ? <Text style={[styles.over, { color: theme.accent }]}>{`${tr("recChordsForm.over")} ${title}`}</Text> : null}
            <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
              {tr(editId ? "recChordsForm.edit" : "recChordsForm.title")}
            </Text>
          </Reveal>
          <Reveal index={1}>{body()}</Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  head: { gap: 8 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8, textTransform: "uppercase" },
  stack: { gap: 16 },
  sent: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 28 },
})
