import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { CycleRing } from "@/components/recording-extras/CycleRing"
import { ModerationNotice } from "@/components/common/ModerationNotice"
import { SheetTopBar } from "@/components/common/SheetTopBar"
import { ChordSheet } from "@/components/song-chords/ChordSheet"
import { ConfirmDialog, type DialogAction } from "@/components/song-chords/ConfirmDialog"
import { ConfirmFields, InstrumentField } from "@/components/song-chords/OfferFields"
import { ActionButton, CORNER, Chip, Hint, Label } from "@/components/song-chords/parts"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useChordTeam } from "@/hooks/useChordTeam"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useFormFocus } from "@/lib/forms/useFormFocus"
import { useT } from "@/lib/i18n"
import { authHeadersFromStore } from "@/lib/memberAuth"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { sheetFailure, sheetsBackend } from "@/lib/recordingChords/backend"
import {
  CYCLE_MAX_FORMS,
  CYCLE_MAX_SLOTS,
  CYCLE_MIN_SLOTS,
  CYCLE_NAME_MAX,
  cycleDraftFromOther,
  cycleDraftFromSheet,
  cycleProblems,
  cycleUsedChords,
  isBlankCycle,
  isCycle,
  newCycleDraft,
  resizeForm,
  setFormCount,
  setFormName,
  setFormTimes,
  setSlot,
  setStart,
  toCyclePayload,
  type CycleDraft,
  type CycleProblem,
} from "@/lib/recordingChords/cycle"
import { kindHasCycle } from "@/lib/recordingChords/kinds"
import { SHEET_NOTE_MAX } from "@/lib/recordingChords/rules"
import type { RecordingSheet, SheetFailure } from "@/lib/recordingChords/types"
import { sheetFailureText } from "@/lib/recordingChords/words"
import { chordsFormHref, recordingPageHref } from "@/lib/recordingExtras/links"
import { PREVIEW_NAME } from "@/lib/songComments/mock"
import { postingAccess } from "@/lib/songComments/rules"
import { ROOTS } from "@/lib/songChords/chordName"
import type { Draft } from "@/lib/songChords/draft"
import type { FormField } from "@/lib/songChords/fields"
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
function signature(d: CycleDraft): string {
  return JSON.stringify([d.forms, d.instrument, d.key, d.note, d.playedIt, d.isAnonymous])
}

const FORM_COUNTS = Array.from({ length: CYCLE_MAX_FORMS }, (_, i) => i + 1)

/** The problem a field of the form shows. `chords` covers everything about the rings. */
function fieldOf(p: CycleProblem): FormField {
  return p === "noteTooLong" ? "note" : p === "notPlayed" ? "played" : "chords"
}

/**
 * Add the chord CYCLE of a Kiirtan (docs/kiirtan-cycle.md). Step 1 asks how many forms of the Kiirtan are played in the
 * recording; step 2 gives each form its own ring of chords (four places, up to eight; tap a place and choose the chord from the
 * same chord sheet as the song screens; mark where the round starts; say how many rounds if it is known); step 3 confirms
 * and sends. The member's cycle goes to the team to look at, a team member's goes live at once. The same screen fixes a
 * waiting or rejected cycle (`?edit=`), changes a live one of the member's own (`?copy=`; the new one replaces it once accepted)
 * and starts from somebody else's published cycle (`?from=`; the first author is credited). Nothing here is timed: the
 * cycle says what is played, never where in the recording.
 */
export default function RecordingCycleScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const spTheme = useSpTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ recording?: string; title?: string; edit?: string; copy?: string; from?: string; instrument?: string }>()
  const recordingId = typeof params.recording === "string" ? params.recording : ""
  const title = typeof params.title === "string" ? params.title : ""
  const [entry] = useState<Entry>(() => entryOf(params))

  const mode = useAuthStore((s) => s.mode)
  const myName = useAuthStore((s) => s.displayName)
  const access = postingAccess({ preview: MOCKUP_DATA, signedIn: mode === "signed_in", canProve: Object.keys(authHeadersFromStore()).length > 0 })
  const name = mode === "signed_in" ? (myName && myName !== "Guest" ? myName : "") : MOCKUP_DATA ? PREVIEW_NAME : ""
  const { team } = useChordTeam(access === "ok")

  // only a Kiirtan has a cycle
  const kindOk = useMemo(() => {
    if (!recordingId) return false
    const found = allKirtans().find((k) => k.serverId === recordingId || k.id === recordingId)
    return found ? kindHasCycle(found.kind) : true
  }, [recordingId])

  const [draft, setDraft] = useState<CycleDraft>(() => newCycleDraft(1, entry.kind === "new" ? entry.instrument : "guitar"))
  const [baseline, setBaseline] = useState(() => signature(newCycleDraft(1, entry.kind === "new" ? entry.instrument : "guitar")))
  const [phase, setPhase] = useState<"loading" | "edit" | "gone">(entry.kind === "new" ? "edit" : "loading")
  const [linked, setLinked] = useState<RecordingSheet | null>(null)
  const [loadFailure, setLoadFailure] = useState<SheetFailure | null>(null)

  // load the cycle being fixed, changed or started from
  useEffect(() => {
    if (entry.kind === "new" || access !== "ok" || !recordingId) return undefined
    let active = true
    const source = entry.kind === "from" ? sheetsBackend().list(recordingId) : sheetsBackend().mine()
    source
      .then((items) => {
        if (!active) return
        const found = items.find((s) => s.id === entry.id) ?? null
        if (!found || !isCycle(found) || (entry.kind === "from" && (found.status !== "published" || found.mine))) {
          setPhase("gone")
          return
        }
        const base = entry.kind === "from" ? cycleDraftFromOther(found) : cycleDraftFromSheet(found, entry.kind)
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

  const locked = Boolean(draft.editId || draft.replacesId || draft.basedOn)
  const dirty = signature(draft) !== baseline
  const used = useMemo(() => cycleUsedChords(draft), [draft])

  // ---- the ring being edited ----
  const [selected, setSelected] = useState<{ form: number; slot: number } | null>(null)
  const [covered, setCovered] = useState(0)
  const closeSheet = useCallback(() => setSelected(null), [])
  const current = selected ? (draft.forms[selected.form]?.slots[selected.slot] ?? null) : null
  const last = useRef({ form: 0, slot: 0 })
  if (selected) last.current = selected
  const shown = selected ?? last.current
  const slotWord = t("recCycle.slot.label", { form: shown.form + 1, n: shown.slot + 1, total: draft.forms[shown.form]?.slots.length ?? 0 })
  const cards = useRef<Record<number, View | null>>({})
  /** brings the ring of a form into view above the chord sheet (past its title and name field) */
  const scrollToForm = (index: number) => {
    const inner = (form.scrollRef.current as unknown as { getInnerViewNode?: () => unknown } | null)?.getInnerViewNode?.()
    const node = cards.current[index] as unknown as { measureLayout?: (to: unknown, ok: (x: number, y: number) => void, fail: () => void) => void } | null
    if (!inner || !node?.measureLayout) return
    node.measureLayout(inner, (_x, y) => form.scrollRef.current?.scrollTo({ y: Math.max(0, y + 96), animated: true }), () => undefined)
  }
  const form = useFormFocus()
  const choose = (formIndex: number, slot: number) => {
    setSelected({ form: formIndex, slot })
    scrollToForm(formIndex)
  }
  const neighbour = (step: -1 | 1) => {
    if (!selected) return null
    const size = draft.forms[selected.form]?.slots.length ?? 0
    const next = selected.slot + step
    return next >= 0 && next < size ? () => setSelected({ form: selected.form, slot: next }) : null
  }

  // ---- sending ----
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

  const problems: CycleProblem[] = useMemo(() => cycleProblems(draft), [draft])
  const problemText = (p: CycleProblem) => (p === "notPlayed" ? t("chordOffer.problem.notPlayed") : p === "noteTooLong" ? t("chordOffer.problem.noteTooLong") : t(`recCycle.problem.${p}`))
  const messageFor = (field: string): string | null => {
    const found = problems.find((p) => fieldOf(p) === field)
    return found ? problemText(found) : null
  }
  /** the sentence the form shows: only once Send was pressed with something wrong */
  const errorFor = (field: string): string | null => (showProblems ? messageFor(field) : null)

  const back = () => (router.canGoBack() ? router.back() : router.replace(href(recordingId ? recordingPageHref(recordingId) : "/kiirtan")))
  const requestClose = () => {
    if (phase === "edit" && !sent && dirty && !isBlankCycle(draft)) setLeaving(true)
    else back()
  }

  const send = async () => {
    setFailure(null)
    if (problems.length) {
      setShowProblems(true)
      setSelected(null)
      const order = ["chords", "note", "played"]
      const keys = order.filter((f) => problems.some((p) => fieldOf(p) === f))
      const messages: Record<string, string> = {}
      for (const f of keys) messages[f] = messageFor(f) ?? ""
      void form.focusFirst(keys, messages)
      return
    }
    setBusy(true)
    try {
      const payload = toCyclePayload(draft)
      const sheet = draft.editId ? await sheetsBackend().updateCycle(draft.editId, payload) : await sheetsBackend().offerCycle(recordingId, payload)
      if (!alive.current) return
      setSelected(null)
      setSent(sheet)
    } catch (error) {
      if (alive.current) setFailure(sheetFailure(error))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const kind: "edit" | "copy" | null = draft.editId ? "edit" : draft.replacesId ? "copy" : null
  const heading = kind === "edit" ? t("recCycle.title.fix") : kind === "copy" ? t("recCycle.title.copy") : t("recCycle.title")
  const sendLabel = busy ? t("recChordsForm.sending") : kind === "copy" ? t("recCycle.send.copy") : kind === "edit" ? t("recCycle.send.again") : t("recCycle.send")

  // the confirm fields and the instrument chips are the song screens' own: they speak a song `Draft`, so lend them one
  const lent = useMemo(() => ({ songId: null, instrument: draft.instrument, key: draft.key, capo: draft.capo, strum: "", lines: [], playedIt: draft.playedIt, note: draft.note, isAnonymous: draft.isAnonymous }) as Draft, [draft])
  const lend = useCallback((change: Partial<Draft>) => {
    setDraft((d) => ({
      ...d,
      ...(change.playedIt !== undefined ? { playedIt: change.playedIt } : {}),
      ...(change.isAnonymous !== undefined ? { isAnonymous: change.isAnonymous } : {}),
    }))
  }, [])
  const pickInstrument = useCallback((next: Draft) => setDraft((d) => ({ ...d, instrument: next.instrument, capo: next.instrument === "guitar" ? d.capo : 0 })), [])

  const leaveActions: DialogAction[] = [
    { label: t("recCycle.leave.stay"), tone: "quiet", onPress: () => setLeaving(false) },
    {
      label: t("recCycle.leave.yes"),
      tone: "danger",
      onPress: () => {
        setLeaving(false)
        back()
      },
    },
  ]

  const ringSize = Math.min(264, Math.min(width, 560) - 48 - 32)

  const body = () => {
    if (!recordingId) return <Hint theme={theme} tone="danger">{t("recPage.missing")}</Hint>
    if (!kindOk) {
      return (
        <View style={s.field}>
          <Hint theme={theme} tone="danger">{t("recCycle.wrongKind")}</Hint>
          <ActionButton theme={theme} tone="quiet" label={t("recChordsForm.back")} onPress={back} />
        </View>
      )
    }
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
          <Text style={[s.sent, { color: theme.textHeading }]}>{t(sent.status === "published" ? "recCycle.sent.published" : "recCycle.sent.pending")}</Text>
          {sent.status !== "published" && sent.replaces ? <Hint theme={theme}>{t("recCycle.sent.replaces")}</Hint> : null}
          <ActionButton theme={theme} label={t("recChordsForm.back")} onPress={back} />
        </View>
      )
    }
    if (phase === "loading") return <Hint theme={theme}>{t("recChords.loading")}</Hint>
    if (phase === "gone") {
      return (
        <View style={s.field} accessibilityLiveRegion="polite">
          <Hint theme={theme} tone="danger">{loadFailure ? sheetFailureText(t, loadFailure) : t("recCycle.gone")}</Hint>
          <ActionButton theme={theme} tone="quiet" label={t("recChordsForm.back")} onPress={back} />
        </View>
      )
    }
    const rejected = kind === "edit" && linked?.status === "rejected"
    const chordsError = errorFor("chords")
    return (
      <>
        <Reveal index={1} style={s.field}>
          {kind === "edit" ? (
            <View style={[s.banner, { borderColor: rejected ? theme.dangerText : theme.line, backgroundColor: theme.card }]} accessibilityLiveRegion="polite">
              <Hint theme={theme} tone={rejected ? "danger" : "body"}>{t(rejected ? "recCycle.edit.rejected" : "recCycle.edit.pending")}</Hint>
              {rejected && linked?.rejectedReason ? <Text style={[s.reason, { color: theme.textHeading }]}>{t("recChords.reason", { reason: linked.rejectedReason })}</Text> : null}
              <Hint theme={theme}>{t("recCycle.edit.locked")}</Hint>
            </View>
          ) : kind === "copy" ? (
            <Hint theme={theme}>{t("recCycle.edit.copy")}</Hint>
          ) : draft.basedOn ? (
            <Hint theme={theme}>{t("recCycle.edit.from")}</Hint>
          ) : (
            <Hint theme={theme}>{t("recCycle.intro")}</Hint>
          )}
          {team && !kind ? <Hint theme={theme}>{t("chordOffer.intro.team")}</Hint> : null}
        </Reveal>

        {/* 1. how many forms */}
        <Reveal index={2} style={s.field}>
          <Text style={[s.step, { color: theme.accent }]}>{t("recCycle.step.forms")}</Text>
          <Label theme={theme}>{t("recCycle.forms.question")}</Label>
          <Hint theme={theme}>{t("recCycle.forms.hint")}</Hint>
          <View style={s.chips} accessibilityRole="radiogroup">
            {FORM_COUNTS.map((n) => (
              <Chip
                key={n}
                theme={theme}
                label={String(n)}
                on={draft.forms.length === n}
                a11y={t("recCycle.forms.a11y", { count: n })}
                minWidth={52}
                onPress={() => {
                  setSelected(null)
                  setDraft((d) => setFormCount(d, n))
                }}
              />
            ))}
          </View>
          {draft.forms.length > 1 ? <Hint theme={theme}>{t("recCycle.forms.change")}</Hint> : null}
        </Reveal>

        {/* 2. the ring of each form */}
        <Reveal index={3} style={s.field}>
          <Text style={[s.step, { color: theme.accent }]}>{t("recCycle.step.chords")}</Text>
          <InstrumentField theme={theme} draft={lent} locked={locked} patch={pickInstrument} />
        </Reveal>

        <View {...form.field("chords")} style={s.field}>
          {draft.forms.map((f, fi) => {
            const places = f.slots.length
            const startChord = f.slots[f.start]
            const picked = selected && selected.form === fi ? selected.slot : null
            return (
              <View key={fi} ref={(node) => void (cards.current[fi] = node)} collapsable={false} style={[s.formCard, { backgroundColor: theme.card, borderColor: picked !== null ? theme.accent : theme.line }]} testID={`cycle-form-${fi + 1}`}>
                <Text style={[s.formTitle, { color: theme.textHeading }]} accessibilityRole="header">
                  {t("recCycle.form.title", { n: fi + 1 })}
                </Text>
                <Label theme={theme}>{t("recCycle.form.name.label")}</Label>
                <View style={[s.box, { backgroundColor: theme.page, borderColor: theme.line }]}>
                  <TextInput
                    value={f.name}
                    onChangeText={(next) => setDraft((d) => setFormName(d, fi, next))}
                    onFocus={closeSheet}
                    maxLength={CYCLE_NAME_MAX + 10}
                    placeholder={t("recCycle.form.name.placeholder")}
                    placeholderTextColor={theme.textMuted}
                    accessibilityLabel={t("recCycle.form.name.label")}
                    style={[s.input, { color: theme.textHeading }]}
                  />
                </View>
                <Hint theme={theme}>{t("recCycle.form.tap")}</Hint>
                <View style={s.ring}>
                  <CycleRing
                    t={spTheme}
                    chords={f.slots}
                    start={f.start}
                    size={ringSize}
                    selected={picked}
                    onPress={(slot) => choose(fi, slot)}
                    label={t("recCycle.form.title", { n: fi + 1 })}
                  />
                </View>
                <View style={s.stepper}>
                  <Chip theme={theme} role="button" label="−" a11y={t("recCycle.form.less")} minWidth={52} onPress={() => (places > CYCLE_MIN_SLOTS ? setDraft((d) => resizeForm(d, fi, places - 1)) : undefined)} />
                  <Text style={[s.size, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
                    {t("recCycle.form.size", { count: places })}
                  </Text>
                  <Chip theme={theme} role="button" label="+" a11y={t("recCycle.form.more")} minWidth={52} onPress={() => (places < CYCLE_MAX_SLOTS ? setDraft((d) => resizeForm(d, fi, places + 1)) : undefined)} />
                </View>
                <Hint theme={theme}>{startChord ? t("recCycle.form.startChord", { chord: startChord, n: f.start + 1 }) : t("recCycle.form.start", { n: f.start + 1 })}</Hint>
                {picked !== null && picked !== f.start ? <ActionButton theme={theme} tone="quiet" label={t("recCycle.form.startHere")} onPress={() => setDraft((d) => setStart(d, fi, picked))} /> : null}
                <Label theme={theme}>{t("recCycle.form.times.label")}</Label>
                <View style={[s.box, s.times, { backgroundColor: theme.page, borderColor: theme.line }]}>
                  <TextInput
                    value={f.times}
                    onChangeText={(next) => setDraft((d) => setFormTimes(d, fi, next))}
                    onFocus={closeSheet}
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder={t("recCycle.form.times.placeholder")}
                    placeholderTextColor={theme.textMuted}
                    accessibilityLabel={t("recCycle.form.times.label")}
                    style={[s.input, { color: theme.textHeading }]}
                  />
                </View>
              </View>
            )
          })}
          {chordsError ? (
            <View accessibilityLiveRegion="polite">
              <Hint theme={theme} tone="danger">{chordsError}</Hint>
            </View>
          ) : null}
        </View>

        {/* the key, if it is known */}
        <View style={s.field}>
          <Label theme={theme}>{t("recCycle.key.label")}</Label>
          <Hint theme={theme}>{t("recCycle.key.hint")}</Hint>
          <View style={s.chips} accessibilityRole="radiogroup">
            <Chip theme={theme} label={t("recCycle.key.none")} on={draft.key === ""} minWidth={52} onPress={() => setDraft((d) => ({ ...d, key: "" }))} />
            {ROOTS.map((root) => (
              <Chip key={root} theme={theme} label={root} on={draft.key === root} a11y={t("recCycle.key.a11y", { key: root })} minWidth={52} onPress={() => setDraft((d) => ({ ...d, key: root }))} />
            ))}
          </View>
        </View>

        {/* a note */}
        <View {...form.field("note")} style={s.field}>
          <Label theme={theme}>{t("recCycle.note.label")}</Label>
          <View style={[s.box, s.noteBox, { backgroundColor: theme.card, borderColor: errorFor("note") ? amColors.danger : theme.line }]}>
            <TextInput
              ref={form.input("note") as never}
              value={draft.note}
              onChangeText={(next) => setDraft((d) => ({ ...d, note: next.slice(0, SHEET_NOTE_MAX) }))}
              onFocus={closeSheet}
              multiline
              maxLength={SHEET_NOTE_MAX}
              placeholder={t("recCycle.note.placeholder")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("recCycle.note.label")}
              style={[s.input, s.noteInput, { color: theme.textHeading }]}
            />
          </View>
          {errorFor("note") ? <Hint theme={theme} tone="danger">{errorFor("note")}</Hint> : <Hint theme={theme}>{t("chordOffer.note.left", { count: SHEET_NOTE_MAX - draft.note.length })}</Hint>}
        </View>

        {/* 3. confirm and send */}
        <View style={s.field}>
          <Text style={[s.step, { color: theme.accent }]}>{t("recCycle.step.send")}</Text>
          <ConfirmFields theme={theme} form={form} draft={lent} patch={lend} fieldError={(field) => errorFor(field)} name={name} />
          {failure ? (
            <View accessibilityLiveRegion="polite">
              <Hint theme={theme} tone="danger">{sheetFailureText(t, failure)}</Hint>
            </View>
          ) : null}
          <ModerationNotice kind="chords" />
          <ActionButton theme={theme} label={sendLabel} onPress={() => void send()} disabled={busy} busy={busy} />
          {!kind && !draft.basedOn ? <ActionButton theme={theme} tone="quiet" label={t("recCycle.asText")} onPress={() => router.replace(href(chordsFormHref({ recordingId, title })))} /> : null}
        </View>
      </>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar onClose={requestClose} closeLabel={t("recChords.close")} />
      <View style={s.area}>
        <ScrollView
          ref={form.scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.content, { paddingBottom: selected && covered > 0 ? covered + 24 : Math.max(insets.bottom, 16) + 40 }]}
        >
          <Reveal index={0}>
            {title ? <Text style={[s.over, { color: theme.accent }]}>{`${t("recChordsForm.over")} ${title}`}</Text> : null}
            <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
              {sent ? t("recCycle.title") : heading}
            </Text>
          </Reveal>
          {body()}
        </ScrollView>
      </View>

      <ChordSheet
        theme={theme}
        open={selected !== null && phase === "edit" && !sent}
        word={slotWord}
        current={current}
        keyName={draft.key || "C"}
        used={used}
        onPick={(chord) => selected && setDraft((d) => setSlot(d, selected.form, selected.slot, chord))}
        onClear={() => selected && setDraft((d) => setSlot(d, selected.form, selected.slot, null))}
        onPrevious={neighbour(-1)}
        onNext={neighbour(1)}
        onClose={closeSheet}
        onHeight={setCovered}
        place={{ over: t("recCycle.slot.over", { form: shown.form + 1 }), title: t("recCycle.slot.title", { n: shown.slot + 1, total: draft.forms[shown.form]?.slots.length ?? 0 }) }}
      />

      <ConfirmDialog theme={theme} open={leaving} title={t("recCycle.leave.title")} body={t("recCycle.leave.body")} actions={leaveActions} onDismiss={() => setLeaving(false)} />
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  step: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase" },
  formCard: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 12 },
  formTitle: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.3, textTransform: "uppercase" },
  ring: { alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  size: { minWidth: 150, textAlign: "center", fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  box: { minHeight: 56, borderRadius: CORNER, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center" },
  times: { alignSelf: "flex-start", minWidth: 96 },
  noteBox: { minHeight: 96, justifyContent: "flex-start" },
  input: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  banner: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 8 },
  reason: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  sent: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 28 },
})
