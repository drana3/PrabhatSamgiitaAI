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
  CYCLE_MAX_SLOTS,
  CYCLE_MAX_TUNES,
  CYCLE_MIN_SLOTS,
  CYCLE_NAME_MAX,
  activeTunes,
  chooseTunes,
  cycleDraftFromOther,
  cycleDraftFromSheet,
  cycleProblems,
  cycleUsedChords,
  isBlankCycle,
  isCycle,
  keyLikePrevious,
  newCycleDraft,
  nextTune,
  openTune,
  parseTuneRange,
  previousTune,
  priorTune,
  resizeTune,
  setSlot,
  setStart,
  setTuneCount,
  setTuneKey,
  setTuneName,
  setTuneSkipped,
  setTuneTimes,
  toCyclePayload,
  tuneEmpty,
  tuneLine,
  tuneProblems,
  tuneState,
  tuneStates,
  type CycleDraft,
  type CycleProblem,
} from "@/lib/recordingChords/cycle"
import { kindHasCycle } from "@/lib/recordingChords/kinds"
import { SHEET_NOTE_MAX } from "@/lib/recordingChords/rules"
import { sheetInstrumentOf } from "@/lib/recordingChords/instruments"
import type { RecordingSheet, SheetFailure, SheetInstrument } from "@/lib/recordingChords/types"
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

type Entry = { kind: "new"; instrument: SheetInstrument } | { kind: "edit" | "copy" | "from"; id: string; tune?: number }

/** What the screen was opened for, read from its address. An id wins over a bare instrument. `tune` is the number of a tune with no chords yet that is being added. */
function entryOf(params: { edit?: string; copy?: string; from?: string; instrument?: string; tune?: string }): Entry {
  if (typeof params.edit === "string" && params.edit) return { kind: "edit", id: params.edit }
  if (typeof params.copy === "string" && params.copy) return { kind: "copy", id: params.copy }
  if (typeof params.from === "string" && params.from) {
    const tune = Number(params.tune)
    return { kind: "from", id: params.from, ...(Number.isInteger(tune) && tune >= 1 ? { tune } : {}) }
  }
  return { kind: "new", instrument: sheetInstrumentOf(params.instrument) }
}

/** Everything the member can change, as one string: whether the work differs from where it began. */
function signature(d: CycleDraft): string {
  return JSON.stringify([d.tunes, d.instrument, d.note, d.playedIt, d.isAnonymous])
}

/** up to this many tunes the "which tunes" choices and the review cards are spelled "Tune 3"; past it they are bare numbers and one-line rows */
const FEW = 6

/** The problem a field of the form shows. `chords` covers everything about the rings. */
function fieldOf(p: CycleProblem): FormField {
  return p === "noteTooLong" ? "note" : p === "notPlayed" ? "played" : "chords"
}

/** The steps of the screen: how many tunes, which of them have chords, one ring per tune, then check and send. */
type Step = "count" | "which" | "tune" | "review"

/**
 * Add the chord CYCLE of a Kiirtan (docs/kiirtan-cycle.md). A recording can play more than one tune (melody), each with its
 * own chords, so the screen walks through it one question at a time:
 *  1. how many tunes are played in the recording (1 to 30, a stepper or a typed number);
 *  2. (more than one tune) do you have chords for all of them or only some, and which (a grid of numbers, "All", "None" and a typed
 *     range such as "1-5, 8");
 *  3. one step per chosen tune ("Tune 2 of 3"): its ring of chords (four places, up to eight; tap a place and choose the chord
 *     from the same chord sheet as the song screens), where the round starts, how many rounds, its key (each tune has its own,
 *     "Same as previous tune" copies it); a tune can be skipped, every step has Back, and a row of numbered chips jumps to any tune;
 *  4. check and send. Tunes without chords stay in the recording as "no chords yet" and another member can add them later.
 * The member's cycle goes to the team to look at, a team member's goes live at once. The same screen fixes a waiting or
 * rejected cycle (`?edit=`), changes a live one of the member's own (`?copy=`; the new one replaces it once accepted) and starts
 * from somebody else's published cycle (`?from=`, with `&tune=` to add a missing tune; the first author is credited); those
 * three open on the check step. Nothing here is timed: the cycle says what is played, never where in the recording.
 */
export default function RecordingCycleScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const spTheme = useSpTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const params = useLocalSearchParams<{ recording?: string; title?: string; edit?: string; copy?: string; from?: string; instrument?: string; tune?: string }>()
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

  // where the walk is
  const [step, setStep] = useState<Step>(entry.kind === "new" ? "count" : "review")
  const [tuneIx, setTuneIx] = useState(0)
  /** the tune step was opened from the check step: Next and Back return there */
  const [fromReview, setFromReview] = useState(false)
  const [allTunes, setAllTunes] = useState(true)
  const [chosen, setChosen] = useState<number[]>([])
  const [tried, setTried] = useState(false)
  const [countText, setCountText] = useState("1")
  const [rangeText, setRangeText] = useState("")
  const [rangeBad, setRangeBad] = useState(false)

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
        const base = entry.kind === "from" ? cycleDraftFromOther(found, entry.tune) : cycleDraftFromSheet(found, entry.kind)
        setLinked(found)
        setDraft(base)
        setBaseline(signature(base))
        setPhase("edit")
        if (entry.kind === "from" && entry.tune && base.tunes[entry.tune - 1] && !base.tunes[entry.tune - 1]!.skipped) {
          setTuneIx(entry.tune - 1)
          setFromReview(true)
          setStep("tune")
        } else {
          setStep("review")
        }
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
  const total = draft.tunes.length
  useEffect(() => setCountText(String(total)), [total])
  const tune = draft.tunes[tuneIx] ?? draft.tunes[0]!

  const form = useFormFocus()
  const goTo = useCallback(
    (next: Step, ix?: number, review = false) => {
      setSelected(null)
      setTried(false)
      if (ix !== undefined) setTuneIx(ix)
      setFromReview(review)
      setStep(next)
      requestAnimationFrame(() => form.scrollRef.current?.scrollTo({ y: 0, animated: false }))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.scrollRef],
  )

  // ---- the ring being edited ----
  const [selected, setSelected] = useState<number | null>(null)
  const [covered, setCovered] = useState(0)
  const closeSheet = useCallback(() => setSelected(null), [])
  const current = selected !== null ? (tune.slots[selected] ?? null) : null
  const last = useRef(0)
  if (selected !== null) last.current = selected
  const shown = selected ?? last.current
  const slotWord = t("recCycle.slot.label", { tune: tuneIx + 1, n: shown + 1, total: tune.slots.length })
  const card = useRef<View | null>(null)
  /** brings the ring into view above the chord sheet (past its title and name field) */
  const scrollToRing = () => {
    const inner = (form.scrollRef.current as unknown as { getInnerViewNode?: () => unknown } | null)?.getInnerViewNode?.()
    const node = card.current as unknown as { measureLayout?: (to: unknown, ok: (x: number, y: number) => void, fail: () => void) => void } | null
    if (!inner || !node?.measureLayout) return
    node.measureLayout(inner, (_x, y) => form.scrollRef.current?.scrollTo({ y: Math.max(0, y + 96), animated: true }), () => undefined)
  }
  const choose = (slot: number) => {
    setSelected(slot)
    scrollToRing()
  }
  const neighbour = (stepBy: -1 | 1) => {
    if (selected === null) return null
    const next = selected + stepBy
    return next >= 0 && next < tune.slots.length ? () => setSelected(next) : null
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
  const problemText = (p: CycleProblem) => (p === "notPlayed" ? t("chordOffer.problem.notPlayed") : p === "noteTooLong" ? t("chordOffer.problem.noteTooLong") : t(p === "noChords" ? "recCycle.problem.noChords" : p === "noTune" ? "recCycle.problem.noTune" : p === "fewChords" ? "recCycle.problem.fewChords" : p === "noStart" ? "recCycle.problem.noStart" : p === "badTimes" ? "recCycle.problem.badTimes" : p === "tooLong" ? "recCycle.problem.tooLong" : p === "badKey" ? "recCycle.problem.badKey" : "recCycle.problem.links"))
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
  const lent = useMemo(() => ({ songId: null, instrument: draft.instrument, key: "", capo: draft.capo, strum: "", lines: [], playedIt: draft.playedIt, note: draft.note, isAnonymous: draft.isAnonymous }) as Draft, [draft])
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

  // ---- the moves between steps ----
  /** after question 1: one tune goes straight to its ring, more ask which of them have chords */
  const afterCount = () => {
    if (total > 1) {
      setChosen((c) => (c.length ? c.filter((i) => i < total) : []))
      goTo("which")
      return
    }
    setDraft((d) => chooseTunes(d, [0]))
    goTo("tune", 0)
  }
  /** after question 2: the chosen tunes are entered, the rest are skipped */
  const afterWhich = () => {
    const picked = allTunes ? Array.from({ length: total }, (_, i) => i) : [...chosen].sort((a, b) => a - b)
    if (picked.length === 0) {
      setTried(true)
      return
    }
    setDraft((d) => chooseTunes(d, picked))
    goTo("tune", picked[0]!)
  }
  /** Next on a tune: it must be finished (or skipped); then the next tune, or the check */
  const afterTune = (skip: boolean) => {
    if (skip) {
      const after = nextTune(draft, tuneIx)
      setDraft((d) => setTuneSkipped(d, tuneIx, true))
      if (fromReview || after === null) goTo("review")
      else goTo("tune", after)
      return
    }
    if (tuneProblems(tune).length) {
      setTried(true)
      return
    }
    const after = nextTune(draft, tuneIx)
    if (fromReview || after === null) goTo("review")
    else goTo("tune", after)
  }
  const backFromTune = () => {
    if (fromReview) {
      goTo("review")
      return
    }
    const before = priorTune(draft, tuneIx)
    if (before !== null) goTo("tune", before)
    else goTo(total > 1 ? "which" : "count")
  }

  /** the stepper and the typed number of the first question: always a whole number from 1 to the limit */
  const setCount = (n: number) => {
    const next = Math.min(CYCLE_MAX_TUNES, Math.max(1, Math.round(n)))
    setDraft((d) => setTuneCount(d, next))
    setCountText(String(next))
  }
  const typeCount = (text: string) => {
    const digits = text.replace(/\D+/g, "").slice(0, 2)
    const n = Number(digits)
    setCountText(digits && n > CYCLE_MAX_TUNES ? String(CYCLE_MAX_TUNES) : digits)
    if (digits && n >= 1) setDraft((d) => setTuneCount(d, Math.min(CYCLE_MAX_TUNES, n)))
  }
  /** the row of numbered chips: go straight to any tune (a tune left as "no chords yet" is taken back into the walk) */
  const jumpTo = (i: number) => {
    setDraft((d) => openTune(d, i))
    goTo("tune", i, fromReview)
  }
  const applyRange = () => {
    const picked = parseTuneRange(rangeText, total)
    if (picked === null || picked.length === 0) {
      setRangeBad(true)
      return
    }
    setRangeBad(false)
    setChosen(picked)
  }
  const jumpRef = useRef<ScrollView>(null)
  const jumpX = useRef<Record<number, number>>({})
  useEffect(() => {
    if (step !== "tune") return
    const x = jumpX.current[tuneIx]
    if (x !== undefined) jumpRef.current?.scrollTo({ x: Math.max(0, x - 72), animated: false })
  }, [step, tuneIx])

  const tuneProblem = tried ? tuneProblems(tune)[0] : undefined
  const tuneProblemText = tuneProblem ? (tuneProblem === "noChords" ? t("recCycle.tune.problem") : tuneProblem === "badKey" ? t("recCycle.problem.badKey") : tuneProblem === "noStart" ? t("recCycle.problem.noStart") : tuneProblem === "badTimes" ? t("recCycle.problem.badTimes") : tuneProblem === "tooLong" ? t("recCycle.problem.tooLong") : t("recCycle.problem.links")) : null

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
      const partial = (sent.cycle?.tuneCount ?? 0) > (sent.cycle?.tunes.length ?? 0)
      return (
        <View style={s.field} accessibilityLiveRegion="polite">
          <Text style={[s.sent, { color: theme.textHeading }]}>{t(sent.status === "published" ? "recCycle.sent.published" : "recCycle.sent.pending")}</Text>
          {partial ? <Hint theme={theme}>{t("recCycle.sent.partial")}</Hint> : null}
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
    const intro = (
      <Reveal index={1} style={s.field}>
        {kind === "edit" ? (
          <View style={[s.banner, { borderColor: rejected ? theme.dangerText : theme.line, backgroundColor: theme.card }]} accessibilityLiveRegion="polite">
            <Hint theme={theme} tone={rejected ? "danger" : "body"}>{t(rejected ? "recCycle.edit.rejected" : "recCycle.edit.pending")}</Hint>
            {rejected && linked?.rejectedReason ? <Text style={[s.reason, { color: theme.textHeading }]}>{t("recChords.reason", { reason: linked.rejectedReason })}</Text> : null}
          </View>
        ) : kind === "copy" ? (
          <Hint theme={theme}>{t("recCycle.edit.copy")}</Hint>
        ) : draft.basedOn ? (
          <Hint theme={theme}>{t(entry.kind === "from" && entry.tune ? "recCycle.edit.fill" : "recCycle.edit.from")}</Hint>
        ) : step === "count" ? (
          <Hint theme={theme}>{t("recCycle.intro")}</Hint>
        ) : null}
        {team && !kind && step === "count" ? <Hint theme={theme}>{t("chordOffer.intro.team")}</Hint> : null}
      </Reveal>
    )

    // ---- 1. how many tunes ----
    if (step === "count") {
      return (
        <>
          {intro}
          <Reveal index={2} style={s.field}>
            <Text style={[s.step, { color: theme.accent }]}>{t("recCycle.step.count")}</Text>
            <Label theme={theme}>{t("recCycle.count.question")}</Label>
            <Hint theme={theme}>{t("recCycle.count.hint")}</Hint>
            <View style={s.stepper}>
              <Chip theme={theme} role="button" label="−" a11y={t("recCycle.count.less")} minWidth={52} onPress={() => setCount(total - 1)} />
              <View style={[s.box, s.countBox, { backgroundColor: theme.card, borderColor: theme.line }]}>
                <TextInput
                  value={countText}
                  onChangeText={typeCount}
                  onBlur={() => setCountText(String(total))}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  accessibilityLabel={t("recCycle.count.field")}
                  style={[s.input, s.countInput, { color: theme.textHeading }]}
                  testID="cycle-count-field"
                />
              </View>
              <Chip theme={theme} role="button" label="+" a11y={t("recCycle.count.more")} minWidth={52} onPress={() => setCount(total + 1)} />
            </View>
            <Hint theme={theme}>{t("recCycle.count.limit", { max: CYCLE_MAX_TUNES })}</Hint>
            {total > 1 && baseline !== signature(draft) ? <Hint theme={theme}>{t("recCycle.count.change")}</Hint> : null}
          </Reveal>
          <Reveal index={3} style={s.field}>
            <Label theme={theme}>{t("recCycle.count.instrument")}</Label>
            <InstrumentField theme={theme} draft={lent} locked={locked} patch={pickInstrument} />
          </Reveal>
          <View style={s.field}>
            <ActionButton theme={theme} label={t("recCycle.tune.next")} onPress={afterCount} />
            <ActionButton theme={theme} tone="quiet" label={t("recCycle.asText")} onPress={() => router.replace(href(chordsFormHref({ recordingId, title })))} />
          </View>
        </>
      )
    }

    // ---- 2. chords for which tunes ----
    if (step === "which") {
      return (
        <>
          {intro}
          <Reveal index={2} style={s.field}>
            <Text style={[s.step, { color: theme.accent }]}>{t("recCycle.step.which")}</Text>
            <Label theme={theme}>{t("recCycle.which.question")}</Label>
            <View style={s.chips} accessibilityRole="radiogroup">
              <Chip theme={theme} label={t("recCycle.which.all")} on={allTunes} minWidth={96} onPress={() => setAllTunes(true)} />
              <Chip theme={theme} label={t("recCycle.which.some")} on={!allTunes} minWidth={96} onPress={() => setAllTunes(false)} />
            </View>
          </Reveal>
          {!allTunes ? (
            <View style={s.field}>
              <Label theme={theme}>{t("recCycle.which.pick")}</Label>
              <View style={s.chips}>
                <Chip theme={theme} role="button" label={t("recCycle.which.allBtn")} minWidth={72} onPress={() => setChosen(Array.from({ length: total }, (_, i) => i))} />
                <Chip theme={theme} role="button" label={t("recCycle.which.noneBtn")} minWidth={72} onPress={() => setChosen([])} />
              </View>
              <View style={s.chips}>
                {draft.tunes.map((_, i) => (
                  <Chip
                    key={i}
                    theme={theme}
                    role="checkbox"
                    label={total > FEW ? String(i + 1) : t("recCycle.which.tune", { n: i + 1 })}
                    a11y={t("recCycle.which.tune", { n: i + 1 })}
                    on={chosen.includes(i)}
                    minWidth={total > FEW ? 52 : 96}
                    onPress={() => setChosen((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))}
                  />
                ))}
              </View>
              <Text style={[s.size, s.sizeLeft, { color: theme.textHeading }]} accessibilityLiveRegion="polite">{t("recCycle.which.count", { count: chosen.length, total })}</Text>
              {total > FEW ? (
                <>
                  <Label theme={theme}>{t("recCycle.which.range.label")}</Label>
                  <View style={[s.box, { backgroundColor: theme.card, borderColor: rangeBad ? amColors.danger : theme.line }]}>
                    <TextInput
                      value={rangeText}
                      onChangeText={(text) => {
                        setRangeText(text.replace(/[^0-9,;\s\-\u2013]/g, "").slice(0, 80))
                        setRangeBad(false)
                      }}
                      onSubmitEditing={applyRange}
                      placeholder={t("recCycle.which.range.placeholder")}
                      placeholderTextColor={theme.textMuted}
                      accessibilityLabel={t("recCycle.which.range.label")}
                      style={[s.input, { color: theme.textHeading }]}
                      testID="cycle-range-field"
                    />
                  </View>
                  {rangeBad ? <Hint theme={theme} tone="danger">{t("recCycle.which.range.bad", { max: total })}</Hint> : null}
                  <ActionButton theme={theme} tone="quiet" label={t("recCycle.which.range.apply")} onPress={applyRange} disabled={!rangeText.trim()} />
                </>
              ) : null}
              <Hint theme={theme}>{t("recCycle.which.hint")}</Hint>
              {tried && chosen.length === 0 ? <Hint theme={theme} tone="danger">{t("recCycle.which.none")}</Hint> : null}
            </View>
          ) : null}
          <View style={s.field}>
            <ActionButton theme={theme} label={t("recCycle.tune.next")} onPress={afterWhich} />
            <ActionButton theme={theme} tone="quiet" label={t("recCycle.tune.back")} onPress={() => goTo("count")} />
          </View>
        </>
      )
    }

    // ---- 3. the ring of one tune ----
    if (step === "tune") {
      const places = tune.slots.length
      const startChord = tune.slots[tune.start]
      const prev = previousTune(draft, tuneIx)
      const isLast = nextTune(draft, tuneIx) === null
      return (
        <>
          {intro}
          <View style={s.field}>
            <Text style={[s.step, { color: theme.accent }]}>{t("recCycle.step.tune", { n: tuneIx + 1, total })}</Text>
            {total > 1 ? (
              <View style={s.jump} testID="cycle-jump">
                <Hint theme={theme}>{t("recCycle.jump.title")}</Hint>
                <ScrollView ref={jumpRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.jumpRow} keyboardShouldPersistTaps="handled">
                  {draft.tunes.map((f, i) => {
                    const st = tuneState(f)
                    const mark = st === "done" ? " ✓" : st === "skipped" ? " –" : ""
                    return (
                      <View key={i} onLayout={(e) => (jumpX.current[i] = e.nativeEvent.layout.x)}>
                        <Chip
                          theme={theme}
                          role="button"
                          label={`${i + 1}${mark}`}
                          a11y={t(st === "done" ? "recCycle.jump.done" : st === "skipped" ? "recCycle.jump.skipped" : "recCycle.jump.open", { n: i + 1 })}
                          on={i === tuneIx}
                          danger={st === "partial"}
                          minWidth={52}
                          onPress={() => jumpTo(i)}
                        />
                      </View>
                    )
                  })}
                </ScrollView>
                <Hint theme={theme}>{t("recCycle.jump.legend")}</Hint>
                <Hint theme={theme}>{(() => { const c = tuneStates(draft); return t("recCycle.jump.summary", { done: c.done, skipped: c.skipped, open: c.empty + c.partial }) })()}</Hint>
              </View>
            ) : null}
            <View ref={card} collapsable={false} style={[s.formCard, { backgroundColor: theme.card, borderColor: selected !== null ? theme.accent : theme.line }]} testID={`cycle-tune-${tuneIx + 1}`}>
              <Text style={[s.formTitle, { color: theme.textHeading }]} accessibilityRole="header">
                {t("recCycle.tune.title", { n: tuneIx + 1 })}
              </Text>
              <Label theme={theme}>{t("recCycle.tune.name.label")}</Label>
              <View style={[s.box, { backgroundColor: theme.page, borderColor: theme.line }]}>
                <TextInput
                  value={tune.name}
                  onChangeText={(next) => setDraft((d) => setTuneName(d, tuneIx, next))}
                  onFocus={closeSheet}
                  maxLength={CYCLE_NAME_MAX + 10}
                  placeholder={t("recCycle.tune.name.placeholder")}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("recCycle.tune.name.label")}
                  style={[s.input, { color: theme.textHeading }]}
                />
              </View>
              <Hint theme={theme}>{t("recCycle.tune.tap")}</Hint>
              <View style={s.ring}>
                <CycleRing t={spTheme} chords={tune.slots} start={tune.start} size={ringSize} selected={selected} onPress={choose} label={t("recCycle.tune.title", { n: tuneIx + 1 })} />
              </View>
              <View style={s.stepper}>
                <Chip theme={theme} role="button" label="−" a11y={t("recCycle.tune.less")} minWidth={52} onPress={() => (places > CYCLE_MIN_SLOTS ? setDraft((d) => resizeTune(d, tuneIx, places - 1)) : undefined)} />
                <Text style={[s.size, { color: theme.textHeading }]} accessibilityLiveRegion="polite">
                  {t("recCycle.tune.size", { count: places })}
                </Text>
                <Chip theme={theme} role="button" label="+" a11y={t("recCycle.tune.more")} minWidth={52} onPress={() => (places < CYCLE_MAX_SLOTS ? setDraft((d) => resizeTune(d, tuneIx, places + 1)) : undefined)} />
              </View>
              <Hint theme={theme}>{startChord ? t("recCycle.tune.startChord", { chord: startChord, n: tune.start + 1 }) : t("recCycle.tune.start", { n: tune.start + 1 })}</Hint>
              {selected !== null && selected !== tune.start ? <ActionButton theme={theme} tone="quiet" label={t("recCycle.tune.startHere")} onPress={() => setDraft((d) => setStart(d, tuneIx, selected))} /> : null}
              <Label theme={theme}>{t("recCycle.tune.times.label")}</Label>
              <View style={[s.box, s.times, { backgroundColor: theme.page, borderColor: theme.line }]}>
                <TextInput
                  value={tune.times}
                  onChangeText={(next) => setDraft((d) => setTuneTimes(d, tuneIx, next))}
                  onFocus={closeSheet}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder={t("recCycle.tune.times.placeholder")}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("recCycle.tune.times.label")}
                  style={[s.input, { color: theme.textHeading }]}
                />
              </View>
            </View>
          </View>

          {/* the key of THIS tune */}
          <View style={s.field}>
            <Label theme={theme}>{t("recCycle.key.label")}</Label>
            <Hint theme={theme}>{t("recCycle.key.hint")}</Hint>
            <View style={s.chips} accessibilityRole="radiogroup">
              <Chip theme={theme} label={t("recCycle.key.none")} on={tune.key === ""} minWidth={52} onPress={() => setDraft((d) => setTuneKey(d, tuneIx, ""))} />
              {ROOTS.map((root) => (
                <Chip key={root} theme={theme} label={root} on={tune.key === root} a11y={t("recCycle.key.a11y", { key: root })} minWidth={52} onPress={() => setDraft((d) => setTuneKey(d, tuneIx, root))} />
              ))}
            </View>
            {prev !== null ? <ActionButton theme={theme} tone="quiet" label={t("recCycle.key.same")} onPress={() => setDraft((d) => keyLikePrevious(d, tuneIx))} /> : null}
          </View>

          <View {...form.field("chords")} style={s.field}>
            {tuneProblemText ? (
              <View accessibilityLiveRegion="polite">
                <Hint theme={theme} tone="danger">{tuneProblemText}</Hint>
              </View>
            ) : null}
            <ActionButton theme={theme} label={fromReview || isLast ? t("recCycle.tune.done") : t("recCycle.tune.next")} onPress={() => afterTune(false)} />
            <ActionButton theme={theme} tone="quiet" label={t("recCycle.tune.skip")} onPress={() => afterTune(true)} />
            <Hint theme={theme}>{t("recCycle.tune.skipHint")}</Hint>
            <ActionButton theme={theme} tone="quiet" label={t("recCycle.tune.back")} onPress={backFromTune} />
          </View>
        </>
      )
    }

    // ---- 4. check and send ----
    const chordsError = errorFor("chords")
    return (
      <>
        {intro}
        <View style={s.field}>
          <Text style={[s.step, { color: theme.accent }]}>{t("recCycle.step.send")}</Text>
          <Label theme={theme}>{t("recCycle.review.title")}</Label>
          <Hint theme={theme}>{t("recCycle.review.intro")}</Hint>
          {total > 1 ? <Hint theme={theme}>{t("recCycle.review.summary", { done: tuneStates(draft).done, total })}</Hint> : null}
        </View>
        <View {...form.field("chords")} style={s.field}>
          {draft.tunes.map((f, i) => {
            const empty = f.skipped || tuneEmpty(f)
            const facts = [
              f.key ? t("recCycle.review.key", { key: f.key }) : "",
              !empty && f.slots[f.start] ? t("recCycle.block.starts", { chord: f.slots[f.start] as string }) : "",
              !empty && f.times ? t("recCycle.block.times", { count: f.times }) : "",
            ].filter(Boolean)
            return (
              total > FEW ? (
                <View key={i} style={[s.rowCard, { backgroundColor: theme.card, borderColor: theme.line }]} testID={`review-tune-${i + 1}`}>
                  <View style={s.rowText}>
                    <Text style={[s.rowTitle, { color: theme.textHeading }]} accessibilityRole="header">
                      {f.name.trim() ? t("recCycle.block.tuneNamed", { n: i + 1, name: f.name.trim() }) : t("recCycle.block.tune", { n: i + 1 })}
                    </Text>
                    <Text style={[s.rowLine, { color: empty ? theme.textMuted : theme.textHeading }]} numberOfLines={1}>
                      {empty ? t("recCycle.review.noChords") : tuneLine({ chords: f.slots.map((c) => c ?? "·") })}
                    </Text>
                    {facts.length && !empty ? <Text style={[s.rowFacts, { color: theme.textBody }]} numberOfLines={1}>{facts.join(" · ")}</Text> : null}
                  </View>
                  <Chip
                    theme={theme}
                    role="button"
                    label={empty ? t("recCycle.review.add") : t("recCycle.review.change")}
                    a11y={`${empty ? t("recCycle.review.add") : t("recCycle.review.change")}: ${t("recCycle.block.tune", { n: i + 1 })}`}
                    onPress={() => {
                      setDraft((d) => setTuneSkipped(d, i, false))
                      goTo("tune", i, true)
                    }}
                  />
                </View>
              ) : (
              <View key={i} style={[s.formCard, { backgroundColor: theme.card, borderColor: theme.line }]} testID={`review-tune-${i + 1}`}>
                <Text style={[s.formTitle, { color: theme.textHeading }]} accessibilityRole="header">
                  {f.name.trim() ? t("recCycle.block.tuneNamed", { n: i + 1, name: f.name.trim() }) : t("recCycle.block.tune", { n: i + 1 })}
                </Text>
                {empty ? (
                  <Hint theme={theme}>{t("recCycle.review.noChords")}</Hint>
                ) : (
                  <>
                    <Text style={[s.line, { color: theme.textHeading }]}>{tuneLine({ chords: f.slots.map((c) => c ?? "·") })}</Text>
                    {facts.length ? <Hint theme={theme}>{facts.join(" · ")}</Hint> : null}
                  </>
                )}
                <ActionButton
                  theme={theme}
                  tone="quiet"
                  label={empty ? t("recCycle.review.add") : t("recCycle.review.change")}
                  onPress={() => {
                    setDraft((d) => setTuneSkipped(d, i, false))
                    goTo("tune", i, true)
                  }}
                />
              </View>
              )
            )
          })}
          {chordsError ? (
            <View accessibilityLiveRegion="polite">
              <Hint theme={theme} tone="danger">{chordsError}</Hint>
            </View>
          ) : null}
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

        <View style={s.field}>
          <ConfirmFields theme={theme} form={form} draft={lent} patch={lend} fieldError={(field) => errorFor(field)} name={name} />
          {failure ? (
            <View accessibilityLiveRegion="polite">
              <Hint theme={theme} tone="danger">{sheetFailureText(t, failure)}</Hint>
            </View>
          ) : null}
          <ModerationNotice kind="chords" />
          <ActionButton theme={theme} label={sendLabel} onPress={() => void send()} disabled={busy} busy={busy} />
          {entry.kind === "new" ? <ActionButton theme={theme} tone="quiet" label={t("recCycle.tune.back")} onPress={() => (activeTunes(draft).length ? goTo("tune", activeTunes(draft)[activeTunes(draft).length - 1]!) : goTo(total > 1 ? "which" : "count"))} /> : null}
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
          contentContainerStyle={[s.content, { paddingBottom: selected !== null && covered > 0 ? covered + 24 : Math.max(insets.bottom, 16) + 40 }]}
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
        open={selected !== null && phase === "edit" && !sent && step === "tune"}
        word={slotWord}
        current={current}
        keyName={tune.key || "C"}
        used={used}
        onPick={(chord) => selected !== null && setDraft((d) => setSlot(d, tuneIx, selected, chord))}
        onClear={() => selected !== null && setDraft((d) => setSlot(d, tuneIx, selected, null))}
        onPrevious={neighbour(-1)}
        onNext={neighbour(1)}
        onClose={closeSheet}
        onHeight={setCovered}
        place={{ over: t("recCycle.slot.over", { tune: tuneIx + 1 }), title: t("recCycle.slot.title", { n: shown + 1, total: tune.slots.length }) }}
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
  line: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 28 },
  ring: { alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  size: { minWidth: 150, textAlign: "center", fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  box: { minHeight: 56, borderRadius: CORNER, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center" },
  times: { alignSelf: "flex-start", minWidth: 96 },
  countBox: { minWidth: 96, alignItems: "center" },
  countInput: { textAlign: "center", fontFamily: amFonts.display, fontSize: 28, lineHeight: 32, minWidth: 64 },
  sizeLeft: { textAlign: "left", minWidth: 0 },
  jump: { gap: 8 },
  jumpRow: { flexDirection: "row", gap: 8, paddingRight: 24 },
  rowCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: CORNER, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20 },
  rowLine: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 24 },
  rowFacts: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  noteBox: { minHeight: 96, justifyContent: "flex-start" },
  input: { fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  banner: { borderWidth: 1.5, borderRadius: CORNER, padding: 16, gap: 8 },
  reason: { fontFamily: amFonts.medium, fontSize: 15, lineHeight: 22 },
  sent: { fontFamily: amFonts.bold, fontSize: 20, lineHeight: 28 },
})
