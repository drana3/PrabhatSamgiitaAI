import { createElement, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import * as DocumentPicker from "expo-document-picker"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import { PsSongChooser } from "@/components/kirtan/add/PsSongChooser"
import { AVARTA } from "@/lib/kirtan/practice"
import { useUploadExit } from "@/components/kirtan/useUploadExit"
import { AuthorTick } from "@/components/kirtan/add/AuthorTick"
import { InstrumentField } from "@/components/kirtan/add/InstrumentField"
import { MantraField } from "@/components/kirtan/add/MantraField"
import { KindField } from "@/components/kirtan/add/KindField"
import { PracticeField } from "@/components/kirtan/add/PracticeField"
import { DanceField, PerformanceField, TempoField } from "@/components/kirtan/add/SoundFields"
import { RecordingTypeField } from "@/components/kirtan/add/RecordingTypeField"
import { MoodField } from "@/components/kirtan/add/MoodField"
import { StyleField } from "@/components/kirtan/add/StyleField"
import { useSendVideoLink } from "@/components/kirtan/add/useSendVideoLink"
import { VideoLinkField } from "@/components/kirtan/add/VideoLinkField"
import { kindHasInstrument } from "@/lib/kirtan/instruments"
import { fixKiirtanSpelling } from "@/lib/kirtan/kiirtanSpelling"
import { kindHasMood } from "@/lib/kirtan/moods"
import { kindHasStyle } from "@/lib/kirtan/styles"
import { effectiveRecordingType, kindHasPerformance, kindHasRecordingType, titleNeedsEnglish } from "@/lib/kirtan/recordingInfo"
import { useValueOptions } from "@/lib/kirtan/valueOptions"
import { offersVideoLink } from "@/lib/recordingVideos/uploadLink"
import { videoFailureText } from "@/lib/recordingVideos/words"
import { FieldError, LanguageField, LanguagePicker, type LanguageValue } from "@/components/kirtan/add/KindFields"
import { ApplyToAllCard, QueueBar, QueueRow, QueueSummaryCard } from "@/components/kirtan/add/QueueRows"
import { ModerationNotice } from "@/components/common/ModerationNotice"
import { SheetTopBar } from "@/components/common/SheetTopBar"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { useFormFocus } from "@/lib/forms/useFormFocus"
import { controlBorder } from "@/lib/controlColors"
import { formatDate, useT } from "@/lib/i18n"
import { kindHasDance, kindHasLanguage, kindHasPerformer, kindRequiresLanguage, normalizeKind } from "@/lib/kirtan/kind"
import { playableOriginal, type OriginalRef } from "@/lib/kirtan/original"
import { effectiveFields, effectivePractice, hasWork, practiceCounts, incompleteRows, isRetryable, leftForTomorrow, missingCounts, queueCounts, queueProgress, queueSummary, rowMissing, type PickedFile, type QueueItem } from "@/lib/kirtan/queue"
import { fileProblemText, isRulesAccepted, MAX_UPLOAD_BYTES } from "@/lib/kirtan/rules"
import { validateSubmission, type SubmissionError } from "@/lib/kirtan/submissions"
import { RECORDING_KINDS, type DanceId, type RecordingKind } from "@/lib/kirtan/types"
import { languageErrorKey, missingKindFields, moreDetailsFor, moreDetailsHintKey } from "@/lib/kirtan/uploadForm"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
import { useContentRulesStore } from "@/stores/contentRulesStore"
import { defaultsOf, useUploadQueueStore, yearOf, type QueueDraft } from "@/stores/uploadQueueStore"
import { href } from "@/utils/href"

const ChevronGlyph = ({ color, open }: { color: string; open: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)

const LIMIT_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))

/** What is wrong with the form, shown under the button. `row` names the file when it is one row's title. */
type Problem = { form: SubmissionError; row?: string } | "picker" | "nothing"

/** Which language picker is open: the form's own, "Apply to all rows", or one row (its id). */
type LangTarget = "form" | "all" | (string & {})

/**
 * Add Recording: the one form for everything people upload (docs/kiirtan-publishing.md). The person picks the TYPE
 * (Kiirtan, Bhajan, Prabhat Samgiita, Spiritual song, Dance music, Baba's audio or Others), names the performer, picks one or many audio files and gives
 * each its title; the choices at the top apply to every file. Upload runs the files one after another, shows each one's
 * state and ends with a summary. Nothing waits for a reviewer: a recording is live the moment its upload succeeds, the
 * team looks afterwards and may remove it with a notice that says why. Only a signed-in person can upload.
 *
 * The queue lives in stores/uploadQueueStore, so leaving this screen does not stop it and coming back shows where it is.
 * The file picker is an `<input type=file multiple accept="audio/*">` in the web preview and the system document picker
 * (expo-document-picker, audio only, several files) on a phone.
 */
export default function AddKirtanScreen() {
  return <AddRecordingForm />
}

/**
 * The form of every recording. Others is one more TYPE of it (Dada, 12 Nov 2026: it left the Upload hub as a door of its own): when the
 * person picks Others a required choice of what it is appears under the type (Guru Puja, Pitr Yajina ... Something else; no default) and
 * the playlist-of-an-event entry steps aside. Everything else is the same form with the same queue. `?kind=other_mantra` opens it on Others.
 */
export function AddRecordingForm() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === "web"
  // "Upload a corrected version" opens this screen with the removed recording's words already in.
  const params = useLocalSearchParams<{ kind?: string; title?: string; author?: string; song?: string; broadcast?: string; broadcastTitle?: string }>()
  const actions = useKirtanActions()

  const signedIn = useAuthStore((s) => s.mode === "signed_in") || MOCKUP_DATA
  const displayName = useAuthStore((s) => s.displayName)
  const acceptedAt = useContentRulesStore((s) => s.acceptedAt)
  const acceptedVersion = useContentRulesStore((s) => s.version)
  const rules = useMemo(() => ({ acceptedAt, version: acceptedVersion }), [acceptedAt, acceptedVersion])
  const rulesOk = isRulesAccepted(rules)

  // Opening the screen: files picked on an earlier visit and never sent are not shown again (an old file must not follow a new type).
  const opened = useRef(false)
  if (!opened.current) {
    opened.current = true
    useUploadQueueStore.getState().openFresh()
    // "Add the recording" of an ended live broadcast opens this form with the broadcast named: the files become its recording
    const target = typeof params.broadcast === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(params.broadcast) ? params.broadcast : null
    useUploadQueueStore.getState().setBroadcast(target ? { id: target, title: typeof params.broadcastTitle === "string" ? params.broadcastTitle.slice(0, 300) : "" } : null)
  }
  const forBroadcast = useUploadQueueStore((st) => st.forBroadcast)
  const draft = useUploadQueueStore((s) => s.draft)
  const items = useUploadQueueStore((s) => s.items)
  const running = useUploadQueueStore((s) => s.running)
  const stopped = useUploadQueueStore((s) => s.stopped)
  const store = useUploadQueueStore.getState
  // Upload with something missing jumps to the first empty required field and says which one (lib/forms/focusInvalid.ts)
  const form = useFormFocus()
  // the words the team accepted under "Add your own" (main instrument): offered after the fixed list
  const instrumentWords = useValueOptions("instrument", draft.kind !== "baba_audio")
  // the names the team accepted under "Something else" of Others
  const mantraWords = useValueOptions("mantra", draft.kind === "other_mantra")

  const [agree, setAgree] = useState(false)
  // an optional video link of a Kiirtan (docs/kiirtan-video.md): sent once the recording is up
  const [videoLink, setVideoLink] = useState("")
  const [problem, setProblem] = useState<Problem | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [chooser, setChooser] = useState(false)
  const [langFor, setLangFor] = useState<LangTarget | null>(null)
  // after the first press of Upload: the fields that block it show their error
  const [tried, setTried] = useState(false)
  // a problem that has no field of its own on screen is said under the button
  const [loose, setLoose] = useState<string | null>(null)
  const inputRef = useRef<{ click: () => void } | null>(null)
  const titleHint = useRef(typeof params.title === "string" ? params.title : "")
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  // The first time here: the kind and performer a corrected upload came with, else the person's own name.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !signedIn) return
    prefilled.current = true
    const patch: Partial<QueueDraft> = {}
    if (params.kind) patch.kind = normalizeKind(params.kind)
    const song = Number(params.song)
    if (Number.isInteger(song) && song > 0) patch.psSong = { number: song, title: "" }
    const author = typeof params.author === "string" ? params.author.trim() : ""
    if (author) patch.performer = author
    else if (!store().draft.performer.trim() && displayName && displayName !== "Guest") patch.performer = displayName
    if (Object.keys(patch).length) store().setDraft(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn])

  // typing, picking or adding a file takes the message away: it said what was missing
  useEffect(() => {
    form.clear()
    setLoose(null)
    setProblem((current) => (current === "picker" ? current : null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, items])

  const locked = running
  const counts = queueCounts(items)
  const retryable = items.filter(isRetryable).length
  const finished = !running && counts.total > 0 && !hasWork(items)
  const summary = queueSummary(items)
  const kind = draft.kind
  useSendVideoLink({
    rows: items,
    link: videoLink,
    onSent: () => setVideoLink(""),
    onFailed: (failure) => actions.flash(t("recVideos.field.after", { reason: videoFailureText(t, failure) })),
  })
  const defaults = defaultsOf(draft)
  const formMissing = missingKindFields({ kind, language: draft.language, languageOther: draft.languageOther, dance: draft.dance })
  const rowsIncomplete = incompleteRows(items, defaults)
  const practiceSummary = practiceCounts(items, kind, draft.practice)
  const missing = missingCounts(items, defaults)
  /** the inline error under a field: only after a try, and only when it is what blocks the upload */
  const fieldError = (field: "language" | "languageName" | "dance"): string | null => {
    if (!tried) return null
    const blocks = items.length ? rowsIncomplete.some((row) => row.missing.includes(field)) : formMissing.includes(field)
    return blocks && formMissing.includes(field) ? (t as (key: string) => string)(field === "language" ? languageErrorKey(kind) : `ugc.form.error.${field}`) : null
  }
  const languageError = fieldError("language") ?? fieldError("languageName")
  const danceError = fieldError("dance")
  const languageValue: LanguageValue = { language: draft.language, languageOther: draft.languageOther }
  const pickerValue: LanguageValue =
    langFor === "form" || langFor === null
      ? languageValue
      : langFor === "all"
        ? { language: null, languageOther: "" }
        : (() => {
            const row = items.find((item) => item.id === langFor)
            const fields = row ? effectiveFields(row, defaults) : null
            return { language: fields?.language ?? null, languageOther: fields?.languageOther ?? "" }
          })()
  const pickLanguage = (value: LanguageValue) => {
    if (langFor === "form") store().setDraft({ language: value.language, languageOther: value.languageOther })
    else if (langFor === "all") {
      store().applyToAll({ language: value.language, languageOther: value.languageOther })
      actions.flash(t("rec.q.applied", { count: store().items.filter((item) => item.status === "waiting").length }))
    } else if (langFor) store().setRowFields(langFor, { language: value.language, languageOther: value.languageOther })
    setLangFor(null)
    setProblem(null)
  }
  const pickDanceForAll = (dance: DanceId) => {
    store().applyToAll({ dance })
    actions.flash(t("rec.q.applied", { count: store().items.filter((item) => item.status === "waiting").length }))
    setProblem(null)
  }

  const listenTo = (ref: OriginalRef) => {
    const playable = playableOriginal(ref)
    if (!playable) {
      actions.flash(t("ugc.dup.cantPlay"))
      return
    }
    actions.open(playable, [playable])
  }

  /* ------------------------------------------------------------------ choosing files */

  const addPicked = (files: PickedFile[]) => {
    if (!files.length) return
    const first = !store().items.length
    const result = store().addFiles(files)
    setProblem(null)
    // a corrected upload comes with its title: it names the first file added
    const hint = titleHint.current.trim()
    if (hint && first && result.added === 1) {
      const added = store().items[0]
      if (added) store().setTitle(added.id, hint)
    }
    titleHint.current = ""
    if (result.skipped) actions.flash(t("rec.q.skipped", { count: result.skipped }))
  }
  const choose = async () => {
    if (isWeb) {
      inputRef.current?.click()
      return
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", multiple: true, copyToCacheDirectory: true })
      if (result.canceled || !alive.current) return
      addPicked(result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, size: typeof asset.size === "number" ? asset.size : null, type: asset.mimeType ?? null })))
    } catch {
      if (alive.current) setProblem("picker")
    }
  }
  const onPickedWeb = (list: ArrayLike<File> | null | undefined) => {
    if (!list || !list.length) return
    const files: PickedFile[] = []
    for (let i = 0; i < list.length; i += 1) {
      const file = list[i]
      if (!file) continue
      const uri = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(file) : ""
      files.push({ name: file.name, uri, size: typeof file.size === "number" ? file.size : null, type: file.type || null })
    }
    addPicked(files)
  }

  /** "Yes, this is it" on the duplicate card: the file is dropped, the person is told and goes back to choosing a file. */
  const sameAsLibrary = (id: string) => {
    void store().decideSimilar(id, false)
    const message = t("ugc.similar.already")
    actions.flash(message)
    // nothing left to send: the file field says it too and takes the person there
    if (!store().items.length) void form.focusFirst(["file"], { file: message })
  }

  /* ------------------------------------------------------------------ starting */

  /** The sentence for a problem code (the same words as under the field). */
  const messageFor = (code: SubmissionError): string => {
    if (code === "format" || code === "size") return fileProblemText(code)
    if (code === "language") return (t as (key: string) => string)(languageErrorKey(kind))
    return t(`ugc.form.error.${code}`)
  }
  /** Shows the problem and jumps to the field it is about: scrolls there, puts the cursor in it, says which one. */
  const fail = (code: SubmissionError, row?: string) => {
    setProblem({ form: code, row })
    const key = row ? `row-${row}` : code === "author" ? "performer" : code === "titleEnglish" ? "title" : code === "languageName" ? "language" : code === "mantraName" ? "mantra" : code === "format" || code === "size" ? "file" : code
    const message = messageFor(code)
    const go = () =>
      void form.focusFirst([key], { [key]: message }).then((went) => {
        if (went === null) setLoose(message) // no field of its own on screen: say it under the button
      })
    // the year (and an optional language) live in "More details": open it first, then go
    if (!form.has(key) && !moreOpen && (code === "year" || code === "language" || code === "languageName")) {
      setMoreOpen(true)
      setTimeout(go, 80)
    } else go()
  }

  const upload = async () => {
    if (running) return
    setProblem(null)
    setLoose(null)
    form.clear()
    setTried(true)
    const open = items.filter((item) => item.status === "waiting" || item.status === "limit")
    if (!open.length) {
      if (!items.length) fail("file")
      return
    }
    const first = open[0] as QueueItem
    const firstFields = effectiveFields(first, defaults)
    const problemCode = validateSubmission({
      language: firstFields.language,
      languageOther: firstFields.languageOther,
      dance: firstFields.dance,
      kind,
      author: draft.performer,
      psSong: draft.psSong?.number ?? null,
      year: yearOf(draft.year),
      styles: draft.styles,
      stylesOther: draft.stylesOther,
      moods: draft.moods,
      moodsOther: draft.moodsOther,
      recordingType: effectiveRecordingType(first.recordingType, draft.recordingType, kind),
      tempo: draft.tempo,
      performance: draft.performance,
      leadInstrument: draft.leadInstrument,
      leadInstrumentOther: draft.leadInstrumentOther,
      mantraType: draft.mantraType,
      mantraOther: draft.mantraOther,
      byAuthor: draft.byAuthor,
      addedBy: "You",
      termsAccepted: rulesOk || agree,
      title: "x",
      fileName: first.fileName,
      fileUri: first.uri,
      fileSize: first.size,
      fileType: first.type,
    })
    // "year" is typed text here: four digits or empty
    if (problemCode && problemCode !== "year") {
      fail(problemCode)
      return
    }
    if (draft.year.trim() && yearOf(draft.year) == null) {
      fail("year")
      return
    }
    if (problemCode === "year") {
      fail("year")
      return
    }
    // every file needs its language and dance before anything goes up: nothing is sent half-ready
    const lacking = open.map((item) => ({ item, missing: rowMissing(item, defaults) })).find((entry) => entry.missing.length)
    if (lacking) {
      fail(lacking.missing[0]!, lacking.item.id)
      return
    }
    const untitled = open.find((item) => !item.title.trim())
    if (untitled) {
      fail("title", untitled.id)
      return
    }
    // the title of a Kiirtan is in English: the row that is not is marked and nothing goes up
    const notEnglish = open.find((item) => titleNeedsEnglish(kind, item.title))
    if (notEnglish) {
      fail("titleEnglish", notEnglish.id)
      return
    }
    if (!rulesOk) useContentRulesStore.getState().accept()
    await store().start()
  }

  // Before anything went up the form just goes back. After it did, every page above the shell closes (the Upload hub must not
  // stay under the result): Done lands on the tab the person came from, "View" on the list of their uploads.
  const exit = useUploadExit()
  const close = () => (finished ? exit.toOrigin() : router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))
  const viewSubmissions = () => exit.toMine()
  const openRules = () => router.push(href("/content-rules"))
  const addMore = () => {
    store().clearFinished()
    setProblem(null)
  }

  const formError = problem && typeof problem === "object" ? problem.form : null
  // a problem with a field is said under that field (form.error); only the ones with no field of their own are said here
  const problemText = problem === "picker" ? t("ugc.add.pickFailed") : problem === "nothing" ? t("ugc.form.error.file") : loose
  const rowWithProblem = problem && typeof problem === "object" ? problem.row : undefined
  const left = leftForTomorrow(items)
  const settled = counts.total - counts.waiting - counts.uploading
  const open = counts.waiting + counts.limit
  // everything went up: the big button says Done and goes back to the hub, instead of offering an upload of nothing
  const allDone = finished && retryable === 0 && open === 0
  const buttonLabel = running ? t("rec.q.uploadingOf", { done: settled, total: counts.total }) : allDone ? t("common.done") : open > 0 ? t("rec.q.uploadN", { count: open }) : t("rec.q.upload")

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.root, { backgroundColor: theme.page }]}>
      {/* below the status bar and the island, in a row of its own (components/common/SheetTopBar) */}
      <SheetTopBar closeLabel={t("ugc.add.close")} onClose={close} />

      <ScrollView ref={form.scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
        {!signedIn ? (
          <SignInGate theme={theme} onSignIn={() => router.push(href("/signin"))} />
        ) : (
          <>
            <Reveal index={0}>
              <Text style={[styles.over, { color: theme.accent }]}>{t("ugc.add.over")}</Text>
              <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
                {t("ugc.add.heading")}
                {"\n"}
                <Text style={{ color: theme.ink300 }}>{t("ugc.add.heading2")}</Text>
              </Text>
            </Reveal>

            {forBroadcast ? (
              <Reveal index={1}>
                <Text style={[styles.hint, { color: theme.textBody }]} testID="for-broadcast">
                  {t("bc.rec.forBanner", { title: forBroadcast.title })}
                </Text>
              </Reveal>
            ) : null}

            {/* a whole event at once: its own screen (app/upload-set.tsx), docs/kiirtan-sets.md; not for Others */}
            {kind === "other_mantra" ? null : (
            <Reveal index={1} style={styles.setStack}>
              <KPress
                accessibilityRole="link"
                accessibilityLabel={`${t("set.entry.title")}. ${t("set.entry.body")}`}
                onPress={() => !locked && router.push(href("/upload-set"))}
                pressedScale={0.98}
                style={[styles.setEntry, { backgroundColor: theme.peach, borderColor: theme.line }]}
              >
                <View style={styles.moreText}>
                  <Text style={[styles.setEntryTitle, { color: theme.textHeading }]}>{t("set.entry.title")}</Text>
                  <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.entry.body")}</Text>
                </View>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 6l6 6-6 6" stroke={theme.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </KPress>
              <KPress accessibilityRole="link" accessibilityLabel={t("set.entry.mine")} onPress={() => router.push(href("/my-sets"))} pressedScale={0.98} style={styles.linkRow}>
                <Text style={[styles.linkText, { color: theme.accent }]}>{t("set.entry.mine")}</Text>
              </KPress>
            </Reveal>
            )}

            <Reveal index={2} style={styles.field}>
              <KindField
                theme={theme}
                label={t("rec.type.label")}
                value={kind}
                kinds={RECORDING_KINDS}
                row
                disabled={locked}
                testID="kind-field"
                onChange={(k) => {
                  if (locked) return
                  store().setDraft({ kind: k, ...(k === "prabhat_samgiita" ? {} : { psSong: null }) })
                  setProblem(null)
                  setTried(false)
                }}
              />
            </Reveal>

            {/* Others: what is it (a required choice, no default) sits right under the type it belongs to */}
            {kind === "other_mantra" ? (
              <Reveal index={2} style={styles.field}>
                <View {...form.field("mantra")} style={styles.field}>
                  <MantraField theme={theme} value={{ type: draft.mantraType, typeOther: draft.mantraOther }} onChange={(next) => { form.clear(); store().setDraft({ mantraType: next.type, mantraOther: next.typeOther }) }} accepted={mantraWords.accepted} newWordsPerWeek={mantraWords.newWordsPerWeek} invalid={formError === "mantra" || formError === "mantraName" || !!form.error("mantra")} errorText={form.error("mantra")} disabled={locked} />
                </View>
              </Reveal>
            ) : null}

            {kind === "prabhat_samgiita" ? (
              <Reveal index={2} style={styles.field}>
                <View {...form.field("song")} style={styles.field}>
                <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.song.label")}</Text>
                <KPress
                  accessibilityRole="button"
                  accessibilityLabel={draft.psSong ? t("rec.song.chosenA11y", { number: draft.psSong.number, title: draft.psSong.title }) : t("rec.song.choose")}
                  onPress={() => !locked && setChooser(true)}
                  pressedScale={0.99}
                  style={[styles.inputBox, { backgroundColor: theme.card, borderColor: formError === "song" ? amColors.danger : theme.line }]}
                >
                  <Text style={[styles.fileName, { color: draft.psSong ? theme.textHeading : theme.textBody }]} numberOfLines={1}>
                    {draft.psSong ? `PS ${draft.psSong.number}${draft.psSong.title ? ` · ${draft.psSong.title}` : ""}` : t("rec.song.none")}
                  </Text>
                  <View style={[styles.pasteBtn, { backgroundColor: theme.peach }]}>
                    <Text style={[styles.pasteText, { color: theme.accent }]}>{draft.psSong ? t("ugc.add.change") : t("rec.song.choose")}</Text>
                  </View>
                </KPress>
                {form.error("song") ? <FieldError theme={theme} text={form.error("song")!} /> : <Text style={[styles.hint, { color: theme.textBody }]}>{t("rec.song.hint")}</Text>}
                </View>
              </Reveal>
            ) : null}

            {kindHasDance(kind) ? (
              <Reveal index={2}>
                <View {...form.field("dance")}>
                <DanceField theme={theme} value={draft.dance} onChange={(dance) => store().setDraft({ dance })} invalid={!!danceError} errorText={danceError} disabled={locked} />
                </View>
              </Reveal>
            ) : null}

            {kindRequiresLanguage(kind) ? (
              <Reveal index={2}>
                <View {...form.field("language")}>
                  <LanguageField theme={theme} kind={kind} value={languageValue} onOpen={() => setLangFor("form")} invalid={!!languageError} errorText={languageError ?? form.error("language")} disabled={locked} />
                </View>
              </Reveal>
            ) : null}

            {kindHasPerformer(kind) ? (
            <Reveal index={3} style={styles.pair}>
              <View {...form.field("performer")} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>{t("ugc.add.authorLabel")}</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: formError === "author" ? amColors.danger : theme.line }]}>
                <TextInput
                  ref={form.input("performer")}
                  value={draft.performer}
                  onChangeText={(text) => store().setDraft({ performer: text })}
                  editable={!locked}
                  placeholder={t("ugc.add.authorPlaceholder")}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("ugc.add.authorLabel")}
                  maxLength={80}
                  style={[styles.input, { color: theme.textHeading }]}
                />
              </View>
              {form.error("performer") ? <FieldError theme={theme} text={form.error("performer")!} /> : null}
              {items.length > 1 ? <Text style={[styles.hint, { color: theme.textBody }]}>{t("rec.shared.hint")}</Text> : null}
              </View>
              {/* "I am the author of this recording" sits with the performer; Prabhat Samgiita has one author, so it has no tick */}
              <AuthorTick theme={theme} kind={kind} on={draft.byAuthor} onChange={(byAuthor) => store().setDraft({ byAuthor })} disabled={locked} />
            </Reveal>
            ) : null}

            {/* Kiirtan only: the Avarta tick is optional and covers the whole queue (the style is asked in "How it sounds") */}
            {kind === "kiirtan" ? (
              <Reveal index={3} style={styles.group}>
                <PracticeField theme={theme} kind={kind} on={draft.practice === AVARTA} onChange={(on) => store().setDraft({ practice: on ? AVARTA : null })} disabled={locked} />
              </Reveal>
            ) : null}

            {/* How it sounds: how it was recorded, solo or group, the tempo and the main instrument. Each shows for the kinds that carry it. */}
            {kindHasRecordingType(kind) || kindHasInstrument(kind) || kindHasStyle(kind) || kindHasMood(kind) ? (
              <Reveal index={3} style={styles.group}>
                <View {...form.field("mood")} style={styles.field}>
                  <MoodField theme={theme} kind={kind} value={{ moods: draft.moods, moodsOther: draft.moodsOther }} onChange={(next) => store().setDraft({ moods: [...next.moods], moodsOther: [...next.moodsOther] })} disabled={locked} />
                </View>
                <View {...form.field("style")} style={styles.field}>
                  <StyleField theme={theme} kind={kind} value={{ styles: draft.styles, stylesOther: draft.stylesOther }} onChange={(next) => store().setDraft({ styles: [...next.styles], stylesOther: [...next.stylesOther] })} invalid={formError === "style" || !!form.error("style")} errorText={form.error("style")} disabled={locked} />
                </View>
                {kindHasRecordingType(kind) ? (
                  <View {...form.field("recordingType")} style={styles.field}>
                    <RecordingTypeField theme={theme} kind={kind} value={draft.recordingType} onChange={(next) => store().setDraft({ recordingType: next })} invalid={formError === "recordingType" || !!form.error("recordingType")} errorText={form.error("recordingType")} disabled={locked} />
                  </View>
                ) : null}
                {kindHasPerformance(kind) ? (
                  <View {...form.field("performance")} style={styles.field}>
                    <PerformanceField theme={theme} kind={kind} value={draft.performance} onChange={(next) => store().setDraft({ performance: next })} invalid={formError === "performance" || !!form.error("performance")} errorText={form.error("performance")} disabled={locked} />
                  </View>
                ) : null}
                <TempoField theme={theme} kind={kind} value={draft.tempo} onChange={(next) => store().setDraft({ tempo: next })} disabled={locked} />
                <View {...form.field("instrument")} style={styles.field}>
                  <InstrumentField theme={theme} kind={kind} value={{ instrument: draft.leadInstrument, instrumentOther: draft.leadInstrumentOther }} onChange={(next) => store().setDraft({ leadInstrument: next.instrument, leadInstrumentOther: next.instrumentOther })} accepted={instrumentWords.accepted} newWordsPerWeek={instrumentWords.newWordsPerWeek} invalid={formError === "instrument" || !!form.error("instrument")} errorText={form.error("instrument")} disabled={locked} />
                </View>
              </Reveal>
            ) : null}

            {offersVideoLink(kind, items.length) ? (
              <Reveal index={3} style={styles.field}>
                <VideoLinkField theme={theme} value={videoLink} onChange={setVideoLink} disabled={locked} />
              </Reveal>
            ) : null}

            <Reveal index={4} style={styles.field}>
              <View {...form.field("file")} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.files.label")}</Text>
              <KPress
                accessibilityRole="button"
                accessibilityLabel={items.length ? t("rec.files.more") : t("rec.files.choose")}
                onPress={() => void choose()}
                pressedScale={0.98}
                style={[styles.inputBox, { backgroundColor: theme.card, borderColor: formError === "file" || problem === "nothing" ? amColors.danger : theme.line }]}
              >
                <PlayerIcon name="link" size={20} color={theme.textBody} />
                <Text style={[styles.fileName, { color: items.length ? theme.textHeading : theme.textBody }]} numberOfLines={1}>
                  {items.length ? t("rec.files.chosen", { count: items.length }) : t("ugc.add.noFile")}
                </Text>
                <View style={[styles.pasteBtn, { backgroundColor: theme.peach }]}>
                  <Text style={[styles.pasteText, { color: theme.accent }]}>{items.length ? t("rec.files.more") : t("rec.files.choose")}</Text>
                </View>
              </KPress>
              {isWeb
                ? createElement("input", {
                    ref: (node: { click: () => void } | null) => {
                      inputRef.current = node
                    },
                    type: "file",
                    accept: "audio/*",
                    multiple: true,
                    "aria-label": t("rec.files.label"),
                    style: { display: "none" },
                    onChange: (event: { target: { files?: ArrayLike<File> | null; value: string } }) => {
                      onPickedWeb(event.target.files)
                      event.target.value = ""
                    },
                  })
                : null}
              {form.error("file") ? <FieldError theme={theme} text={form.error("file")!} /> : null}
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.add.fileHint", { mb: LIMIT_MB })}</Text>
              </View>
            </Reveal>

            {items.length ? (
              <View style={styles.queue}>
                {running || queueProgress(items) > 0 ? <QueueBar theme={theme} items={items} /> : null}
                {items.length > 1 && (kindHasLanguage(kind) || kindHasDance(kind)) ? (
                  <ApplyToAllCard theme={theme} kind={kind} missing={missing} tried={tried} locked={locked} onLanguage={() => setLangFor("all")} onDance={pickDanceForAll} />
                ) : null}
                {kind === "kiirtan" && items.length > 1 && (practiceSummary.avarta > 0) ? (
                  <Text style={[styles.hint, { color: theme.textBody }]} accessibilityLiveRegion="polite">
                    {practiceSummary.avarta === practiceSummary.total ? t("practice.queue.all") : t("practice.queue.some", { count: practiceSummary.avarta, total: practiceSummary.total })}
                  </Text>
                ) : null}
                {kind === "kiirtan" ? <Text style={[styles.hint, { color: theme.textBody }]}>{t("recinfo.title.hint")}</Text> : null}
                {items.map((item, index) => (
                  <View key={item.id} {...form.field(`row-${item.id}`)} style={styles.rowWrap}>
                  <QueueRow
                    theme={theme}
                    item={item}
                    position={index + 1}
                    kindFields={{ ...effectiveFields(item, defaults), missing: rowMissing(item, defaults), tried }}
                    onRowLanguage={(id) => setLangFor(id)}
                    onRowDance={(id, dance) => store().setRowFields(id, { dance })}
                    practice={kind === "kiirtan" && items.length > 1 ? { on: effectivePractice(item, kind, draft.practice) === AVARTA, onChange: (on) => store().setRowFields(item.id, { practice: on ? AVARTA : null }) } : undefined}
                    titleInvalid={rowWithProblem === item.id}
                    onTitle={(id, title) => store().setTitle(id, title)}
                    onRemove={(id) => store().remove(id)}
                    onRetry={(id) => void store().retry(id)}
                    onHear={(row) => row.original && listenTo(row.original as OriginalRef)}
                    onSimilarYes={(id) => void store().decideSimilar(id, true)}
                    onSimilarNo={sameAsLibrary}
                  />
                  {form.error(`row-${item.id}`) ? <FieldError theme={theme} text={form.error(`row-${item.id}`)!} /> : null}
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.field}>
              <KPress
                accessibilityRole="button"
                accessibilityLabel={t("rec.more.label")}
                accessibilityState={{ expanded: moreOpen }}
                onPress={() => setMoreOpen((was) => !was)}
                pressedScale={0.99}
                style={[styles.moreHead, { borderColor: theme.line, backgroundColor: theme.card }]}
              >
                <View style={styles.moreText}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.more.label")}</Text>
                  {!moreOpen ? <Text style={[styles.hint, { color: theme.textBody }]}>{t(moreDetailsHintKey(kind))}</Text> : null}
                </View>
                <ChevronGlyph color={theme.textBody} open={moreOpen} />
              </KPress>
              {moreOpen ? <MoreDetails theme={theme} kind={kind} locked={locked} yearInvalid={formError === "year"} yearMessage={form.error("year")} languageMessage={form.error("language")} fieldProps={form.field} onOpenLanguage={() => setLangFor("form")} /> : null}
            </View>

            {rulesOk ? (
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.add.termsAgreed", { date: formatDate(rules.acceptedAt ?? "", "medium") })}</Text>
            ) : (
              <View {...form.field("terms")} style={styles.field}>
                <Check theme={theme} on={agree} label={t("ugc.add.terms")} onToggle={() => setAgree((c) => !c)} invalid={formError === "terms"} />
                {form.error("terms") ? <FieldError theme={theme} text={form.error("terms")!} /> : null}
              </View>
            )}
            <KPress accessibilityRole="link" accessibilityLabel={t("ugc.add.readRules")} onPress={openRules} pressedScale={0.98} style={styles.linkRow}>
              <Text style={[styles.linkText, { color: theme.accent }]}>{t("ugc.add.readRules")}</Text>
            </KPress>

            {problemText ? (
              <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
                {problemText}
              </Text>
            ) : null}
            {stopped === "dailyLimit" && !running && !finished ? (
              <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
                {t("rec.q.dailyLimit", { count: left })}
              </Text>
            ) : null}
            {stopped === "signin" && !running ? (
              <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
                {t("ugc.err.signin")}
              </Text>
            ) : null}

            {finished ? <QueueSummaryCard theme={theme} summary={summary} dailyLimit={stopped === "dailyLimit"} retryable={retryable} onRetryAll={() => void store().retryAll()} onAddMore={addMore} onView={viewSubmissions} /> : null}

            {/* the last thing before the send button: what moderation means for a poor recording */}
            {allDone ? null : <ModerationNotice kind="recording" />}
            <KPress
              accessibilityRole="button"
              accessibilityLabel={buttonLabel}
              accessibilityState={{ disabled: running, busy: running }}
              onPress={() => (allDone ? close() : void upload())}
              disabled={running}
              pressedScale={0.98}
              style={[styles.send, { backgroundColor: amColors.orange700, opacity: running ? 0.6 : 1 }]}
            >
              <Text style={styles.sendText}>{buttonLabel}</Text>
            </KPress>
            <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>{t("ugc.add.footer")}</Text>
          </>
        )}
      </ScrollView>
      <PsSongChooser
        visible={chooser}
        selected={draft.psSong?.number ?? null}
        onClose={() => setChooser(false)}
        onPick={(song) => {
          store().setDraft({ psSong: song })
          setChooser(false)
          setProblem(null)
        }}
      />
      <LanguagePicker visible={langFor !== null} value={pickerValue} allowClear={!kindRequiresLanguage(kind)} onPick={pickLanguage} onClose={() => setLangFor(null)} />
      <Toast message={actions.toast} theme={theme} />
    </KeyboardAvoidingView>
  )
}

/**
 * Language (Prabhat Samgiita and Dance music: optional; Bhajan and Spiritual song ask for it above as required; never Kiirtan), "words and music by" (Bhajan), year recorded and a short note.
 * All optional. Which fields a type has is lib/kirtan/uploadForm.ts moreDetailsFor.
 */
function MoreDetails({ theme, kind, locked, yearInvalid, yearMessage, languageMessage, fieldProps, onOpenLanguage }: { theme: SongsTheme; kind: RecordingKind; locked: boolean; yearInvalid: boolean; yearMessage: string | null; languageMessage: string | null; fieldProps: (key: string) => object; onOpenLanguage: () => void }) {
  const t = useT()
  const draft = useUploadQueueStore((s) => s.draft)
  const setDraft = useUploadQueueStore.getState().setDraft
  const has = moreDetailsFor(kind)
  return (
    <View style={styles.moreBody}>
      {/* a Bhajan and a Spiritual song ask for their language above, as a required field; the optional ones keep it here */}
      {has.language ? (
        <View {...fieldProps("language")}>
          <LanguageField theme={theme} kind={kind} value={{ language: draft.language, languageOther: draft.languageOther }} onOpen={onOpenLanguage} errorText={languageMessage} invalid={!!languageMessage} disabled={locked} />
        </View>
      ) : null}
      {has.place ? (
        <>
          <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.place.label")}</Text>
          <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: controlBorder(theme) }]}>
            <TextInput value={draft.place} onChangeText={(text) => setDraft({ place: fixKiirtanSpelling(text) })} onBlur={() => setDraft({ place: fixKiirtanSpelling(draft.place) })} editable={!locked} placeholder={t("rec.place.placeholder")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("rec.place.label")} maxLength={200} style={[styles.input, { color: theme.textHeading }]} />
          </View>
        </>
      ) : null}
      {has.discourse ? (
        <>
          <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.discourse.label")}</Text>
          <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: controlBorder(theme) }]}>
            <TextInput value={draft.discourse} onChangeText={(text) => setDraft({ discourse: text })} editable={!locked} placeholder={t("rec.discourse.placeholder")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("rec.discourse.label")} maxLength={200} style={[styles.input, { color: theme.textHeading }]} />
          </View>
        </>
      ) : null}
      {has.credits ? (
        <>
          <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.credits.label")}</Text>
          <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: controlBorder(theme) }]}>
            <TextInput value={draft.credits} onChangeText={(text) => setDraft({ credits: text })} editable={!locked} placeholder={t("rec.credits.placeholder")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("rec.credits.label")} maxLength={300} style={[styles.input, { color: theme.textHeading }]} />
          </View>
        </>
      ) : null}
      <View {...fieldProps("year")} style={styles.moreBody}>
        <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.year.label")}</Text>
        <View style={[styles.inputBox, styles.yearBox, { backgroundColor: theme.card, borderColor: yearInvalid ? amColors.danger : theme.line }]}>
          <TextInput value={draft.year} onChangeText={(text) => setDraft({ year: text.replace(/[^0-9]/g, "").slice(0, 4) })} editable={!locked} placeholder={t("rec.year.placeholder")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("rec.year.label")} keyboardType="number-pad" maxLength={4} style={[styles.input, { color: theme.textHeading }]} />
        </View>
        <FieldError theme={theme} text={yearMessage} />
      </View>
      <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.notes.label")}</Text>
      <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: controlBorder(theme), alignItems: "flex-start" }]}>
        <TextInput value={draft.notes} onChangeText={(text) => setDraft({ notes: text })} editable={!locked} placeholder={t("rec.notes.placeholder")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("rec.notes.label")} maxLength={200} multiline style={[styles.input, styles.notes, { color: theme.textHeading }]} />
      </View>
    </View>
  )
}

function Check({ theme, on, label, onToggle, invalid }: { theme: SongsTheme; on: boolean; label: string; onToggle: () => void; invalid?: boolean }) {
  return (
    <KPress accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onActivate={onToggle} pressedScale={0.99} style={styles.confirm}>
      <View style={[styles.box, { borderColor: on ? amColors.orange700 : invalid ? amColors.danger : theme.textBody, backgroundColor: on ? amColors.orange700 : "transparent" }]}>
        {on ? <PlayerIcon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} /> : null}
      </View>
      <Text style={[styles.confirmText, { color: theme.textHeading }]}>{label}</Text>
    </KPress>
  )
}

function SignInGate({ theme, onSignIn }: { theme: SongsTheme; onSignIn: () => void }) {
  const t = useT()
  return (
    <Reveal index={0} style={styles.sent}>
      <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
        {t("ugc.signin.title")}
      </Text>
      <Text style={[styles.hint, { color: theme.textBody, fontSize: 15, lineHeight: 21 }]}>{t("ugc.signin.body")}</Text>
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.signin.action")} onPress={onSignIn} pressedScale={0.98} outerStyle={styles.full} style={[styles.send, { backgroundColor: amColors.orange700 }]}>
        <Text style={styles.sendText}>{t("ugc.signin.action")}</Text>
      </KPress>
    </Reveal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 24, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  field: { gap: 8 },
  /** the playlist card and its "My event playlists" link: 16 apart, the link does not stick to the card */
  setStack: { gap: 16 },
  /** a field and the tick that belongs to it (performer and "I am the author") */
  pair: { gap: 16 },
  /** fields of one group of the form (style, how it sounds, instrument): 24 apart, so no two fields touch */
  group: { gap: 24 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  inputBox: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  yearBox: { width: 140 },
  fileName: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  notes: { minHeight: 80, textAlignVertical: "top" },
  pasteBtn: { height: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pasteText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  queue: { gap: 12 },
  setEntry: { minHeight: 72, borderRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  setEntryTitle: { fontFamily: amFonts.display, fontSize: 19, lineHeight: 22, letterSpacing: -0.2, textTransform: "uppercase" },
  rowWrap: { gap: 6 },
  moreHead: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  moreText: { flex: 1, minWidth: 0, gap: 2 },
  moreBody: { gap: 12, paddingTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  confirm: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 4 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  confirmText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  linkRow: { alignSelf: "flex-start", paddingVertical: 2 },
  linkText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20, textDecorationLine: "underline" },
  send: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  sendText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  sent: { alignItems: "stretch", gap: 24, paddingTop: 12 },
  full: { alignSelf: "stretch" },
})
