import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { SheetTopBar } from "@/components/common/SheetTopBar"
import { ChordSheet } from "@/components/song-chords/ChordSheet"
import { ConfirmDialog, type DialogAction } from "@/components/song-chords/ConfirmDialog"
import { ChordEntryField, ConfirmFields, InstrumentField, KeyCapoField, OptionalFields, PreviewField } from "@/components/song-chords/OfferFields"
import { ActionButton, CORNER, Hint, Label } from "@/components/song-chords/parts"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useChordSelection } from "@/hooks/useChordSelection"
import { useChordTeam } from "@/hooks/useChordTeam"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useFormFocus } from "@/lib/forms/useFormFocus"
import { useT } from "@/lib/i18n"
import { authHeadersFromStore } from "@/lib/memberAuth"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { sheetFailure, sheetsBackend } from "@/lib/recordingChords/backend"
import {
  chartDraftFromOther,
  chartDraftFromSheet,
  chartProblems,
  chartWordCounts,
  chordsLostBy,
  isChart,
  newChartDraft,
  pasteToLines,
  retext,
  toChartPayload,
  type ChartDraft,
  type ChartProblem,
  type PasteProblem,
} from "@/lib/recordingChords/chart"
import { kindHasCharts } from "@/lib/recordingChords/kinds"
import type { RecordingSheet, SheetFailure } from "@/lib/recordingChords/types"
import { sheetFailureText } from "@/lib/recordingChords/words"
import { recordingPageHref } from "@/lib/recordingExtras/links"
import { PREVIEW_NAME } from "@/lib/songComments/mock"
import { postingAccess } from "@/lib/songComments/rules"
import { usedChords } from "@/lib/songChords/chordName"
import type { ParseMeta } from "@/lib/songChords/chordPro"
import { STRUM_MAX, countChords, nextSlot, previousSlot, replaceLines, setCapo, setInstrument, type Draft, type Placement } from "@/lib/songChords/draft"
import { allKirtans } from "@/lib/kirtan/catalog"
import { useAuthStore } from "@/stores/authStore"
import { href } from "@/utils/href"

type Entry = { kind: "new"; instrument: "guitar" | "harmonium" } | { kind: "edit" | "copy" | "from"; id: string }

/** What the screen was opened for, read from its address. An id wins over a bare instrument. */
function entryOf(params: { edit?: string; copy?: string; from?: string; instrument?: string }): Entry {
  if (typeof params.edit === "string" && params.edit) return { kind: "edit", id: params.edit }
  if (typeof params.copy === "string" && params.copy) return { kind: "copy", id: params.copy }
  if (typeof params.from === "string" && params.from) return { kind: "from", id: params.from }
  return { kind: "new", instrument: params.instrument === "harmonium" ? "harmonium" : "guitar" }
}

/** Everything the member can change, as one string: whether the work differs from where it began. */
function signature(d: ChartDraft): string {
  return JSON.stringify([d.text, d.lines, d.instrument, d.key, d.capo, d.strum, d.note, d.playedIt, d.isAnonymous])
}

/**
 * Add a chord chart to a Bhajan or a Spiritual song (docs/recording-extras.md). A recording has no lyrics of its own, so the
 * member pastes the words of the song and puts chords over them with the same line editor, key and capo questions and preview
 * as the Prabhat Samgiita screen (components/song-chords/OfferFields.tsx). The chart keeps its own words. The same screen fixes
 * a waiting or rejected chart (`?edit=`), makes a changed copy of a live one (`?copy=`; it replaces the live one once accepted)
 * and starts from somebody else's published chart (`?from=`; the first author is credited). A Kiirtan never comes here.
 */
export default function RecordingChartScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const spTheme = useSpTheme()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ recording?: string; title?: string; edit?: string; copy?: string; from?: string; instrument?: string }>()
  const recordingId = typeof params.recording === "string" ? params.recording : ""
  const title = typeof params.title === "string" ? params.title : ""
  const [entry] = useState<Entry>(() => entryOf(params))

  const mode = useAuthStore((s) => s.mode)
  const myName = useAuthStore((s) => s.displayName)
  const access = postingAccess({ preview: MOCKUP_DATA, signedIn: mode === "signed_in", canProve: Object.keys(authHeadersFromStore()).length > 0 })
  const name = mode === "signed_in" ? (myName && myName !== "Guest" ? myName : "") : MOCKUP_DATA ? PREVIEW_NAME : ""
  const { team } = useChordTeam(access === "ok")

  // a Kiirtan (or any other kind) has no chart: this screen is for a Bhajan and a Spiritual song only
  const kindOk = useMemo(() => {
    if (!recordingId) return false
    const found = allKirtans().find((k) => k.serverId === recordingId || k.id === recordingId)
    // when the app does not know the recording (opened from a link), the server has the last word
    return found ? kindHasCharts(found.kind) : true
  }, [recordingId])

  const [draft, setDraft] = useState<ChartDraft>(() => {
    const d = newChartDraft()
    return entry.kind === "new" ? { ...d, ...setInstrument(d, entry.instrument) } : d
  })
  const [baseline, setBaseline] = useState(() => signature(newChartDraft()))
  const [phase, setPhase] = useState<"loading" | "edit" | "gone">(entry.kind === "new" ? "edit" : "loading")
  const [linked, setLinked] = useState<RecordingSheet | null>(null)
  const [loadFailure, setLoadFailure] = useState<SheetFailure | null>(null)

  // load the chart being fixed, changed or started from
  useEffect(() => {
    if (entry.kind === "new" || access !== "ok" || !recordingId) return undefined
    let active = true
    const source = entry.kind === "from" ? sheetsBackend().list(recordingId) : sheetsBackend().mine()
    source
      .then((items) => {
        if (!active) return
        const found = items.find((s) => s.id === entry.id) ?? null
        if (!found || !isChart(found) || (entry.kind === "from" && (found.status !== "published" || found.mine))) {
          setPhase("gone")
          return
        }
        const base = entry.kind === "from" ? chartDraftFromOther(found) : chartDraftFromSheet(found, entry.kind)
        setLinked(found)
        setDraft(base)
        setBaseline(signature(base))
        setPhase("edit")
      })
      .catch((error) => {
        if (!active) return
        setLoadFailure(sheetFailure(error))
        setPhase("gone")
      })
    return () => {
      active = false
    }
  }, [entry, access, recordingId])

  const locked = Boolean(draft.editId || draft.basedOn)
  const counts = useMemo(() => chartWordCounts(draft.text), [draft.text])
  const hasText = draft.text.some(Boolean)
  const lines = hasText ? draft.text : null
  const total = countChords(draft)
  const used = useMemo(() => usedChords(draft.lines), [draft.lines])
  const dirty = signature(draft) !== baseline

  // ---- the words ----
  const [raw, setRaw] = useState("")
  const [changingText, setChangingText] = useState(false)
  const [pasteProblem, setPasteProblem] = useState<PasteProblem | null>(null)
  const [pendingText, setPendingText] = useState<string[] | null>(null)
  const askingForText = !hasText || changingText

  const applyText = (text: string[]) => {
    setDraft((d) => retext(d, text))
    setPendingText(null)
    setChangingText(false)
    setPasteProblem(null)
  }
  const useWords = () => {
    const result = pasteToLines(raw)
    if ("problem" in result) {
      setPasteProblem(result.problem)
      return
    }
    // chords sit on words: if the new words would take some away, say so first
    if (chordsLostBy(draft, result.lines) > 0) setPendingText(result.lines)
    else applyText(result.lines)
  }
  const changeWords = () => {
    setRaw(draft.text.join("\n"))
    setPasteProblem(null)
    setChangingText(true)
  }

  // ---- sending ----
  const [moreOpen, setMoreOpen] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<SheetFailure | null>(null)
  const [sent, setSent] = useState<RecordingSheet | null>(null)
  const [leaving, setLeaving] = useState(false)
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )
  // ---- the chord editor ----
  const form = useFormFocus()
  const picked = useChordSelection({ lines, setDraft, currentDraft: draft, enabled: phase === "edit" && !sent, scrollRef: form.scrollRef })
  const { entryMode, setEntryMode, selected, setSelected, selectedWord, lastWord, currentChord, sheetOpen, pick, closeSheet, covered, setCovered, areaRef, offsetRef, nodes } = picked

  const patch = useCallback((change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change })), [])
  const applyPasted = (pasted: Placement[][], meta: ParseMeta) => {
    setDraft((d) => {
      let next = replaceLines(d, pasted) as ChartDraft
      if (meta.capo !== undefined && next.instrument === "guitar") next = setCapo(next, meta.capo) as ChartDraft
      if (meta.key) next = { ...next, key: meta.key }
      if (meta.strum && next.instrument === "guitar") next = { ...next, strum: meta.strum.slice(0, STRUM_MAX) }
      return next
    })
    setEntryMode("tap")
  }

  const problems: ChartProblem[] = useMemo(() => chartProblems(draft), [draft])
  const problemText = (p: ChartProblem) => (p === "noText" ? t("recChart.problem.noText") : t(`chordOffer.problem.${p}`))
  const fieldOf = (p: ChartProblem) => (p === "noText" ? "text" : p === "strumShape" ? "strum" : p === "noteTooLong" ? "note" : p === "notPlayed" ? "played" : "chords")
  /** the sentence of a field that is wrong, whether or not the form shows it yet */
  const messageFor = (field: string): string | null => {
    const found = problems.find((p) => fieldOf(p) === field)
    return found ? problemText(found) : null
  }
  /** ...and the one the form shows: only once Send was pressed with something wrong */
  const errorFor = (field: string): string | null => (showProblems ? messageFor(field) : null)

  const back = () => (router.canGoBack() ? router.back() : router.replace(href(recordingId ? recordingPageHref(recordingId) : "/kiirtan")))
  const requestClose = () => {
    if (phase === "edit" && !sent && dirty && (total > 0 || hasText)) setLeaving(true)
    else back()
  }

  const send = async () => {
    setFailure(null)
    if (problems.length) {
      setShowProblems(true)
      setSelected(null)
      const order = ["text", "chords", "strum", "note", "played"]
      const keys = order.filter((f) => problems.some((p) => fieldOf(p) === f))
      const messages: Record<string, string> = {}
      for (const f of keys) messages[f] = messageFor(f) ?? ""
      void form.focusFirst(keys, messages)
      return
    }
    setBusy(true)
    try {
      const payload = toChartPayload(draft)
      const sheet = draft.editId ? await sheetsBackend().updateChart(draft.editId, payload) : await sheetsBackend().offerChart(recordingId, payload)
      if (!alive.current) return
      setSelected(null)
      setSent(sheet)
    } catch (error) {
      if (alive.current) setFailure(sheetFailure(error))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const kind: "edit" | "copy" | null = draft.editId ? "edit" : draft.basedOn ? "copy" : null
  const heading = kind === "edit" ? t("recChart.title.fix") : kind === "copy" ? t("recChart.title.copy") : t("recChart.title")
  const sendLabel = busy ? t("recChordsForm.sending") : kind === "copy" ? t("recChart.send.copy") : kind === "edit" ? t("recChart.send.again") : t("recChart.send")

  const leaveActions: DialogAction[] = [
    { label: t("recChart.leave.stay"), tone: "quiet", onPress: () => setLeaving(false) },
    {
      label: t("recChart.leave.yes"),
      tone: "danger",
      onPress: () => {
        setLeaving(false)
        back()
      },
    },
  ]
  const lostActions: DialogAction[] = [
    { label: t("recChart.lost.keep"), tone: "quiet", onPress: () => setPendingText(null) },
    { label: t("recChart.lost.yes"), tone: "danger", onPress: () => pendingText && applyText(pendingText) },
  ]

  const body = () => {
    if (!recordingId) return <Hint theme={theme} tone="danger">{t("recPage.missing")}</Hint>
    if (!kindOk) return <Hint theme={theme} tone="danger">{t("recChart.wrongKind")}</Hint>
    if (access !== "ok") {
      return (
        <View style={s.field}>
          <Hint theme={theme}>{t("recChordsForm.signin.text")}</Hint>
          {access === "signin" ? <ActionButton theme={theme} label={t("recChordsForm.signin.action")} onPress={() => router.push(href("/signin"))} /> : null}
        </View>
      )
    }
    if (sent) {
      return (
        <View style={s.field} accessibilityLiveRegion="polite">
          <Text style={[s.sent, { color: theme.textHeading }]}>{t(sent.status === "published" ? "recChart.sent.published" : "recChart.sent.pending")}</Text>
          {sent.status !== "published" && sent.replaces ? <Hint theme={theme}>{t("recChart.sent.replaces")}</Hint> : null}
          <ActionButton theme={theme} label={t("recChordsForm.back")} onPress={back} />
        </View>
      )
    }
    if (phase === "loading") return <Hint theme={theme}>{t("recChords.loading")}</Hint>
    if (phase === "gone") {
      return (
        <View style={s.field} accessibilityLiveRegion="polite">
          <Hint theme={theme} tone="danger">{loadFailure ? sheetFailureText(t, loadFailure) : t("recChart.gone")}</Hint>
          <ActionButton theme={theme} tone="quiet" label={t("recChordsForm.back")} onPress={back} />
        </View>
      )
    }
    const rejected = kind === "edit" && linked?.status === "rejected"
    return (
      <>
        <Reveal index={1} style={s.field}>
          {kind === "edit" ? (
            <View style={[s.banner, { borderColor: rejected ? theme.dangerText : theme.line, backgroundColor: theme.card }]} accessibilityLiveRegion="polite">
              <Hint theme={theme} tone={rejected ? "danger" : "body"}>{t(rejected ? "recChart.edit.rejected" : "recChart.edit.pending")}</Hint>
              {rejected && linked?.rejectedReason ? <Text style={[s.reason, { color: theme.textHeading }]}>{t("recChords.reason", { reason: linked.rejectedReason })}</Text> : null}
              <Hint theme={theme}>{t("recChart.edit.locked")}</Hint>
            </View>
          ) : kind === "copy" ? (
            <Hint theme={theme}>{t("recChart.edit.copy")}</Hint>
          ) : draft.startedFrom ? (
            <Hint theme={theme}>{t("recChart.edit.from")}</Hint>
          ) : (
            <Hint theme={theme}>{t("recChart.intro")}</Hint>
          )}
          {team && !kind ? <Hint theme={theme}>{t("chordOffer.intro.team")}</Hint> : null}
        </Reveal>

        {/* 1. the words of the song */}
        <Reveal index={2} style={s.field}>
          <View {...form.field("text")} style={s.field}>
            <Label theme={theme}>{t("recChart.text.label")}</Label>
            {askingForText ? (
              <>
                <Hint theme={theme}>{t("recChart.text.hint")}</Hint>
                <View style={[s.box, { backgroundColor: theme.card, borderColor: pasteProblem || errorFor("text") ? amColors.danger : theme.line }]}>
                  <TextInput
                    ref={form.input("text") as never}
                    value={raw}
                    onChangeText={(next) => {
                      setRaw(next)
                      setPasteProblem(null)
                    }}
                    onFocus={closeSheet}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    placeholder={t("recChart.text.placeholder")}
                    placeholderTextColor={theme.textMuted}
                    accessibilityLabel={t("recChart.text.label")}
                    style={[s.input, { color: theme.textHeading }]}
                  />
                </View>
                {pasteProblem || errorFor("text") ? (
                  <Hint theme={theme} tone="danger">
                    {pasteProblem ? t(`recChart.text.problem.${pasteProblem}`) : errorFor("text")}
                  </Hint>
                ) : null}
                <ActionButton theme={theme} label={t("recChart.text.use")} onPress={useWords} disabled={!raw.trim()} />
                {changingText ? <ActionButton theme={theme} tone="quiet" label={t("recChart.lost.keep")} onPress={() => setChangingText(false)} /> : null}
              </>
            ) : (
              <>
                <Text style={[s.count, { color: theme.textBody }]}>{t("recChart.text.lines", { count: draft.text.filter(Boolean).length })}</Text>
                <ActionButton theme={theme} tone="quiet" label={t("recChart.text.change")} onPress={changeWords} />
              </>
            )}
          </View>
        </Reveal>

        {hasText && !askingForText ? (
          <>
            {/* 2. instrument */}
            <Reveal index={3} style={s.field}>
              <InstrumentField theme={theme} draft={draft} locked={locked} patch={patch} />
            </Reveal>

            {/* 3. key (and capo for a guitar) */}
            <Reveal index={4} style={s.field}>
              <KeyCapoField theme={theme} draft={draft} patch={patch} />
            </Reveal>

            {/* 4. the chords over the words */}
            <Reveal index={5} style={s.field}>
              <ChordEntryField
                theme={theme}
                form={form}
                error={errorFor("chords")}
                draft={draft}
                lines={lines}
                entryMode={entryMode}
                onMode={setEntryMode}
                selected={selected}
                onSelect={setSelected}
                nodes={nodes}
                onClose={closeSheet}
                onApply={applyPasted}
              />
            </Reveal>

            {/* 5. the preview */}
            <PreviewField theme={theme} spTheme={spTheme} draft={draft} lines={draft.text} counts={counts} />

            {/* 6. the optional part */}
            <View style={s.field}>
              <OptionalFields theme={theme} form={form} draft={draft} patch={patch} fieldError={errorFor} open={moreOpen} onOpen={() => setMoreOpen(true)} onFocus={closeSheet} />
            </View>

            {/* 7. confirm and send */}
            <View style={s.field}>
              <ConfirmFields theme={theme} form={form} draft={draft} patch={patch} fieldError={errorFor} name={name} />
              {failure ? (
                <View accessibilityLiveRegion="polite">
                  <Hint theme={theme} tone="danger">{sheetFailureText(t, failure)}</Hint>
                </View>
              ) : null}
              <ActionButton theme={theme} label={sendLabel} onPress={() => void send()} disabled={busy} busy={busy} />
            </View>
          </>
        ) : null}
      </>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar onClose={requestClose} closeLabel={t("recChords.close")} />

      <View ref={areaRef} collapsable={false} style={s.area}>
        <ScrollView
          ref={form.scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            offsetRef.current = event.nativeEvent.contentOffset.y
          }}
          contentContainerStyle={[s.content, { paddingBottom: sheetOpen && covered > 0 ? covered + 24 : Math.max(insets.bottom, 16) + 40 }]}
        >
          <Reveal index={0}>
            {title ? <Text style={[s.over, { color: theme.accent }]}>{`${t("recChordsForm.over")} ${title}`}</Text> : null}
            <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
              {sent ? t("recChart.title") : heading}
            </Text>
          </Reveal>
          {body()}
        </ScrollView>
      </View>

      <ChordSheet
        theme={theme}
        open={sheetOpen}
        word={selectedWord ?? lastWord.current}
        current={currentChord}
        keyName={draft.key}
        used={used}
        onPick={pick}
        onClear={() => pick(null)}
        onPrevious={selected && previousSlot(counts, selected.line, selected.word) ? () => setSelected(previousSlot(counts, selected.line, selected.word)) : null}
        onNext={selected && nextSlot(counts, selected.line, selected.word) ? () => setSelected(nextSlot(counts, selected.line, selected.word)) : null}
        onClose={closeSheet}
        onHeight={setCovered}
      />

      <ConfirmDialog theme={theme} open={leaving} title={t("recChart.leave.title")} body={t("recChart.leave.body")} actions={leaveActions} onDismiss={() => setLeaving(false)} />
      <ConfirmDialog theme={theme} open={pendingText !== null} title={t("recChart.lost.title")} body={t("recChart.lost.body", { count: pendingText ? chordsLostBy(draft, pendingText) : 0 })} actions={lostActions} onDismiss={() => setPendingText(null)} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  area: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 8 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  field: { gap: 12 },
  box: { minHeight: 160, borderRadius: CORNER, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 4 },
  input: { minHeight: 150, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, textAlignVertical: "top", outlineStyle: "none" as never },
  count: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  banner: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 8 },
  reason: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  sent: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 28 },
})
