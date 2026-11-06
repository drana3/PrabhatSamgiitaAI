import { createElement, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import * as DocumentPicker from "expo-document-picker"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import { PsSongChooser } from "@/components/kirtan/add/PsSongChooser"
import { QueueBar, QueueRow, QueueSummaryCard } from "@/components/kirtan/add/QueueRows"
import { KPress } from "@/components/kirtan/KPress"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { formatDate, useT } from "@/lib/i18n"
import { kindHasCredits, kindLabel, normalizeKind } from "@/lib/kirtan/kind"
import { playableOriginal, type OriginalRef } from "@/lib/kirtan/original"
import { hasWork, isRetryable, leftForTomorrow, queueCounts, queueProgress, queueSummary, type PickedFile, type QueueItem } from "@/lib/kirtan/queue"
import type { RemoteBrief } from "@/lib/kirtan/remote"
import { fileProblemText, isRulesAccepted, MAX_UPLOAD_BYTES } from "@/lib/kirtan/rules"
import { validateSubmission, type SubmissionError } from "@/lib/kirtan/submissions"
import { RECORDING_KINDS, RECORDING_LANGUAGES, type RecordingKind } from "@/lib/kirtan/types"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
import { useContentRulesStore } from "@/stores/contentRulesStore"
import { useUploadQueueStore, yearOf, type QueueDraft } from "@/stores/uploadQueueStore"
import { href } from "@/utils/href"

const CloseGlyph = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
  </Svg>
)

const ChevronGlyph = ({ color, open }: { color: string; open: boolean }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)

const LIMIT_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))

/** What is wrong with the form, shown under the button. `row` names the file when it is one row's title. */
type Problem = { form: SubmissionError; row?: string } | "picker" | "nothing"

/**
 * Add recordings: the one form for everything people upload (docs/kiirtan-publishing.md). The person picks the TYPE
 * (Kiirtan, Bhajan, Devotional song or Prabhat Samgiita), names the performer, picks one or many audio files and gives
 * each its title; the choices at the top apply to every file. Upload runs the files one after another, shows each one's
 * state and ends with a summary. Nothing waits for a reviewer: a recording is live the moment its upload succeeds, the
 * team looks afterwards and may remove it with a notice that says why. Only a signed-in person can upload.
 *
 * The queue lives in stores/uploadQueueStore, so leaving this screen does not stop it and coming back shows where it is.
 * The file picker is an `<input type=file multiple accept="audio/*">` in the web preview and the system document picker
 * (expo-document-picker, audio only, several files) on a phone.
 */
export default function AddKirtanScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = Platform.OS === "web" ? 24 : Math.max(insets.top, 16)
  const isWeb = Platform.OS === "web"
  // "Upload a corrected version" opens this screen with the removed recording's words already in.
  const params = useLocalSearchParams<{ kind?: string; title?: string; author?: string; song?: string }>()
  const actions = useKirtanActions()

  const signedIn = useAuthStore((s) => s.mode === "signed_in") || MOCKUP_DATA
  const displayName = useAuthStore((s) => s.displayName)
  const acceptedAt = useContentRulesStore((s) => s.acceptedAt)
  const acceptedVersion = useContentRulesStore((s) => s.version)
  const rules = useMemo(() => ({ acceptedAt, version: acceptedVersion }), [acceptedAt, acceptedVersion])
  const rulesOk = isRulesAccepted(rules)

  const draft = useUploadQueueStore((s) => s.draft)
  const items = useUploadQueueStore((s) => s.items)
  const running = useUploadQueueStore((s) => s.running)
  const stopped = useUploadQueueStore((s) => s.stopped)
  const store = useUploadQueueStore.getState

  const [agree, setAgree] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [chooser, setChooser] = useState(false)
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

  const locked = running
  const counts = queueCounts(items)
  const retryable = items.filter(isRetryable).length
  const finished = !running && counts.total > 0 && !hasWork(items)
  const summary = queueSummary(items)
  const kind = draft.kind

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

  /* ------------------------------------------------------------------ starting */

  const upload = async () => {
    if (running) return
    setProblem(null)
    const open = items.filter((item) => item.status === "waiting" || item.status === "limit")
    if (!open.length) {
      if (!items.length) setProblem("nothing")
      return
    }
    const first = open[0] as QueueItem
    const form = validateSubmission({
      kind,
      author: draft.performer,
      psSong: draft.psSong?.number ?? null,
      year: yearOf(draft.year),
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
    if (form && form !== "year") {
      setProblem({ form })
      return
    }
    if (draft.year.trim() && yearOf(draft.year) == null) {
      setProblem({ form: "year" })
      return
    }
    if (form === "year") {
      setProblem({ form })
      return
    }
    const untitled = open.find((item) => !item.title.trim())
    if (untitled) {
      setProblem({ form: "title", row: untitled.id })
      return
    }
    if (!rulesOk) useContentRulesStore.getState().accept()
    await store().start()
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))
  const viewSubmissions = () => router.replace(href("/v2/kiirtan?filter=mine"))
  const openRules = () => router.push(href("/content-rules"))
  const addMore = () => {
    store().clearFinished()
    setProblem(null)
  }

  const formError = problem && typeof problem === "object" ? problem.form : null
  const problemText =
    problem === "picker"
      ? t("ugc.add.pickFailed")
      : problem === "nothing"
        ? t("ugc.form.error.file")
        : formError === "format" || formError === "size"
          ? fileProblemText(formError)
          : formError
            ? t(`ugc.form.error.${formError}`)
            : null
  const rowWithProblem = problem && typeof problem === "object" ? problem.row : undefined
  const left = leftForTomorrow(items)
  const settled = counts.total - counts.waiting - counts.uploading
  const open = counts.waiting + counts.limit
  const buttonLabel = running ? t("rec.q.uploadingOf", { done: settled, total: counts.total }) : open > 0 ? t("rec.q.uploadN", { count: open }) : t("rec.q.upload")

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.root, { backgroundColor: theme.page }]}>
      <View style={[styles.bar, { paddingTop: top }]}>
        <View style={[styles.handle, { backgroundColor: theme.dark ? "rgba(255,255,255,0.22)" : amColors.sand400 }]} />
        <KPress accessibilityRole="button" accessibilityLabel={t("ugc.add.close")} onPress={close} pressedScale={0.9} outerStyle={styles.close} style={[styles.closeDisc, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <CloseGlyph color={theme.textHeading} />
        </KPress>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
        {!signedIn ? (
          <SignInGate theme={theme} onSignIn={() => router.push(href("/signin"))} />
        ) : (
          <>
            <Reveal index={0}>
              <Text style={[styles.over, { color: theme.accent }]}>{t("ugc.add.over")}</Text>
              <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
                {t("ugc.add.heading")}
                {"\n"}
                <Text style={{ color: theme.ink300 }}>{kindLabel(kind)}</Text>
              </Text>
            </Reveal>

            <Reveal index={1} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.type.label")}</Text>
              <View style={styles.kinds} accessibilityRole="radiogroup">
                {RECORDING_KINDS.map((k) => {
                  const on = k === kind
                  const blurb = t(`ugc.add.blurb.${k}`)
                  return (
                    <KPress
                      key={k}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, disabled: locked }}
                      accessibilityLabel={`${kindLabel(k)}. ${blurb}`}
                      onActivate={() => {
                        if (locked) return
                        store().setDraft({ kind: k, ...(k === "prabhat_samgiita" ? {} : { psSong: null }) })
                        setProblem(null)
                      }}
                      pressedScale={0.97}
                      outerStyle={styles.kindOuter}
                      style={[styles.kindCard, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : theme.line, opacity: locked && !on ? 0.5 : 1 }]}
                    >
                      <Text style={[styles.kindName, { color: on ? theme.onInk : theme.textHeading }]} numberOfLines={2}>
                        {kindLabel(k)}
                      </Text>
                      <Text style={[styles.kindBlurb, { color: on ? theme.onInk : theme.textBody }]}>{blurb}</Text>
                    </KPress>
                  )
                })}
              </View>
            </Reveal>

            {kind === "prabhat_samgiita" ? (
              <Reveal index={2} style={styles.field}>
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
                <Text style={[styles.hint, { color: theme.textBody }]}>{t("rec.song.hint")}</Text>
              </Reveal>
            ) : null}

            <Reveal index={3} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>{t("ugc.add.authorLabel")}</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: formError === "author" ? amColors.danger : theme.line }]}>
                <TextInput
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
              {items.length > 1 ? <Text style={[styles.hint, { color: theme.textBody }]}>{t("rec.shared.hint")}</Text> : null}
            </Reveal>

            <Reveal index={4} style={styles.field}>
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
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.add.fileHint", { mb: LIMIT_MB })}</Text>
            </Reveal>

            {items.length ? (
              <View style={styles.queue}>
                {running || queueProgress(items) > 0 ? <QueueBar theme={theme} items={items} /> : null}
                {items.map((item, index) => (
                  <QueueRow
                    key={item.id}
                    theme={theme}
                    item={item}
                    position={index + 1}
                    titleInvalid={rowWithProblem === item.id}
                    onTitle={(id, title) => store().setTitle(id, title)}
                    onRemove={(id) => store().remove(id)}
                    onRetry={(id) => void store().retry(id)}
                    onHear={(row) => row.original && listenTo(row.original as OriginalRef)}
                    onSimilarYes={(id) => void store().decideSimilar(id, true)}
                    onSimilarNo={(id) => void store().decideSimilar(id, false)}
                    onPlaySimilar={(s: RemoteBrief) => listenTo({ id: s.id, title: s.title, author: s.author, audioUrl: s.audio_url, kind: s.kind })}
                  />
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
                  {!moreOpen ? <Text style={[styles.hint, { color: theme.textBody }]}>{t("rec.more.hint")}</Text> : null}
                </View>
                <ChevronGlyph color={theme.textBody} open={moreOpen} />
              </KPress>
              {moreOpen ? <MoreDetails theme={theme} kind={kind} locked={locked} yearInvalid={formError === "year"} /> : null}
            </View>

            <Check theme={theme} on={draft.byAuthor} label={t("ugc.add.byAuthor")} onToggle={() => !locked && store().setDraft({ byAuthor: !store().draft.byAuthor })} />
            {rulesOk ? (
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.add.termsAgreed", { date: formatDate(rules.acceptedAt ?? "", "medium") })}</Text>
            ) : (
              <Check theme={theme} on={agree} label={t("ugc.add.terms")} onToggle={() => setAgree((c) => !c)} invalid={formError === "terms"} />
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

            <KPress
              accessibilityRole="button"
              accessibilityLabel={buttonLabel}
              accessibilityState={{ disabled: running, busy: running }}
              onPress={() => void upload()}
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
      <Toast message={actions.toast} theme={theme} />
    </KeyboardAvoidingView>
  )
}

/** Language, "words and music by" (Bhajan and Devotional song), year recorded and a short note. All optional. */
function MoreDetails({ theme, kind, locked, yearInvalid }: { theme: SongsTheme; kind: RecordingKind; locked: boolean; yearInvalid: boolean }) {
  const t = useT()
  const draft = useUploadQueueStore((s) => s.draft)
  const setDraft = useUploadQueueStore.getState().setDraft
  return (
    <View style={styles.moreBody}>
      <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.language.label")}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {RECORDING_LANGUAGES.map((language) => {
          const on = draft.language === language
          return (
            <KPress
              key={language}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t(`rec.language.${language}`)}
              onActivate={() => !locked && setDraft({ language: on ? null : language })}
              pressedScale={0.96}
              style={[styles.chip, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : theme.line }]}
            >
              <Text style={[styles.chipText, { color: on ? theme.onInk : theme.textHeading }]}>{t(`rec.language.${language}`)}</Text>
            </KPress>
          )
        })}
      </View>
      {kindHasCredits(kind) ? (
        <>
          <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.credits.label")}</Text>
          <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <TextInput value={draft.credits} onChangeText={(text) => setDraft({ credits: text })} editable={!locked} placeholder={t("rec.credits.placeholder")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("rec.credits.label")} maxLength={300} style={[styles.input, { color: theme.textHeading }]} />
          </View>
        </>
      ) : null}
      <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.year.label")}</Text>
      <View style={[styles.inputBox, styles.yearBox, { backgroundColor: theme.card, borderColor: yearInvalid ? amColors.danger : theme.line }]}>
        <TextInput value={draft.year} onChangeText={(text) => setDraft({ year: text.replace(/[^0-9]/g, "").slice(0, 4) })} editable={!locked} placeholder={t("rec.year.placeholder")} placeholderTextColor={theme.textMuted} accessibilityLabel={t("rec.year.label")} keyboardType="number-pad" maxLength={4} style={[styles.input, { color: theme.textHeading }]} />
      </View>
      <Text style={[styles.label, { color: theme.textHeading }]}>{t("rec.notes.label")}</Text>
      <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.line, alignItems: "flex-start" }]}>
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
  bar: { alignItems: "center", paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, marginTop: 4 },
  close: { position: "absolute", right: 16, top: Platform.OS === "web" ? 18 : undefined },
  closeDisc: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 24, gap: 22, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 45, lineHeight: 45, letterSpacing: -0.9, textTransform: "uppercase" },
  field: { gap: 10 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  inputBox: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingLeft: 16, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  yearBox: { width: 140 },
  fileName: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  notes: { minHeight: 80, textAlignVertical: "top" },
  pasteBtn: { height: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pasteText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kindOuter: { width: "48%", flexGrow: 1 },
  kindCard: { flex: 1, minHeight: 88, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, justifyContent: "center", gap: 2 },
  kindName: { fontFamily: amFonts.display, fontSize: 21, lineHeight: 23, letterSpacing: -0.3, textTransform: "uppercase" },
  kindBlurb: { fontFamily: amFonts.medium, fontSize: 12, lineHeight: 16 },
  queue: { gap: 10 },
  moreHead: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  moreText: { flex: 1, minWidth: 0, gap: 2 },
  moreBody: { gap: 10, paddingTop: 4 },
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
  sent: { alignItems: "stretch", gap: 20, paddingTop: 12 },
  full: { alignSelf: "stretch" },
})
