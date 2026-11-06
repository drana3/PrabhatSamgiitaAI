import { createElement, useEffect, useMemo, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import * as DocumentPicker from "expo-document-picker"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Svg, { Path } from "react-native-svg"

import { KirtanTag, PlusGlyph } from "@/components/kirtan/KirtanParts"
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
import { kindLabel, normalizeKind } from "@/lib/kirtan/kind"
import { cleanMantra, mantraKey, versionsOfThisLabel, versionsLabel, type MantraSummary } from "@/lib/kirtan/mantras"
import { suggestMantraTitles, versionsOfMantra } from "@/lib/kirtan/mantraSource"
import { playableOriginal, type OriginalRef } from "@/lib/kirtan/original"
import type { RemoteBrief } from "@/lib/kirtan/remote"
import { fileProblemText, isRulesAccepted, MAX_UPLOAD_BYTES, uploadErrorText } from "@/lib/kirtan/rules"
import { validateSubmission, type SubmissionError } from "@/lib/kirtan/submissions"
import { RECORDING_KINDS, type Kirtan, type RecordingKind, type UploadFailure } from "@/lib/kirtan/types"
import { cancelSimilar, runUpload } from "@/lib/kirtan/uploadRunner"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
import { useContentRulesStore } from "@/stores/contentRulesStore"
import { useKirtanStore } from "@/stores/kirtanStore"
import { href } from "@/utils/href"

const CloseGlyph = ({ color }: { color: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
  </Svg>
)

type PickedFile = { name: string; uri: string; size: number | null; type: string | null }

const LIMIT_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))
/** Suggestions stay for a moment after the field loses focus, so a tap on one is not lost to the blur. */
const BLUR_DELAY_MS = 150
/** The mantra field asks the library after the person stops typing. */
const MANTRA_DEBOUNCE_MS = 250

/** What the person sees under the form when something is wrong. */
type Problem = { form: SubmissionError } | { upload: UploadFailure } | "running" | "picker"

/** The server said it sounds like a recording already in the library; the author decides whether theirs is a different performance. */
type SimilarAsk = { id: string; key: string; similar: RemoteBrief[] }

/**
 * Add Kiirtan or Bhajan: the author says what it is (Kiirtan or Bhajan), uploads an audio file, names it, says who sings,
 * ticks whether they are the author or perform it themselves, agrees to the content rules (the first time, and again when
 * the rules change) and PUBLISHES. Nothing waits for a reviewer: the recording is live in the app the moment the upload
 * succeeds, the team looks afterwards and may remove it with a notice that says why (docs/kiirtan-publishing.md).
 * Only a signed-in person can upload. The same file twice is refused by the server, a similar one only asks first.
 * The file picker is an `<input type=file accept="audio/*">` in the web preview and the system document picker
 * (expo-document-picker, audio files only) on a phone.
 */
export default function AddKirtanScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const top = Platform.OS === "web" ? 24 : Math.max(insets.top, 16)
  const isWeb = Platform.OS === "web"
  // "Upload a corrected version" opens this screen with the removed recording's words already in.
  const params = useLocalSearchParams<{ kind?: string; title?: string; author?: string; mantra?: string }>()
  const actions = useKirtanActions()

  const signedIn = useAuthStore((s) => s.mode === "signed_in") || MOCKUP_DATA
  const acceptedAt = useContentRulesStore((s) => s.acceptedAt)
  const acceptedVersion = useContentRulesStore((s) => s.version)
  const rules = useMemo(() => ({ acceptedAt, version: acceptedVersion }), [acceptedAt, acceptedVersion])
  const rulesOk = isRulesAccepted(rules)

  const [kind, setKind] = useState<RecordingKind>(normalizeKind(params.kind))
  const [file, setFile] = useState<PickedFile | null>(null)
  const [title, setTitle] = useState(typeof params.title === "string" ? params.title : "")
  const [author, setAuthor] = useState(typeof params.author === "string" ? params.author : "")
  const [mantra, setMantra] = useState(typeof params.mantra === "string" ? params.mantra : "")
  const [suggestions, setSuggestions] = useState<MantraSummary[]>([])
  const [versions, setVersions] = useState<{ mantra: MantraSummary | null; count: number } | null>(null)
  const [mantraCheckFailed, setMantraCheckFailed] = useState(false)
  const [byAuthor, setByAuthor] = useState(false)
  const [agree, setAgree] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [busy, setBusy] = useState(false)
  const [similar, setSimilar] = useState<SimilarAsk | null>(null)
  const [sent, setSent] = useState<{ kirtan: Kirtan; local: boolean } | null>(null)
  const [focus, setFocus] = useState<"title" | "mantra" | "author" | null>(null)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<{ click: () => void } | null>(null)
  const alive = useRef(true)
  useEffect(() => () => {
    alive.current = false
    if (blurTimer.current) clearTimeout(blurTimer.current)
  }, [])

  // The mantra field asks the library: which mantras look like this, and how many versions of this one exist.
  useEffect(() => {
    if (!signedIn) return
    const typed = cleanMantra(mantra)
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const [listed, found] = await Promise.all([suggestMantraTitles(typed, kind), versionsOfMantra(typed, kind)])
        if (cancelled) return
        setSuggestions(listed)
        setVersions(typed ? { mantra: found.mantra, count: found.versions } : null)
        setMantraCheckFailed(false)
      } catch {
        if (cancelled) return
        setSuggestions([])
        setVersions(null)
        setMantraCheckFailed(true)
      }
    }, MANTRA_DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mantra, kind, signedIn])

  const focusField = (field: "title" | "mantra" | "author") => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setFocus(field)
  }
  const blurField = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    blurTimer.current = setTimeout(() => setFocus(null), BLUR_DELAY_MS)
  }
  const pickMantra = (title: string) => {
    setMantra(title)
    setSuggestions([])
    setFocus(null)
  }

  /** Plays the recording the server pointed at, if the app can reach its audio. */
  const listenTo = (ref: OriginalRef) => {
    const playable = playableOriginal(ref)
    if (!playable) {
      actions.flash(t("ugc.dup.cantPlay"))
      return
    }
    actions.open(playable, [playable])
  }

  const acceptFile = (next: PickedFile) => {
    setFile(next)
    setProblem(null)
    // A good first title: the file name without its extension.
    if (!title.trim()) setTitle(next.name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[-_]+/g, " ").trim())
  }
  const choose = async () => {
    if (isWeb) {
      inputRef.current?.click()
      return
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", multiple: false, copyToCacheDirectory: true })
      if (result.canceled) return
      const asset = result.assets[0]
      if (!asset || !alive.current) return
      acceptFile({ name: asset.name, uri: asset.uri, size: typeof asset.size === "number" ? asset.size : null, type: asset.mimeType ?? null })
    } catch {
      if (alive.current) setProblem("picker")
    }
  }
  const onPicked = (picked: ({ name: string; type?: string; size?: number } & Blob) | null) => {
    if (!picked) return
    const uri = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(picked) : ""
    acceptFile({ name: picked.name, uri, size: typeof picked.size === "number" ? picked.size : null, type: picked.type || null })
  }

  /** Sends the stored submission to the server and shows what came of it. */
  const finish = async (item: Kirtan, options: { confirmDifferent?: boolean; key?: string } = {}) => {
    setBusy(true)
    setProblem(null)
    setSimilar(null)
    const outcome = await runUpload(item.id, options)
    if (!alive.current) return
    setBusy(false)
    const store = useKirtanStore.getState()
    if (outcome.status === "published" || outcome.status === "local") {
      const live = useKirtanStore.getState().submissions.find((k) => k.id === item.id) ?? item
      setSent({ kirtan: live, local: outcome.status === "local" })
    } else if (outcome.status === "similar") {
      setSimilar({ id: item.id, key: outcome.key, similar: outcome.similar })
    } else {
      // The form keeps what was typed; the failed attempt does not stay in the list. A person can send again.
      store.withdraw(item.id)
      setProblem({ upload: outcome.failure })
    }
  }

  const send = async () => {
    if (busy) return
    const input = {
      kind,
      fileName: file?.name ?? null,
      fileUri: file?.uri ?? null,
      fileSize: file?.size ?? null,
      fileType: file?.type ?? null,
      title,
      author,
      mantra: cleanMantra(mantra),
      byAuthor,
      addedBy: "You",
      termsAccepted: rulesOk || agree,
    }
    const found = validateSubmission(input)
    if (found) {
      setProblem({ form: found })
      return
    }
    if (!rulesOk) useContentRulesStore.getState().accept()
    const result = useKirtanStore.getState().submit(input)
    if (!result.added) {
      setProblem("running")
      return
    }
    await finish(result.added)
  }

  const answerSimilar = (different: boolean) => {
    if (!similar) return
    const item = useKirtanStore.getState().submissions.find((k) => k.id === similar.id)
    if (different && item) {
      void finish(item, { confirmDifferent: true, key: similar.key })
      return
    }
    // "Cancel": the file that already reached the server is deleted, and the form keeps what was typed.
    void cancelSimilar(similar.key)
    useKirtanStore.getState().withdraw(similar.id)
    setSimilar(null)
  }

  const chooseKind = (next: RecordingKind) => {
    setKind(next)
    setProblem(null)
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/v2/kiirtan")))
  const viewSubmissions = () => router.replace(href("/v2/kiirtan?filter=mine"))
  const openRules = () => router.push(href("/content-rules"))
  const another = () => {
    setSent(null)
    setFile(null)
    setTitle("")
    setAuthor("")
    setMantra("")
    setVersions(null)
    setByAuthor(false)
    setProblem(null)
  }

  const formProblem = problem && typeof problem === "object" && "form" in problem ? problem.form : null
  const problemText =
    problem === "running"
      ? t("ugc.form.error.running")
      : problem === "picker"
        ? t("ugc.add.pickFailed")
        : problem && "upload" in problem
        ? uploadErrorText(problem.upload)
        : formProblem === "format" || formProblem === "size"
          ? fileProblemText(formProblem)
          : formProblem
            ? t(`ugc.form.error.${formProblem}`)
            : null
  // "This file is already in the library" (or "you already added this"): a card with the recording and a way to hear it.
  const original =
    problem && typeof problem === "object" && "upload" in problem && problem.upload.original && (problem.upload.code === "duplicate" || problem.upload.code === "ownDuplicate")
      ? { ref: problem.upload.original as OriginalRef, own: problem.upload.code === "ownDuplicate" }
      : null
  const fileBad = formProblem === "file" || formProblem === "format" || formProblem === "size"

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.root, { backgroundColor: theme.page }]}>
      <View style={[styles.bar, { paddingTop: top }]}>
        <View style={[styles.handle, { backgroundColor: theme.dark ? "rgba(255,255,255,0.22)" : amColors.sand400 }]} />
        <KPress accessibilityRole="button" accessibilityLabel={t("ugc.add.close")} onPress={close} pressedScale={0.9} outerStyle={styles.close} style={[styles.closeDisc, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <CloseGlyph color={theme.textHeading} />
        </KPress>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
        {sent ? (
          <Sent theme={theme} kirtan={sent.kirtan} local={sent.local} onView={viewSubmissions} onAnother={another} />
        ) : !signedIn ? (
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
              <Text style={[styles.label, { color: theme.textHeading }]}>{t("ugc.add.what")}</Text>
              <View style={styles.kinds} accessibilityRole="radiogroup">
                {RECORDING_KINDS.map((k) => {
                  const on = k === kind
                  const blurb = t(`ugc.add.blurb.${k}`)
                  return (
                    <KPress
                      key={k}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${kindLabel(k)}. ${blurb}`}
                      onActivate={() => chooseKind(k)}
                      pressedScale={0.97}
                      outerStyle={styles.kindOuter}
                      style={[styles.kindCard, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : theme.line }]}
                    >
                      <Text style={[styles.kindName, { color: on ? theme.onInk : theme.textHeading }]}>{kindLabel(k)}</Text>
                      <Text style={[styles.kindBlurb, { color: on ? theme.onInk : theme.textBody }]}>{blurb}</Text>
                    </KPress>
                  )
                })}
              </View>
            </Reveal>

            <Reveal index={2} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>{t("ugc.add.file")}</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: fileBad ? amColors.danger : theme.line }]}>
                <PlayerIcon name="link" size={20} color={theme.textBody} />
                <Text style={[styles.fileName, { color: file ? theme.textHeading : theme.textBody }]} numberOfLines={1}>
                  {file ? file.name : t("ugc.add.noFile")}
                </Text>
                <KPress
                  accessibilityRole="button"
                  accessibilityLabel={t("ugc.add.choose")}
                  onPress={() => void choose()}
                  pressedScale={0.94}
                  style={[styles.pasteBtn, { backgroundColor: theme.peach }]}
                >
                  <Text style={[styles.pasteText, { color: theme.accent }]}>{file ? t("ugc.add.change") : t("ugc.add.choose")}</Text>
                </KPress>
              </View>
              {isWeb
                ? createElement("input", {
                    ref: (node: { click: () => void } | null) => {
                      inputRef.current = node
                    },
                    type: "file",
                    accept: "audio/*",
                    "aria-label": t("ugc.add.file"),
                    style: { display: "none" },
                    onChange: (event: { target: { files?: ArrayLike<File> | null; value: string } }) => {
                      onPicked(event.target.files?.[0] ?? null)
                      event.target.value = ""
                    },
                  })
                : null}
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.add.fileHint", { mb: LIMIT_MB })}</Text>
            </Reveal>

            <Reveal index={3} style={styles.field}>
              <Text style={[styles.label, { color: theme.textHeading }]}>{t("ugc.add.titleLabel")}</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: focus === "title" ? theme.brand : formProblem === "title" ? amColors.danger : theme.line }]}>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  onFocus={() => focusField("title")}
                  onBlur={blurField}
                  placeholder={t("ugc.add.titlePlaceholder", { kind: kindLabel(kind) })}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("ugc.add.titleLabel")}
                  maxLength={120}
                  style={[styles.input, { color: theme.textHeading }]}
                />
              </View>
              <Text style={[styles.label, { color: theme.textHeading, marginTop: 6 }]}>{t("ugc.mantra.label")}</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: focus === "mantra" ? theme.brand : theme.line }]}>
                <TextInput
                  value={mantra}
                  onChangeText={setMantra}
                  onFocus={() => focusField("mantra")}
                  onBlur={blurField}
                  placeholder={t("ugc.mantra.placeholder")}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("ugc.mantra.label")}
                  maxLength={200}
                  style={[styles.input, { color: theme.textHeading }]}
                />
              </View>
              <MantraHelp
                theme={theme}
                typed={cleanMantra(mantra)}
                focused={focus === "mantra"}
                suggestions={suggestions}
                versions={versions}
                checkFailed={mantraCheckFailed}
                onPick={pickMantra}
                onSeeAll={(id) => router.push(href(`/kirtan-mantra?id=${encodeURIComponent(id)}`))}
              />
              <Text style={[styles.label, { color: theme.textHeading, marginTop: 6 }]}>{t("ugc.add.authorLabel")}</Text>
              <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: focus === "author" ? theme.brand : formProblem === "author" ? amColors.danger : theme.line }]}>
                <TextInput
                  value={author}
                  onChangeText={setAuthor}
                  onFocus={() => focusField("author")}
                  onBlur={blurField}
                  placeholder={t("ugc.add.authorPlaceholder")}
                  placeholderTextColor={theme.textMuted}
                  accessibilityLabel={t("ugc.add.authorLabel")}
                  maxLength={80}
                  style={[styles.input, { color: theme.textHeading }]}
                />
              </View>
            </Reveal>

            <Check theme={theme} on={byAuthor} label={t("ugc.add.byAuthor")} onToggle={() => setByAuthor((c) => !c)} />
            {rulesOk ? (
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.add.termsAgreed", { date: formatDate(rules.acceptedAt ?? "", "medium") })}</Text>
            ) : (
              <Check theme={theme} on={agree} label={t("ugc.add.terms")} onToggle={() => setAgree((c) => !c)} invalid={formProblem === "terms"} />
            )}
            <KPress accessibilityRole="link" accessibilityLabel={t("ugc.add.readRules")} onPress={openRules} pressedScale={0.98} style={styles.linkRow}>
              <Text style={[styles.linkText, { color: theme.accent }]}>{t("ugc.add.readRules")}</Text>
            </KPress>

            {similar ? (
              <SimilarCard
                theme={theme}
                similar={similar.similar}
                onPlay={(s) => listenTo({ id: s.id, title: s.title, author: s.author, audioUrl: s.audio_url, kind: s.kind })}
                onYes={() => answerSimilar(true)}
                onNo={() => answerSimilar(false)}
              />
            ) : null}

            {original ? (
              <ExistingCard
                theme={theme}
                own={original.own}
                original={original.ref}
                onPlay={() => listenTo(original.ref)}
                onAnother={() => {
                  setFile(null)
                  setProblem(null)
                }}
              />
            ) : problemText ? (
              <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
                {problemText}
              </Text>
            ) : null}

            <KPress
              accessibilityRole="button"
              accessibilityLabel={t("ugc.add.publish")}
              accessibilityState={{ disabled: busy || similar != null, busy }}
              onPress={() => void send()}
              disabled={busy || similar != null}
              pressedScale={0.98}
              style={[styles.send, { backgroundColor: amColors.orange700, opacity: busy || similar ? 0.6 : 1 }]}
            >
              <Text style={styles.sendText}>{busy ? t("ugc.add.publishing") : t("ugc.add.publish")}</Text>
            </KPress>
            <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>{t("ugc.add.footer")}</Text>
          </>
        )}
      </ScrollView>
      <Toast message={actions.toast} theme={theme} />
    </KeyboardAvoidingView>
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

/**
 * Under the mantra field: the library's mantras that look like what is typed (tap one to use its spelling), and one line
 * about the typed mantra: "12 versions of this mantra" with a way to see them, or "yours will be the first".
 * Nothing here blocks publishing: the field is optional and a failed check only says so.
 */
function MantraHelp({
  theme,
  typed,
  focused,
  suggestions,
  versions,
  checkFailed,
  onPick,
  onSeeAll,
}: {
  theme: SongsTheme
  typed: string
  focused: boolean
  suggestions: MantraSummary[]
  versions: { mantra: MantraSummary | null; count: number } | null
  checkFailed: boolean
  onPick: (title: string) => void
  onSeeAll: (id: string) => void
}) {
  const t = useT()
  // The exact spelling the person already typed needs no suggestion: the line below says how many versions it has.
  const others = suggestions.filter((m) => mantraKey(m.title) !== mantraKey(typed)).slice(0, 5)
  const count = versions?.count ?? 0
  // While close matches are listed, "yours will be the first" would contradict them; say it once the list is gone.
  const showingSuggestions = focused && others.length > 0
  return (
    <View style={styles.mantraHelp}>
      {focused && others.length ? (
        <Reveal index={0}>
          <View style={[styles.suggestBox, { backgroundColor: theme.card, borderColor: theme.line }]} accessibilityLabel={t("ugc.mantra.suggestions")}>
            <Text style={[styles.suggestHead, { color: theme.textBody }]}>{t("ugc.mantra.suggestions")}</Text>
            {others.map((m, index) => (
              <KPress
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={t("mantra.openA11y", { title: m.title, versions: versionsLabel(m.versions) })}
                onActivate={() => onPick(m.title)}
                pressedScale={0.985}
                style={[styles.suggestRow, index > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}
              >
                <Text style={[styles.suggestTitle, { color: theme.textHeading }]} numberOfLines={1}>
                  {m.title}
                </Text>
                <Text style={[styles.suggestCount, { color: theme.accent }]}>{versionsLabel(m.versions)}</Text>
              </KPress>
            ))}
          </View>
        </Reveal>
      ) : null}
      {typed && versions && !(count === 0 && showingSuggestions) ? (
        count > 0 && versions.mantra ? (
          <View style={styles.versionsLine} accessibilityLiveRegion="polite">
            <Text style={[styles.versionsNumber, { color: theme.textHeading }]}>{count}</Text>
            <Text style={[styles.versionsText, { color: theme.textBody }]}>{versionsOfThisLabel(count)}</Text>
            <KPress accessibilityRole="link" accessibilityLabel={t("ugc.mantra.seeAll")} onPress={() => onSeeAll(versions.mantra?.id ?? "")} pressedScale={0.97} style={styles.seeAll}>
              <Text style={[styles.linkText, { color: theme.accent }]}>{t("ugc.mantra.seeAll")}</Text>
            </KPress>
          </View>
        ) : (
          <Text style={[styles.hint, { color: theme.textBody }]} accessibilityLiveRegion="polite">
            {t("ugc.mantra.first")}
          </Text>
        )
      ) : checkFailed && typed ? (
        <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.mantra.checkFailed")}</Text>
      ) : (
        <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.mantra.hint")}</Text>
      )}
    </View>
  )
}

/** "This file is already in the library": the recording that is there, a way to hear it, and a way to choose another file. */
function ExistingCard({ theme, own, original, onPlay, onAnother }: { theme: SongsTheme; own: boolean; original: OriginalRef; onPlay: () => void; onAnother: () => void }) {
  const t = useT()
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line, padding: 16, gap: 10 }]} accessibilityLiveRegion="polite">
      <Text style={[styles.cardTitle, { color: theme.textHeading }]}>{own ? t("ugc.dup.ownTitle") : t("ugc.dup.title")}</Text>
      <View style={[styles.existing, { backgroundColor: theme.inner, borderColor: theme.line }]}>
        <Text style={[styles.existingTitle, { color: theme.textHeading }]} numberOfLines={2}>
          {original.title}
        </Text>
        {original.author ? (
          <Text style={[styles.hint, { color: theme.textBody }]} numberOfLines={1}>
            {original.author}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.hint, { color: theme.textBody, fontSize: 14, lineHeight: 20 }]}>{own ? t("ugc.dup.ownBody") : t("ugc.dup.body")}</Text>
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.dup.playA11y", { title: original.title })} onPress={onPlay} pressedScale={0.98} style={[styles.send, { backgroundColor: amColors.orange700 }]}>
        <Text style={styles.sendText}>{t("ugc.dup.play")}</Text>
      </KPress>
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.dup.another")} onPress={onAnother} pressedScale={0.98} style={[styles.send, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }]}>
        <Text style={[styles.sendText, { color: theme.textHeading }]}>{t("ugc.dup.another")}</Text>
      </KPress>
    </View>
  )
}

function SimilarCard({ theme, similar, onPlay, onYes, onNo }: { theme: SongsTheme; similar: RemoteBrief[]; onPlay: (s: RemoteBrief) => void; onYes: () => void; onNo: () => void }) {
  const t = useT()
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line, padding: 16, gap: 10 }]} accessibilityLiveRegion="polite">
      <Text style={[styles.cardTitle, { color: theme.textHeading }]}>{t("ugc.similar.title")}</Text>
      <Text style={[styles.hint, { color: theme.textBody, fontSize: 14, lineHeight: 20 }]}>{t("ugc.similar.body")}</Text>
      {similar.slice(0, 3).map((s) => (
        <View key={s.id} style={[styles.existing, styles.existingRow, { backgroundColor: theme.inner, borderColor: theme.line }]}>
          <Text style={[styles.existingTitle, { color: theme.textHeading, flex: 1 }]} numberOfLines={2}>
            {t("ugc.similar.listed", { title: s.title })}
          </Text>
          <KPress accessibilityRole="button" accessibilityLabel={t("ugc.similar.playA11y", { title: s.title })} onPress={() => onPlay(s)} pressedScale={0.94} style={[styles.pasteBtn, { backgroundColor: theme.peach }]}>
            <Text style={[styles.pasteText, { color: theme.accent }]}>{t("ugc.similar.play")}</Text>
          </KPress>
        </View>
      ))}
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.similar.yes")} onPress={onYes} pressedScale={0.98} style={[styles.send, { backgroundColor: amColors.orange700 }]}>
        <Text style={styles.sendText}>{t("ugc.similar.yes")}</Text>
      </KPress>
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.similar.no")} onPress={onNo} pressedScale={0.98} style={[styles.send, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }]}>
        <Text style={[styles.sendText, { color: theme.textHeading }]}>{t("ugc.similar.no")}</Text>
      </KPress>
    </View>
  )
}

function Sent({ theme, kirtan, local, onView, onAnother }: { theme: SongsTheme; kirtan: Kirtan; local: boolean; onView: () => void; onAnother: () => void }) {
  const t = useT()
  return (
    <Reveal index={0} style={styles.sent}>
      <View style={[styles.sentDisc, { backgroundColor: theme.peach }]}>
        <PlayerIcon name="check" size={34} color={theme.accent} strokeWidth={2.5} />
      </View>
      <Text style={[styles.h1, { color: theme.textHeading, textAlign: "center" }]} accessibilityRole="header">
        {t("ugc.sent.line1")}
        {"\n"}
        <Text style={{ color: theme.ink300 }}>{t("ugc.sent.line2")}</Text>
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line, padding: 14, gap: 8 }]}>
        <View style={styles.tagLine}>
          <KirtanTag theme={theme} kind={kirtan.kind} />
          <Text style={[styles.pasteText, { color: theme.accent }]}>{t("ugc.sent.tag")}</Text>
        </View>
        <Text style={[styles.cardTitle, { color: theme.textHeading }]} numberOfLines={3}>
          {kirtan.title}
        </Text>
      </View>
      <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>{t("ugc.sent.body")}</Text>
      <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>{t("ugc.sent.after")}</Text>
      {local ? <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>{t("ugc.sent.demo")}</Text> : null}
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.sent.view")} onPress={onView} pressedScale={0.98} outerStyle={styles.full} style={[styles.send, { backgroundColor: amColors.orange700 }]}>
        <Text style={styles.sendText}>{t("ugc.sent.view")}</Text>
      </KPress>
      <KPress accessibilityRole="button" accessibilityLabel={t("ugc.sent.another")} onPress={onAnother} pressedScale={0.98} outerStyle={styles.full} style={[styles.send, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line }]}>
        <PlusGlyph color={theme.textHeading} />
        <Text style={[styles.sendText, { color: theme.textHeading }]}>{t("ugc.sent.another")}</Text>
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
  fileName: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 20 },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  pasteBtn: { height: 40, paddingHorizontal: 16, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pasteText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  tagLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontFamily: amFonts.semi, fontSize: 18, lineHeight: 22, letterSpacing: -0.1 },
  kinds: { flexDirection: "row", gap: 10 },
  kindOuter: { flex: 1 },
  kindCard: { minHeight: 76, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, justifyContent: "center", gap: 2 },
  kindName: { fontFamily: amFonts.display, fontSize: 24, lineHeight: 26, letterSpacing: -0.4, textTransform: "uppercase" },
  kindBlurb: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 17 },
  confirm: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 4 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  confirmText: { flex: 1, fontFamily: amFonts.medium, fontSize: 15, lineHeight: 21 },
  linkRow: { alignSelf: "flex-start", paddingVertical: 2 },
  linkText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 20, textDecorationLine: "underline" },
  send: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  sendText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  sent: { alignItems: "stretch", gap: 20, paddingTop: 12 },
  sentDisc: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  full: { alignSelf: "stretch" },
  mantraHelp: { gap: 8 },
  suggestBox: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  suggestHead: { fontFamily: amFonts.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.4, textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  suggestRow: { minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  suggestTitle: { flex: 1, minWidth: 0, fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  suggestCount: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16 },
  versionsLine: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  versionsNumber: { fontFamily: amFonts.display, fontSize: 48, lineHeight: 48, letterSpacing: -1 },
  versionsText: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  seeAll: { paddingVertical: 6 },
  existing: { borderRadius: 16, borderWidth: 1, padding: 12, gap: 2 },
  existingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  existingTitle: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 21 },
})
