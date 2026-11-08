import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ChartPreview } from "@/components/song-chords/ChartPreview"
import { ChordPasteBox } from "@/components/song-chords/ChordPasteBox"
import { ChordSheet } from "@/components/song-chords/ChordSheet"
import { ChordSlotEditor, type Slot } from "@/components/song-chords/ChordSlotEditor"
import { ConfirmDialog, type DialogAction } from "@/components/song-chords/ConfirmDialog"
import { EditBanner, ResumePanel, SentPanel } from "@/components/song-chords/OfferPanels"
import { SheetTopBar } from "@/components/common/SheetTopBar"
import { ActionButton, CheckRow, Chip, CORNER, Hint, Label, PILL } from "@/components/song-chords/parts"
import { PsSongChooser } from "@/components/kirtan/add/PsSongChooser"
import { KPress } from "@/components/kirtan/KPress"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amFonts } from "@/constants/tokens/amTypography"
import { useChordTeam } from "@/hooks/useChordTeam"
import { useFormFocus } from "@/lib/forms/useFormFocus"
import { useSongLyrics } from "@/hooks/useSongLyrics"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { useT } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { chordFailure, chordsBackend, previewGuest, previewName } from "@/lib/songChords/backend"
import { ROOTS, suggestedChords, usedChords } from "@/lib/songChords/chordName"
import type { ParseMeta } from "@/lib/songChords/chordPro"
import {
  NOTE_MAX,
  STRUM_MAX,
  countChords,
  draftFromOther,
  draftFromProposal,
  draftProblems,
  fitLines,
  linesWithChords,
  newDraft,
  nextSlot,
  previousSlot,
  replaceLines,
  setCapo,
  setChord,
  setInstrument,
  soundingKey,
  toPayload,
  type Draft,
  type DraftProblem,
  type Placement,
} from "@/lib/songChords/draft"
import { draftKey, entryChoices, worthKeeping, type DraftEntry } from "@/lib/songChords/drafts"
import { draftSignature, parseEntry, type Entry } from "@/lib/songChords/entry"
import { FIELD_ORDER, problemsByField, type FormField } from "@/lib/songChords/fields"
import { revealOffset } from "@/lib/songChords/reveal"
import type { ChordFailure, ChordProposal } from "@/lib/songChords/types"
import { splitWords } from "@/lib/songPage/chordChart"
import { MAX_CAPO } from "@/lib/songPage/chords"
import { PS_SONG_COUNT } from "@/lib/learn/learnSongs"
import { useAuthStore } from "@/stores/authStore"
import { useChordDraftStore } from "@/stores/chordDraftStore"
import { href } from "@/utils/href"

type Phase = "loading" | "resume" | "edit"

/** Failures after which the useful next step is to look at the member's charts, not to press Send again. */
const SEE_CHARTS: ReadonlySet<ChordFailure> = new Set(["dailyLimit", "duplicate", "tooMany", "notEditable", "gone"])

type Linked = { status: "idle" | "loading" | "ready" | "gone"; proposal: ChordProposal | null }

/** The chart a draft is fixing, copying or starting from, looked up (see `song`). */
function useLinked(id: string | null, enabled: boolean, song: number | null = null): Linked {
  const [state, setState] = useState<Linked>({ status: "idle", proposal: null })
  useEffect(() => {
    if (!id || !enabled) {
      setState({ status: "idle", proposal: null })
      return undefined
    }
    let active = true
    setState({ status: "loading", proposal: null })
    // a chart of the member's own is found among theirs; someone else's published chart among the charts of its song
    const source = song ? chordsBackend().listForSong(song) : chordsBackend().mine()
    source
      .then((items) => {
        if (!active) return
        const found = items.find((p) => p.id === id) ?? null
        setState(found ? { status: "ready", proposal: found } : { status: "gone", proposal: null })
      })
      .catch(() => {
        if (active) setState({ status: "gone", proposal: null })
      })
    return () => {
      active = false
    }
  }, [id, enabled, song])
  return state
}

/**
 * Offer chords for a Prabhat Samgiita song (docs/chord-proposals.md has the scenario map). One scrolling sheet, top to
 * bottom: which song, which instrument, the key (and capo for a guitar), the chords (tap the words of the song, or paste
 * text), a preview drawn by the song page's own chord view, then "I played it", a note, anonymous or not, and Send.
 *
 * The work is kept on the phone as a draft as it goes (stores/chordDraftStore), so leaving does not lose it; coming back
 * offers to continue (or start over, after saying what would be lost). The same screen fixes a waiting or rejected chart
 * (`?edit=`), makes a changed copy of a live one (`?copy=`) and ends in a confirmation that says what happens next.
 */
export default function UploadChordsScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const spTheme = useSpTheme()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ song?: string; instrument?: string; edit?: string; copy?: string; draft?: string; from?: string }>()
  const [entry] = useState<Entry>(() => parseEntry(params))

  const signedIn = useAuthStore((s) => s.mode === "signed_in") || (MOCKUP_DATA && !previewGuest())
  const displayName = useAuthStore((s) => s.displayName)
  const name = MOCKUP_DATA ? previewName() : displayName && displayName !== "Guest" ? displayName : ""
  const { team } = useChordTeam(signedIn)

  const book = useChordDraftStore((s) => s.drafts)
  const saveDraft = useChordDraftStore((s) => s.save)
  const discardKey = useChordDraftStore((s) => s.discard)

  // the book comes back from storage a moment after the first render
  const [hydrated, setHydrated] = useState(() => useChordDraftStore.persist.hasHydrated())
  useEffect(() => {
    if (hydrated) return undefined
    return useChordDraftStore.persist.onFinishHydration(() => setHydrated(true))
  }, [hydrated])

  // "start from someone else's chart": the chords it brings, kept for "Start a new chart instead" in the resume panel
  const fromBase = useRef<Draft | null>(null)
  const fresh = useCallback((): Draft => {
    if (entry.kind === "from" && fromBase.current) return fromBase.current
    const base = newDraft(entry.kind === "new" ? entry.song : null)
    return entry.kind === "new" && entry.instrument ? setInstrument(base, entry.instrument) : base
  }, [entry])

  const [phase, setPhase] = useState<Phase>("loading")
  const [draft, setDraft] = useState<Draft>(() => fresh())
  const [baseline, setBaseline] = useState(() => draftSignature(fresh()))
  const [choices, setChoices] = useState<DraftEntry[]>([])
  const [original, setOriginal] = useState<Draft | null>(null)
  const [linkedId, setLinkedId] = useState<string | null>(entry.kind === "edit" || entry.kind === "copy" || entry.kind === "from" ? entry.id : null)
  const linked = useLinked(linkedId, signedIn, entry.kind === "from" ? entry.song : null)
  const [viaFrom, setViaFrom] = useState(false)
  // the chart this screen was asked to open is not there (deleted, or never was)
  const [missing, setMissing] = useState(false)

  const begin = useCallback((d: Draft, base?: Draft | null) => {
    setDraft(d)
    setBaseline(draftSignature(d))
    setOriginal(base ?? null)
    setLinkedId(d.editId ?? d.basedOn ?? null)
    setPhase("edit")
  }, [])

  // decide, once, what the screen starts with: a new chart, a chart being fixed, or the unfinished work to continue
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !hydrated || !signedIn) return
    if ((entry.kind === "edit" || entry.kind === "copy" || entry.kind === "from") && (linked.status === "loading" || linked.status === "idle")) return
    started.current = true
    if (entry.kind === "draft") {
      const stored = book[entry.key]
      begin(stored ? stored.draft : fresh())
      return
    }
    if (entry.kind === "from") {
      if (linked.status !== "ready" || !linked.proposal) {
        setMissing(true)
        setPhase("edit")
        return
      }
      const base = draftFromOther(linked.proposal)
      fromBase.current = base
      const found = entryChoices(book, { song: base.songId }).filter((e) => e.draft.instrument === base.instrument)
      if (found.length) {
        setChoices(found)
        setPhase("resume")
      } else {
        setViaFrom(true)
        begin(base)
      }
      return
    }
    if (entry.kind === "edit" || entry.kind === "copy") {
      if (linked.status !== "ready" || !linked.proposal) {
        setMissing(true)
        setPhase("edit")
        return
      }
      const base = draftFromProposal(linked.proposal, entry.kind)
      const found = entryChoices(book, entry.kind === "edit" ? { edit: entry.id } : { copy: entry.id })
      if (found.length) {
        setChoices(found)
        setOriginal(base)
        setPhase("resume")
      } else begin(base, base)
      return
    }
    const found = entryChoices(book, { song: entry.song })
    if (found.length) {
      setChoices(found)
      setPhase("resume")
    } else begin(fresh())
  }, [hydrated, signedIn, entry, linked, book, begin, fresh])
  useEffect(() => {
    if (!signedIn) setPhase("edit")
  }, [signedIn])

  const dirty = draftSignature(draft) !== baseline
  const keep = dirty && worthKeeping(draft)
  const locked = Boolean(draft.editId || draft.basedOn)

  // keep the unfinished chart on the phone (a short pause after the last change, not on every tap)
  useEffect(() => {
    if (phase !== "edit" || !dirty) return undefined
    const id = setTimeout(() => saveDraft(draft), 400)
    return () => clearTimeout(id)
  }, [draft, dirty, phase, saveDraft])

  // ...and once more when the screen goes away, so the last tap is never lost
  const skipFlush = useRef(false)
  const latest = useRef({ draft, dirty, phase })
  latest.current = { draft, dirty, phase }
  useEffect(
    () => () => {
      const now = latest.current
      if (!skipFlush.current && now.phase === "edit" && now.dirty) useChordDraftStore.getState().save(now.draft)
    },
    [],
  )

  const [lyricsTry, setLyricsTry] = useState(0)
  const lyrics = useSongLyrics(draft.songId, lyricsTry)
  const lines = lyrics.status === "ready" ? lyrics.lines : null
  const counts = lyrics.status === "ready" ? lyrics.wordCounts : []
  useEffect(() => {
    if (lyrics.status === "ready") setDraft((d) => fitLines(d, lyrics.lines.length))
  }, [lyrics])

  const [chooser, setChooser] = useState(false)
  const [entryMode, setEntryMode] = useState<"tap" | "paste">("tap")
  const [selected, setSelected] = useState<Slot | null>(null)
  const [showProblems, setShowProblems] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ChordFailure | null>(null)
  const [sent, setSent] = useState<{ proposal: ChordProposal; again: boolean; copy: boolean } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [startingOver, setStartingOver] = useState<DraftEntry | null>(null)
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  const patch = useCallback((change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change })), [])
  const total = countChords(draft)
  const problems: DraftProblem[] = useMemo(() => draftProblems(draft, counts), [draft, counts])
  const used = useMemo(() => usedChords(draft.lines), [draft.lines])
  const guitar = draft.instrument === "guitar"
  // `dismissTo` goes back to the Upload screen that is already in the stack (this screen is opened over it) and only
  // opens one when there is none; `replace` would leave the old Upload under a second one, and the result screen would
  // have two hubs under it
  const leave = () => (router.canGoBack() ? router.back() : router.dismissTo(href("/upload")))
  const toHub = () => router.dismissTo(href("/upload"))
  // opened from a song page (or from a chart on it): that is where "Back" goes
  const cameFromSong = (entry.kind === "new" && entry.song !== null) || entry.kind === "from"

  // closing: unfinished work is kept as a draft, and the member is told so before leaving
  const requestClose = () => {
    if (phase === "edit" && !sent && keep && total > 0) setLeaving(true)
    else leave()
  }

  // ---- the selected word and the chord sheet ----
  const selectedWord = useMemo(() => {
    if (!selected || !lines) return null
    return splitWords(lines[selected.line] ?? "")[selected.word] ?? null
  }, [selected, lines])
  const lastWord = useRef("")
  if (selectedWord) lastWord.current = selectedWord
  const currentChord = selected ? (draft.lines[selected.line]?.find((p) => p.word === selected.word)?.chord ?? null) : null
  const sheetOpen = entryMode === "tap" && selected !== null && lines !== null && selectedWord !== null && !sent && phase === "edit"

  const pick = (chord: string | null) => {
    if (!selected) return
    setDraft((d) => setChord(d, selected.line, selected.word, chord))
  }
  const closeSheet = useCallback(() => setSelected(null), [])

  // keep the selected word in sight above the sheet
  const [covered, setCovered] = useState(0)
  const coveredRef = useRef(0)
  coveredRef.current = covered
  const areaRef = useRef<View>(null)
  // the shared "jump to the first field that is wrong" helper (lib/forms/useFormFocus.ts) owns the scroll view's ref
  const form = useFormFocus()
  const scrollRef = form.scrollRef
  const offsetRef = useRef(0)
  const nodes = useRef<Record<string, View | null>>({})
  useEffect(() => {
    if (!selected) return undefined
    const id = setTimeout(() => {
      const node = nodes.current[`${selected.line}:${selected.word}`]
      const area = areaRef.current
      if (!node || !area) return
      area.measureInWindow((_ax, ay, _aw, ah) => {
        node.measureInWindow((_nx, ny, _nw, nh) => {
          const next = revealOffset({ itemTop: ny, itemBottom: ny + nh, viewTop: ay, viewBottom: ay + ah, covered: coveredRef.current, offset: offsetRef.current })
          if (next !== null) scrollRef.current?.scrollTo({ y: next, animated: true })
        })
      })
    }, 80)
    return () => clearTimeout(id)
  }, [selected, covered])

  const applyPasted = (pasted: Placement[][], meta: ParseMeta) => {
    setDraft((d) => {
      let next = replaceLines(d, pasted)
      if (meta.capo !== undefined && next.instrument === "guitar") next = setCapo(next, meta.capo)
      if (meta.key) next = { ...next, key: meta.key }
      if (meta.strum && next.instrument === "guitar") next = { ...next, strum: meta.strum.slice(0, STRUM_MAX) }
      return next
    })
    setEntryMode("tap")
  }

  const problemText = (p: DraftProblem) => t(`chordOffer.problem.${p}`)
  const byField = useMemo(() => problemsByField(problems), [problems])
  /** the sentence under a field once Send was pressed with something wrong in it; null while it is fine */
  const fieldError = (field: FormField): string | null => (showProblems && byField[field]?.length ? problemText(byField[field]![0]) : null)

  const send = async () => {
    setFailure(null)
    if (problems.length) {
      // say what is wrong under every field that is wrong, and take the person to the first one from the top
      setShowProblems(true)
      setSelected(null)
      const by = problemsByField(problems)
      const keys = FIELD_ORDER.filter((f) => by[f]?.length)
      const messages: Record<string, string> = {}
      for (const f of keys) messages[f] = problemText(by[f]![0])
      void form.focusFirst(keys, messages)
      return
    }
    setBusy(true)
    try {
      const payload = toPayload(draft, counts)
      const backend = chordsBackend()
      const proposal = draft.editId ? await backend.update(draft.editId, payload) : await backend.offer(payload)
      if (!alive.current) return
      skipFlush.current = true
      discardKey(draftKey(draft))
      setSelected(null)
      setSent({ proposal, again: Boolean(draft.editId), copy: Boolean(draft.basedOn) })
    } catch (error) {
      if (!alive.current) return
      // nothing is lost: the draft is on the phone, and the sentence says what to do
      saveDraft(draft)
      setFailure(chordFailure(error))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const another = () => {
    const next = { ...newDraft(null), instrument: draft.instrument, key: draft.key, capo: draft.capo }
    skipFlush.current = false
    fromBase.current = null
    setViaFrom(false)
    setMoreOpen(false)
    setSent(null)
    setSelected(null)
    setShowProblems(false)
    setFailure(null)
    begin(next)
  }

  const discardThis = () => {
    discardKey(draftKey(draft))
    setDiscarding(false)
    setSelected(null)
    setShowProblems(false)
    setFailure(null)
    begin(original ?? newDraft(draft.songId), original)
  }

  const continueWith = (e: DraftEntry) => begin(e.draft, original)
  const startOver = () => {
    const target = startingOver
    setStartingOver(null)
    if (!target) return
    discardKey(target.key)
    const rest = choices.filter((c) => c.key !== target.key)
    setChoices(rest)
    if (original && (entry.kind === "edit" || entry.kind === "copy")) begin(original, original)
    else if (rest.length === 0) begin(fresh())
  }

  const payloadForPreview = useMemo(() => {
    if (!lines || total === 0) return null
    const payload = toPayload({ ...draft, songId: draft.songId ?? 0 }, counts)
    return { baseKey: payload.baseKey, strum: payload.strum, lines: payload.lines, instrument: payload.instrument }
  }, [lines, total, draft, counts])

  const mode: "edit" | "copy" | null = draft.editId ? "edit" : draft.basedOn ? "copy" : null
  const title = mode === "edit" ? t("chordOffer.title.fix") : mode === "copy" ? t("chordOffer.title.copy") : t("chordOffer.title")
  const sendLabel = busy ? t("chordOffer.sending") : failure === "network" ? t("chordOffer.send.retry") : mode === "copy" ? t("chordOffer.send.copy") : mode === "edit" ? t("chordOffer.send.again") : t("chordOffer.send")

  const discardBody = total > 0 && draft.songId ? t("chordOffer.discard.body", { count: total, number: draft.songId }) : t("chordOffer.discard.bodyNoChords")
  const startOverBody = startingOver
    ? startingOver.chords > 0 && startingOver.draft.songId
      ? t("chordOffer.discard.body", { count: startingOver.chords, number: startingOver.draft.songId })
      : t("chordOffer.discard.bodyNoChords")
    : ""
  const leaveActions: DialogAction[] = [
    { label: t("chordOffer.leave.keep"), tone: "quiet", onPress: () => setLeaving(false) },
    {
      label: t("chordOffer.leave.save"),
      tone: "primary",
      onPress: () => {
        saveDraft(draft)
        skipFlush.current = true
        setLeaving(false)
        leave()
      },
    },
    {
      label: t("chordOffer.leave.discard"),
      tone: "danger",
      onPress: () => {
        skipFlush.current = true
        discardKey(draftKey(draft))
        setLeaving(false)
        leave()
      },
    },
  ]
  const discardActions: DialogAction[] = [
    { label: t("chordOffer.discard.keep"), tone: "quiet", onPress: () => setDiscarding(false) },
    { label: t("chordOffer.discard.yes"), tone: "danger", onPress: discardThis },
  ]
  const startOverActions: DialogAction[] = [
    { label: t("chordOffer.discard.keep"), tone: "quiet", onPress: () => setStartingOver(null) },
    { label: t("chordOffer.discard.yes"), tone: "danger", onPress: startOver },
  ]

  const inBook = draftKey(draft) in book

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[s.root, { backgroundColor: theme.page }]}>
      <SheetTopBar onClose={requestClose} closeLabel={t("common.close")} />

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
            <Text style={[s.over, { color: theme.accent }]}>{t("chordOffer.over")}</Text>
            <Text style={[s.h1, { color: theme.textHeading }]} accessibilityRole="header">
              {sent ? t("chordOffer.title") : title}
            </Text>
          </Reveal>

          {!signedIn ? (
            <View style={s.field}>
              <Text style={[s.h2, { color: theme.textHeading }]}>{t("chordOffer.signin.title")}</Text>
              <Hint theme={theme}>{t("chordOffer.signin.body")}</Hint>
              <ActionButton theme={theme} label={t("chordOffer.signin.action")} onPress={() => router.push(href("/signin"))} />
            </View>
          ) : sent ? (
            <SentPanel
              theme={theme}
              proposal={sent.proposal}
              again={sent.again}
              copy={sent.copy}
              name={name}
              fromSong={cameFromSong}
              onOpenSong={() => router.dismissTo(href(`/song-v2/ps-${sent.proposal.songId}`))}
              onAnother={another}
              onHub={toHub}
              onBack={leave}
            />
          ) : phase === "loading" ? (
            <Hint theme={theme}>{t("chordOffer.edit.loading")}</Hint>
          ) : phase === "resume" ? (
            <ResumePanel
              theme={theme}
              entries={choices}
              onContinue={continueWith}
              onStartOver={setStartingOver}
              onFresh={() => {
                if (fromBase.current) setViaFrom(true)
                begin(fresh())
              }}
            />
          ) : missing ? (
            <View style={s.field} accessibilityLiveRegion="polite">
              <Hint theme={theme} tone="danger">
                {t("chordOffer.edit.gone")}
              </Hint>
              <ActionButton theme={theme} tone="quiet" label={entry.kind === "from" ? t("chordOffer.sent.backSong") : t("chordOffer.edit.back")} onPress={entry.kind === "from" ? leave : toHub} />
            </View>
          ) : (
            <>
              <Reveal index={1} style={s.field}>
                {mode && linked.proposal ? <EditBanner theme={theme} mode={mode} proposal={linked.proposal} /> : viaFrom ? <Hint theme={theme}>{t("chordOffer.edit.from")}</Hint> : <Hint theme={theme}>{t("chordOffer.intro")}</Hint>}
                {team && !mode ? <Hint theme={theme}>{t("chordOffer.intro.team")}</Hint> : null}
              </Reveal>

              {/* 1. the song */}
              <Reveal index={2} style={s.field}>
                <View {...form.field("song")} style={s.field}>
                  <Label theme={theme}>{t("chordOffer.song.label")}</Label>
                  <KPress
                    accessibilityRole="button"
                    accessibilityLabel={draft.songId ? t("chordOffer.song.a11y", { number: draft.songId, title: lyrics.status === "ready" || lyrics.status === "none" ? lyrics.title : "" }) : t("chordOffer.song.none")}
                    onPress={locked ? undefined : () => setChooser(true)}
                    pressedScale={locked ? 1 : 0.99}
                    style={[s.inputBox, { backgroundColor: theme.card, borderColor: fieldError("song") ? amColors.danger : theme.line }]}
                  >
                    <Text style={[s.songName, { color: draft.songId ? theme.textHeading : theme.textBody }]} numberOfLines={1}>
                      {draft.songId ? (lyrics.status === "ready" || lyrics.status === "none" ? t("chordOffer.songTitle", { number: draft.songId, title: lyrics.title }) : t("chordOffer.song", { number: draft.songId })) : t("chordOffer.song.none")}
                    </Text>
                    {locked ? null : (
                      <View style={[s.pasteBtn, { backgroundColor: theme.peach }]}>
                        <Text style={[s.pasteText, { color: theme.accent }]}>{draft.songId ? t("chordOffer.song.change") : t("chordOffer.song.choose")}</Text>
                      </View>
                    )}
                  </KPress>
                  {fieldError("song") ? (
                    <Hint theme={theme} tone="danger">
                      {fieldError("song")}
                    </Hint>
                  ) : locked ? null : (
                    <Hint theme={theme}>{t("chordOffer.song.hint", { count: String(PS_SONG_COUNT) })}</Hint>
                  )}
                </View>
              </Reveal>

              {/* 2. instrument */}
              <Reveal index={3} style={s.field}>
                <Label theme={theme}>{t("chordOffer.instrument.label")}</Label>
                <View style={s.chips} accessibilityRole="radiogroup">
                  {locked ? (
                    <Chip theme={theme} label={t(`chordOffer.instrument.${draft.instrument}` as "chordOffer.instrument.guitar")} on minWidth={120} onPress={() => {}} />
                  ) : (
                    <>
                      <Chip theme={theme} label={t("chordOffer.instrument.guitar")} on={guitar} minWidth={120} onPress={() => patch(setInstrument(draft, "guitar"))} />
                      <Chip theme={theme} label={t("chordOffer.instrument.harmonium")} on={!guitar} minWidth={120} onPress={() => patch(setInstrument(draft, "harmonium"))} />
                    </>
                  )}
                </View>
              </Reveal>

              {/* 3. key (and capo for a guitar): a question in plain words, an answer to pick, an example of what it does */}
              <Reveal index={4} style={s.field}>
                <Label theme={theme}>{guitar ? t("chordOffer.key.guitar.label") : t("chordOffer.key.harmonium.label")}</Label>
                <Hint theme={theme}>{guitar ? t("chordOffer.key.guitar.hint") : t("chordOffer.key.harmonium.hint")}</Hint>
                <View style={s.chips} accessibilityRole="radiogroup">
                  {ROOTS.map((root) => (
                    <Chip key={root} theme={theme} label={root} on={draft.key === root} a11y={t("chordOffer.key.a11y", { key: root })} minWidth={52} onPress={() => patch({ key: root })} />
                  ))}
                </View>
                <View style={[s.example, { backgroundColor: theme.peach }]} accessibilityLiveRegion="polite">
                  <Text style={[s.exampleText, { color: theme.textHeading }]}>{t("chordOffer.key.example", { key: draft.key, chords: suggestedChords(draft.key).slice(0, 4).join(" · ") })}</Text>
                </View>
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
              </Reveal>

              {/* 4. the chords */}
              <Reveal index={5} style={s.field}>
                <View {...form.field("chords")} style={s.field}>
                  <Label theme={theme}>{t("chordOffer.chords.label")}</Label>
                  <View style={s.chips} accessibilityRole="tablist" accessibilityLabel={t("chordOffer.chords.mode.a11y")}>
                    <Chip theme={theme} label={t("chordOffer.chords.mode.tap")} on={entryMode === "tap"} minWidth={130} onPress={() => setEntryMode("tap")} />
                    <Chip theme={theme} label={t("chordOffer.chords.mode.paste")} on={entryMode === "paste"} minWidth={130} onPress={() => setEntryMode("paste")} />
                  </View>
                  {fieldError("chords") ? (
                    <Hint theme={theme} tone="danger">
                      {fieldError("chords")}
                    </Hint>
                  ) : null}
                  {lyrics.status === "idle" ? <Hint theme={theme}>{t("chordOffer.lyrics.pick")}</Hint> : null}
                  {lyrics.status === "loading" ? <Hint theme={theme}>{t("chordOffer.lyrics.loading")}</Hint> : null}
                  {lyrics.status === "error" ? (
                    <>
                      <Hint theme={theme} tone="danger">
                        {t("chordOffer.lyrics.error")}
                      </Hint>
                      <ActionButton theme={theme} tone="quiet" label={t("upload.mine.retry")} onPress={() => setLyricsTry((n) => n + 1)} />
                    </>
                  ) : null}
                  {lyrics.status === "none" ? <Hint theme={theme} tone="danger">{t("chordOffer.lyrics.none")}</Hint> : null}
                  {lines ? (
                    entryMode === "tap" ? (
                      <>
                        <Hint theme={theme}>{t("chordOffer.chords.tapHint")}</Hint>
                        {/* a tap on the blank part of the sheet puts the chord sheet away; a word catches its own tap */}
                        <Pressable accessible={false} onPress={closeSheet} style={s.editorTap}>
                          <ChordSlotEditor theme={theme} lines={lines} placements={draft.lines} selected={selected} onSelect={setSelected} nodes={nodes} />
                        </Pressable>
                      </>
                    ) : (
                      <ChordPasteBox theme={theme} lyricLines={lines} placements={draft.lines} onApply={applyPasted} />
                    )
                  ) : null}
                  {lines ? (
                    <Text style={[s.count, { color: theme.textBody }]} accessibilityLiveRegion="polite">
                      {t("chordOffer.chords.count", { count: total })}
                      {total > 0 ? ` · ${linesWithChords(draft)}/${lines.length}` : ""}
                    </Text>
                  ) : null}
                </View>
              </Reveal>

              {/* 5. the preview */}
              {lines ? (
                <View style={s.field}>
                  <Text style={[s.h2, { color: theme.textHeading }]} accessibilityRole="header">
                    {t("chordOffer.preview.title")}
                  </Text>
                  {payloadForPreview ? (
                    <>
                      <Hint theme={theme}>{t("chordOffer.preview.hint")}</Hint>
                      <ChartPreview
                        t={spTheme}
                        romanLines={lines}
                        proposal={payloadForPreview}
                        capo={guitar ? draft.capo : 0}
                        harmoniumKey={draft.key}
                        caption={guitar ? (draft.capo > 0 ? t("chordOffer.preview.summary.guitar", { capo: draft.capo }) : t("chordOffer.preview.summary.guitarNoCapo")) : t("chordOffer.preview.summary.harmonium", { key: draft.key })}
                      />
                    </>
                  ) : (
                    <Hint theme={theme}>{t("chordOffer.preview.empty")}</Hint>
                  )}
                </View>
              ) : null}

              {/* 6. the optional part (strumming pattern, note), shut until asked for or filled in */}
              <View style={s.field}>
                {moreOpen || draft.strum || draft.note || fieldError("strum") || fieldError("note") ? (
                  <>
                    {guitar ? (
                      <View {...form.field("strum")} style={s.field}>
                        <Label theme={theme}>{t("chordOffer.strum.label")}</Label>
                        <View style={[s.inputBox, { backgroundColor: theme.card, borderColor: fieldError("strum") ? amColors.danger : theme.line }]}>
                          <TextInput
                            ref={form.input("strum") as never}
                            value={draft.strum}
                            onChangeText={(text) => patch({ strum: text.slice(0, STRUM_MAX) })}
                            onFocus={closeSheet}
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
                          onFocus={closeSheet}
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
                ) : (
                  <ActionButton theme={theme} tone="quiet" label={guitar ? t("chordOffer.details.show.guitar") : t("chordOffer.details.show.harmonium")} onPress={() => setMoreOpen(true)} />
                )}
              </View>

              {/* 7. confirm and send */}
              <View style={s.field}>
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

                {failure ? (
                  <View style={s.problems} accessibilityLiveRegion="polite">
                    <Hint theme={theme} tone="danger">
                      {t(`chordOffer.failure.${failure}`)}
                    </Hint>
                    {SEE_CHARTS.has(failure) ? <ActionButton theme={theme} tone="quiet" label={t("chordOffer.failure.seeCharts")} onPress={toHub} /> : null}
                    {failure === "signin" ? <ActionButton theme={theme} tone="quiet" label={t("chordOffer.signin.action")} onPress={() => router.push(href("/signin"))} /> : null}
                  </View>
                ) : null}
                <ActionButton theme={theme} label={sendLabel} onPress={() => void send()} disabled={busy} busy={busy} />
                {keep || inBook ? (
                  <>
                    <Hint theme={theme}>{t("chordOffer.draft.saved")}</Hint>
                    <ActionButton theme={theme} tone="quiet" label={t("chordOffer.draft.discardAction")} onPress={() => setDiscarding(true)} />
                  </>
                ) : null}
              </View>
            </>
          )}
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

      <PsSongChooser
        visible={chooser}
        selected={draft.songId}
        onClose={() => setChooser(false)}
        onPick={(song) => {
          setChooser(false)
          setSelected(null)
          setFailure(null)
          setDraft((d) => (d.songId === song.number ? d : { ...newDraft(song.number), instrument: d.instrument, key: d.key, capo: d.capo, strum: d.strum }))
        }}
      />

      <ConfirmDialog theme={theme} open={leaving} title={t("chordOffer.leave.title")} body={t("chordOffer.leave.body")} actions={leaveActions} onDismiss={() => setLeaving(false)} />
      <ConfirmDialog theme={theme} open={discarding} title={t("chordOffer.discard.title")} body={discardBody} actions={discardActions} onDismiss={() => setDiscarding(false)} />
      <ConfirmDialog theme={theme} open={startingOver !== null} title={t("chordOffer.discard.title")} body={startOverBody} actions={startOverActions} onDismiss={() => setStartingOver(null)} />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  area: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 8 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  h2: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.3, textTransform: "uppercase" },
  field: { gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  capoValue: { minWidth: 110, textAlign: "center", fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22 },
  inputBox: { minHeight: 56, borderRadius: CORNER, borderWidth: 1.5, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  songName: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  pasteBtn: { height: 40, paddingHorizontal: 16, borderRadius: PILL, alignItems: "center", justifyContent: "center" },
  pasteText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  editorTap: { paddingVertical: 8 },
  example: { borderRadius: CORNER, paddingHorizontal: 16, paddingVertical: 12 },
  exampleText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20 },
  count: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 18 },
  problems: { gap: 8 },
})
