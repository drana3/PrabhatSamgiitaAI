import { createElement, useEffect, useMemo, useRef, useState } from "react"
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import * as DocumentPicker from "expo-document-picker"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { StyleField } from "@/components/kirtan/add/StyleField"
import { DanceField, FieldError, LanguageField, LanguagePicker, RequiredMark, type LanguageValue } from "@/components/kirtan/add/KindFields"
import { ApplyToAllCard, QueueBar } from "@/components/kirtan/add/QueueRows"
import { CoverField } from "@/components/kirtan/sets/CoverField"
import { EventDateField } from "@/components/kirtan/sets/EventDateField"
import { SetTrackRow, type SetTrackHandlers } from "@/components/kirtan/sets/SetTrackRow"
import { SheetTopBar } from "@/components/common/SheetTopBar"
import { KPress } from "@/components/kirtan/KPress"
import { Toast } from "@/components/songs-v2/Toast"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import type { SongsTheme } from "@/constants/tokens/amSongs"
import { amFonts } from "@/constants/tokens/amTypography"
import { useKirtanActions } from "@/hooks/useKirtanActions"
import { useSongsTheme } from "@/hooks/useSongsTheme"
import { formatDate, useT } from "@/lib/i18n"
import { kindHasDance, kindHasLanguage, kindHasPerformer, kindLabel, kindRequiresLanguage } from "@/lib/kirtan/kind"
import { playableOriginal, type OriginalRef } from "@/lib/kirtan/original"
import { missingCounts, rowMissing, type PickedFile, type QueueItem } from "@/lib/kirtan/queue"
import type { RemoteBrief } from "@/lib/kirtan/remote"
import { isRulesAccepted, uploadErrorText } from "@/lib/kirtan/rules"
import { SET_LIMITS, setCounts, setDay, setDefaults, setProgress, setState, trackMissing, validateSetDetails, type SetDetailsError, type SetDraft, type SetTrack, trackKind } from "@/lib/kirtan/sets"
import { eventLabel } from "@/lib/kirtan/setDate"
import { missingKindFields } from "@/lib/kirtan/uploadForm"
import { RECORDING_KINDS, type DanceId, type RecordingKind } from "@/lib/kirtan/types"
import { useFormFocus } from "@/lib/forms/useFormFocus"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { useAuthStore } from "@/stores/authStore"
import { useContentRulesStore } from "@/stores/contentRulesStore"
import { useUploadSetStore } from "@/stores/uploadSetStore"
import { href } from "@/utils/href"
import { effectiveFields } from "@/lib/kirtan/queue"

/**
 * Playlist from an event (docs/kiirtan-sets.md): a concert, a retreat, a satsang, sent as one set.
 * Four steps: the files, the details of the event, the tracks (their order, titles, language and dance), and the upload.
 * The set is a DRAFT kept on the phone (stores/uploadSetStore.ts), so closing the app, losing the signal or leaving this
 * screen never loses it; "Unfinished playlists" brings it back where it was. A track that fails does not stop the others,
 * and each failed one has its own "Try again".
 */

const STEPS = ["files", "details", "tracks", "send"] as const
type Step = (typeof STEPS)[number]

function firstStep(draft: SetDraft): number {
  if (draft.created || draft.tracks.some((track) => track.status !== "waiting")) return 3
  if (!draft.tracks.length) return 0
  return validateSetDetails(draft) ? 1 : 2
}

export default function UploadSetScreen() {
  const t = useT()
  const router = useRouter()
  const theme = useSongsTheme()
  const insets = useSafeAreaInsets()
  const isWeb = Platform.OS === "web"
  const actions = useKirtanActions()
  const params = useLocalSearchParams<{ set?: string }>()

  const signedIn = useAuthStore((s) => s.mode === "signed_in") || MOCKUP_DATA
  const acceptedAt = useContentRulesStore((s) => s.acceptedAt)
  const acceptedVersion = useContentRulesStore((s) => s.version)
  const rulesOk = isRulesAccepted({ acceptedAt, version: acceptedVersion })

  const drafts = useUploadSetStore((s) => s.drafts)
  const running = useUploadSetStore((s) => s.running)
  const stopped = useUploadSetStore((s) => s.stopped)
  const error = useUploadSetStore((s) => s.error)
  const store = useUploadSetStore.getState
  const form = useFormFocus()

  const [activeId, setActiveId] = useState<string | null>(typeof params.set === "string" ? params.set : null)
  const [step, setStep] = useState(0)
  const [tried, setTried] = useState(false)
  const [langFor, setLangFor] = useState<"set" | "all" | (string & {}) | null>(null)
  const [block, setBlock] = useState<string | null>(null)
  const inputRef = useRef<{ click: () => void } | null>(null)
  const alive = useRef(true)
  useEffect(
    () => () => {
      alive.current = false
    },
    [],
  )

  const draft = drafts.find((d) => d.id === activeId) ?? null
  const unfinished = drafts.filter((d) => d.tracks.length > 0 || d.title.trim())
  const choosing = signedIn && !draft && unfinished.length > 0 && !params.set

  // No draft in hand and none to pick from: start one.
  useEffect(() => {
    if (!signedIn || draft || choosing) return
    const id = store().begin(typeof params.set === "string" ? params.set : undefined)
    setActiveId(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, draft, choosing])

  // Rules agreed before count for the whole set
  useEffect(() => {
    if (draft && rulesOk && !draft.confirmed) store().details(draft.id, { confirmed: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, rulesOk])

  // Where to open a draft that comes back
  const openedFor = useRef<string | null>(null)
  useEffect(() => {
    if (draft && openedFor.current !== draft.id) {
      openedFor.current = draft.id
      setStep(firstStep(draft))
    }
  }, [draft])

  const close = () => (router.canGoBack() ? router.back() : router.replace(href("/add-kirtan")))
  const locked = running !== null

  const listenTo = (ref: OriginalRef) => {
    const playable = playableOriginal(ref)
    if (!playable) {
      actions.flash(t("ugc.dup.cantPlay"))
      return
    }
    actions.open(playable, [playable])
  }

  /* ------------------------------------------------------------------ files */

  const addPicked = (files: PickedFile[]) => {
    if (!draft || !files.length) return
    const result = store().addFiles(draft.id, files)
    setBlock(null)
    if (result.overLimit) actions.flash(t("set.files.over", { count: result.overLimit, max: SET_LIMITS.maxTracks }))
    else if (result.skipped) actions.flash(t("set.files.skipped", { count: result.skipped }))
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
      if (alive.current) actions.flash(t("ugc.add.pickFailed"))
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

  /* ------------------------------------------------------------------ what each step needs */

  const detailsError: SetDetailsError | null = draft ? validateSetDetails(draft) : null
  // a new step starts at the top of the page, not where the last one was scrolled to
  useEffect(() => {
    form.scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  const defaultsMissing = draft ? missingKindFields({ kind: draft.defaultKind, language: draft.defaultLanguage, languageOther: draft.defaultLanguageOther, dance: draft.defaultDance }) : []
  const counts = draft ? setCounts(draft) : null

  const goNext = () => {
    if (!draft) return
    setBlock(null)
    if (step === 0) {
      if (!draft.tracks.length) {
        setBlock(t("set.files.none"))
        return
      }
      setStep(1)
      return
    }
    if (step === 1) {
      setTried(true)
      form.clear()
      // the first thing missing, in the order of the form: the title, the year, then what the recordings need
      const messages: Record<string, string> = {
        title: t("set.err.title"),
        year: detailsError === "future" ? t("set.err.future") : t("set.err.year"),
        dance: t("ugc.form.error.dance"),
        language: defaultsMissing.includes("languageName") ? t("ugc.form.error.languageName") : t("ugc.form.error.language"),
      }
      const missingKeys = [
        ...(detailsError === "title" ? ["title"] : []),
        ...(detailsError === "year" || detailsError === "future" ? ["year"] : []),
        ...(defaultsMissing.includes("dance") ? ["dance"] : []),
        ...(defaultsMissing.includes("language") || defaultsMissing.includes("languageName") ? ["language"] : []),
      ]
      if (missingKeys.length) {
        void form.focusFirst(missingKeys, messages)
        return
      }
      setStep(2)
      return
    }
    if (step === 2) setStep(3)
  }

  const send = async () => {
    if (!draft) return
    setBlock(null)
    if (!rulesOk && !draft.confirmed) {
      setBlock(t("set.block.rules"))
      return
    }
    if (!rulesOk) useContentRulesStore.getState().accept()
    const result = await store().upload(draft.id)
    if (!result) return
    setBlock(t(`set.block.${result}`))
    // a track that still misses something: go to the tracks and bring the first such row on screen
    if (result === "fields") {
      const open = draft.tracks.filter((track) => track.status === "waiting")
      const bad = open.filter((track) => !track.title.trim() || trackMissing(track, draft).length > 0)
      setTried(true)
      setStep(2)
      const messages: Record<string, string> = {}
      for (const track of bad) messages[`track-${track.id}`] = t("set.block.fields")
      setTimeout(() => void form.focusFirst(bad.map((track) => `track-${track.id}`), messages), 80)
    }
    if (result === "details") {
      setStep(1)
      setTried(true)
    }
  }

  const confirmDiscard = (id: string) => {
    const go = () => void store().discard(id).then(() => id === activeId && setActiveId(null))
    if (Platform.OS === "web") {
      go()
      return
    }
    Alert.alert(t("set.draft.discardTitle"), t("set.draft.discardBody"), [
      { text: t("set.own.cancel"), style: "cancel" },
      { text: t("set.draft.discard"), style: "destructive", onPress: go },
    ])
  }

  /* ------------------------------------------------------------------ render */

  const body = () => {
    if (!signedIn) {
      return (
        <Reveal index={0} style={styles.stack}>
          <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {t("ugc.signin.title")}
          </Text>
          <Text style={[styles.hint, { color: theme.textBody, fontSize: 15, lineHeight: 21 }]}>{t("ugc.signin.body")}</Text>
          <Primary theme={theme} label={t("ugc.signin.action")} onPress={() => router.push(href("/signin"))} />
        </Reveal>
      )
    }
    if (choosing) return chooser()
    if (!draft || !counts) return null
    return (
      <>
        <Reveal index={0}>
          <Text style={[styles.over, { color: theme.accent }]}>{t("set.over")}</Text>
          <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
            {draft.title.trim() || t("set.heading")}
          </Text>
          <Text style={[styles.hint, { color: theme.textBody, marginTop: 8 }]} accessibilityLiveRegion="polite">
            {t("set.step.of", { n: step + 1, total: STEPS.length })}: {t(`set.step.${STEPS[step] as Step}`)}
          </Text>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {STEPS.map((name, index) => (
              <View key={name} style={[styles.dot, { backgroundColor: index <= step ? amColors.orange700 : theme.line }]} />
            ))}
          </View>
        </Reveal>

        {step === 0 ? filesStep(draft) : null}
        {step === 1 ? detailsStep(draft) : null}
        {step === 2 || step === 3 ? tracksStep(draft, step === 3) : null}

        {block ? (
          <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
            {block}
          </Text>
        ) : null}

        <View style={styles.nav}>
          {step > 0 ? (
            <KPress accessibilityRole="button" accessibilityLabel={t("set.back")} disabled={locked} onPress={() => setStep(step - 1)} pressedScale={0.97} outerStyle={styles.navBack} style={[styles.secondary, { borderColor: theme.line, backgroundColor: theme.card, opacity: locked ? 0.5 : 1 }]}>
              <Text style={[styles.secondaryText, { color: theme.textHeading }]}>{t("set.back")}</Text>
            </KPress>
          ) : null}
          {step < 3 ? (
            <Primary theme={theme} label={t("set.next")} onPress={goNext} grow />
          ) : null}
        </View>
      </>
    )
  }

  const chooser = () => (
    <Reveal index={0} style={styles.stack}>
      <Text style={[styles.over, { color: theme.accent }]}>{t("set.over")}</Text>
      <Text style={[styles.h1, { color: theme.textHeading }]} accessibilityRole="header">
        {t("set.draft.title")}
      </Text>
      {unfinished.map((d) => {
        const c = setCounts(d)
        return (
          <View key={d.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
            <Text style={[styles.cardTitle, { color: theme.textHeading }]} numberOfLines={2}>
              {d.title.trim() || t("set.draft.untitled")}
            </Text>
            <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.draft.row", { title: t(`set.status.${setState(d)}`), count: c.total })}</Text>
            <View style={styles.cardActions}>
              <Primary theme={theme} label={t("set.draft.continue")} onPress={() => setActiveId(d.id)} grow />
              <KPress accessibilityRole="button" accessibilityLabel={t("set.draft.discard")} onPress={() => confirmDiscard(d.id)} pressedScale={0.97} style={[styles.secondary, { borderColor: theme.line, backgroundColor: theme.card }]}>
                <Text style={[styles.secondaryText, { color: theme.dangerText }]}>{t("set.draft.discard")}</Text>
              </KPress>
            </View>
          </View>
        )
      })}
      <KPress
        accessibilityRole="button"
        accessibilityLabel={t("set.draft.new")}
        onPress={() => {
          setActiveId(store().begin())
        }}
        pressedScale={0.98}
        style={[styles.secondary, { borderColor: theme.line, backgroundColor: theme.card }]}
      >
        <Text style={[styles.secondaryText, { color: theme.textHeading }]}>{t("set.draft.new")}</Text>
      </KPress>
    </Reveal>
  )

  const filesStep = (d: SetDraft) => (
    <Reveal index={1} style={styles.stack}>
      <Text style={[styles.label, { color: theme.textHeading }]}>{t("set.files.title")}</Text>
      <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.files.body")}</Text>
      <KPress accessibilityRole="button" accessibilityLabel={d.tracks.length ? t("set.files.more") : t("set.files.choose")} onPress={() => void choose()} pressedScale={0.98} style={[styles.drop, { backgroundColor: theme.card, borderColor: block ? amColors.danger : theme.line }]}>
        <Text style={[styles.dropTitle, { color: theme.textHeading }]}>{d.tracks.length ? t("set.files.count", { count: d.tracks.length }) : t("set.files.empty")}</Text>
        <View style={[styles.pill, { backgroundColor: theme.peach }]}>
          <Text style={[styles.pillText, { color: theme.accent }]}>{d.tracks.length ? t("set.files.more") : t("set.files.choose")}</Text>
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
            "aria-label": t("set.files.choose"),
            style: { display: "none" },
            onChange: (event: { target: { files?: ArrayLike<File> | null; value: string } }) => {
              onPickedWeb(event.target.files)
              event.target.value = ""
            },
          })
        : null}
      <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.add.fileHint", { mb: 100 })}</Text>
    </Reveal>
  )

  const textField = (key: string, label: string, value: string, onChange: (text: string) => void, options: { placeholder?: string; hint?: string; optional?: boolean; max?: number } = {}) => (
    <View {...form.field(key)} style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: theme.textHeading }]}>{label}</Text>
        <RequiredMark theme={theme} required={!options.optional} invalid={!!form.error(key)} />
      </View>
      <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: form.error(key) ? amColors.danger : theme.line }]}>
        <TextInput
          ref={form.input(key)}
          value={value}
          onChangeText={(text) => {
            if (form.error(key)) form.clear()
            onChange(text)
          }}
          editable={!locked}
          placeholder={options.placeholder}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={label}
          maxLength={options.max ?? 200}
          style={[styles.input, { color: theme.textHeading }]}
        />
      </View>
      {options.hint ? <Text style={[styles.hint, { color: theme.textBody }]}>{options.hint}</Text> : null}
      <FieldError theme={theme} text={form.error(key)} />
    </View>
  )

  const detailsStep = (d: SetDraft) => {
    const languageValue: LanguageValue = { language: d.defaultLanguage, languageOther: d.defaultLanguageOther }
    return (
      <Reveal index={1} style={styles.stack}>
        {textField("title", t("set.d.title"), d.title, (text) => store().details(d.id, { title: text }), { placeholder: t("set.d.titlePlaceholder"), max: 200 })}
        {textField("place", t("set.d.place"), d.place, (text) => store().details(d.id, { place: text }), { placeholder: t("set.d.placePlaceholder"), optional: true, max: 200 })}
        <View {...form.field("year")}>
          <EventDateField
            theme={theme}
            year={d.eventYear}
            month={d.eventMonth}
            onYear={(year) => {
              form.clear()
              store().details(d.id, { eventYear: year, ...(d.eventMonth && year === new Date().getUTCFullYear() && d.eventMonth > new Date().getUTCMonth() + 1 ? { eventMonth: null } : {}) })
            }}
            onMonth={(month) => store().details(d.id, { eventMonth: month })}
            invalid={!!form.error("year")}
            errorText={form.error("year")}
            disabled={locked}
          />
        </View>
        {kindHasPerformer(d.defaultKind) ? textField("performer", t("set.d.performer"), d.performer, (text) => store().details(d.id, { performer: text }), { hint: t("set.d.performerHint"), optional: true, max: 80 }) : null}
        <CoverField theme={theme} uri={d.coverUri} state={d.coverState} disabled={locked} onChange={(uri) => store().cover(d.id, uri)} />

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textHeading }]}>{t("set.d.kind")}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {RECORDING_KINDS.map((kind) => {
              const on = d.defaultKind === kind
              return (
                <KPress
                  key={kind}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={kindLabel(kind)}
                  onActivate={() => {
                    if (locked) return
                    const clear = kindHasLanguage(kind) ? {} : { defaultLanguage: null, defaultLanguageOther: "" }
                    store().details(d.id, { defaultKind: kind, ...clear, ...(kindHasDance(kind) ? {} : { defaultDance: null }), ...(kind === "kiirtan" ? {} : { defaultStyle: null, defaultStyleOther: "" }) })
                  }}
                  pressedScale={0.96}
                  style={[styles.chip, { backgroundColor: on ? theme.ink900 : theme.card, borderColor: on ? theme.ink900 : theme.line }]}
                >
                  <Text style={[styles.chipText, { color: on ? theme.onInk : theme.textHeading }]}>{kindLabel(kind)}</Text>
                </KPress>
              )
            })}
          </View>
          <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.d.kindHint")}</Text>
        </View>

        {kindHasDance(d.defaultKind) ? (
          <View {...form.field("dance")}>
            <DanceField theme={theme} value={d.defaultDance} onChange={(dance) => { form.clear(); store().details(d.id, { defaultDance: dance }) }} invalid={!!form.error("dance")} errorText={form.error("dance")} disabled={locked} />
          </View>
        ) : null}
        <StyleField theme={theme} kind={d.defaultKind} value={{ style: d.defaultStyle, styleOther: d.defaultStyleOther }} onChange={(next) => store().details(d.id, { defaultStyle: next.style, defaultStyleOther: next.styleOther })} />
        {kindHasLanguage(d.defaultKind) ? (
          <View {...form.field("language")}>
            <LanguageField theme={theme} kind={d.defaultKind} value={languageValue} onOpen={() => setLangFor("set")} invalid={!!form.error("language")} errorText={form.error("language")} disabled={locked} />
          </View>
        ) : null}
      </Reveal>
    )
  }

  const tracksStep = (d: SetDraft, sending: boolean) => {
    const defaults = setDefaults(d)
    const missing = missingCounts(d.tracks, defaults)
    const handlers: SetTrackHandlers = {
      onTitle: (id, title) => store().title(d.id, id, title),
      onRemove: (id) => store().remove(d.id, id),
      onRetry: (id) => void store().retry(d.id, id),
      onMove: (id, step) => store().nudge(d.id, id, step),
      onDay: (id, text) => store().day(d.id, id, text),
      onKind: (id, kind) => store().kind(d.id, id, kind),
      onRowLanguage: (id) => setLangFor(id),
      onRowDance: (id, dance) => store().fields(d.id, id, { dance }),
      onSimilarYes: (id) => void store().decideSimilar(d.id, id, true),
      onSimilarNo: (id) => void store().decideSimilar(d.id, id, false),
      onPlaySimilar: (brief: RemoteBrief) => listenTo({ id: brief.id, title: brief.title, author: brief.author, audioUrl: brief.audio_url, kind: brief.kind }),
      onHear: (track) => track.original && listenTo(track.original as OriginalRef),
    }
    const settled = counts ? counts.total - counts.waiting - counts.uploading : 0
    const retryable = d.tracks.filter((track) => track.status === "failed" && track.failure?.code !== "format" && track.failure?.code !== "size").length
    const state = setState(d)
    const doneAll = state === "published" && !locked
    return (
      <Reveal index={1} style={styles.stack}>
        {sending ? sendPanel(d, state, settled, retryable, doneAll) : null}
        {!sending ? (
          <>
            <Text style={[styles.label, { color: theme.textHeading }]}>{t("set.t.title")}</Text>
            <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.t.hint")}</Text>
            <View style={styles.chips}>
              <KPress accessibilityRole="button" accessibilityLabel={t("set.t.sort")} onPress={() => store().sortByName(d.id)} pressedScale={0.96} style={[styles.chip, { backgroundColor: theme.peach, borderColor: theme.peach }]}>
                <Text style={[styles.chipText, { color: theme.accent }]}>{t("set.t.sort")}</Text>
              </KPress>
              <KPress accessibilityRole="button" accessibilityLabel={t("set.files.more")} onPress={() => void choose()} pressedScale={0.96} style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.line }]}>
                <Text style={[styles.chipText, { color: theme.textHeading }]}>{t("set.files.more")}</Text>
              </KPress>
            </View>
            {isWeb
              ? createElement("input", {
                  ref: (node: { click: () => void } | null) => {
                    inputRef.current = node
                  },
                  type: "file",
                  accept: "audio/*",
                  multiple: true,
                  "aria-label": t("set.files.more"),
                  style: { display: "none" },
                  onChange: (event: { target: { files?: ArrayLike<File> | null; value: string } }) => {
                    onPickedWeb(event.target.files)
                    event.target.value = ""
                  },
                })
              : null}
          </>
        ) : null}
        {d.tracks.length > 1 && !sending && (kindHasLanguage(d.defaultKind) || kindHasDance(d.defaultKind)) ? (
          <ApplyToAllCard theme={theme} kind={d.defaultKind} missing={missing} tried={tried} locked={locked} onLanguage={() => setLangFor("all")} onDance={(dance: DanceId) => store().applyToAll(d.id, { dance })} />
        ) : null}
        {d.tracks.length ? (
          <View style={styles.rows}>
            {d.tracks.map((track, index) => {
              const kind = trackKind(track, d)
              const fields = effectiveFields(track, { ...defaults, kind })
              return <View key={track.id} {...form.field(`track-${track.id}`)}><SetTrackRow theme={theme} track={track} position={index + 1} total={d.tracks.length} fields={{ ...fields, missing: trackMissing(track, d), tried: tried || sending }} firstDay={setDay(d)} locked={locked || doneAll} handlers={handlers} />{form.error(`track-${track.id}`) ? <FieldError theme={theme} text={form.error(`track-${track.id}`)} /> : null}</View>
            })}
          </View>
        ) : (
          <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.t.empty")}</Text>
        )}
      </Reveal>
    )
  }

  const sendPanel = (d: SetDraft, state: ReturnType<typeof setState>, settled: number, retryable: number, doneAll: boolean) => {
    const open = d.tracks.filter((track) => track.status === "waiting" || track.status === "limit").length
    const label = running ? t("set.up.working", { done: settled, total: counts?.total ?? 0 }) : d.created && open > 0 ? t("set.up.continue") : t("set.up.start", { count: open })
    const stopText =
      stopped === "network"
        ? t("set.up.offline")
        : stopped === "signin"
          ? t("set.up.signin")
          : stopped === "dailyLimit"
            ? t("set.up.dailyLimit", { count: open })
            : stopped === "startLimit"
              ? t("set.up.startLimit")
              : stopped === "server"
                ? error
                  ? uploadErrorText(error)
                  : t("set.up.server")
                : null
    return (
      <View style={styles.stack}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.line }]}>
          <Text style={[styles.cardTitle, { color: theme.textHeading }]} numberOfLines={3}>
            {d.title.trim()}
          </Text>
          <Text style={[styles.hint, { color: theme.textBody }]}>{[eventLabel(d.eventYear, d.eventMonth, (m) => (t as (key: string) => string)(`set.month.${m}`)), d.place.trim(), t("set.files.count", { count: d.tracks.length })].filter(Boolean).join(" · ")}</Text>
          <Text style={[styles.hint, { color: theme.textBody }]}>{[d.performer.trim(), kindLabel(d.defaultKind)].filter(Boolean).join(" · ")}</Text>
        </View>

        {state === "published" ? (
          <View style={[styles.card, { backgroundColor: theme.peach, borderColor: theme.line }]} accessibilityLiveRegion="polite">
            <Text style={[styles.cardTitle, { color: theme.textHeading }]}>{t("set.up.doneTitle")}</Text>
            <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.up.doneBody")}</Text>
            <Primary
              theme={theme}
              label={t("set.up.open")}
              onPress={() => {
                const id = d.id
                store().archiveDone(id)
                router.replace(href(`/recording-set/${id}`))
              }}
            />
            <KPress
              accessibilityRole="button"
              accessibilityLabel={t("set.up.another")}
              onPress={() => {
                store().archiveDone(d.id)
                setActiveId(null)
                openedFor.current = null
                setTried(false)
              }}
              pressedScale={0.98}
              style={[styles.secondary, { borderColor: theme.line, backgroundColor: theme.card }]}
            >
              <Text style={[styles.secondaryText, { color: theme.textHeading }]}>{t("set.up.another")}</Text>
            </KPress>
          </View>
        ) : (
          <>
            {running || setProgress(d) > 0 ? <QueueBar theme={theme} items={d.tracks} /> : null}
            {counts && counts.live > 0 && counts.live < counts.total && !running ? (
              <Text style={[styles.hint, { color: theme.textBody }]} accessibilityLiveRegion="polite">
                {t("set.up.partial", { live: counts.live, total: counts.total })}
              </Text>
            ) : null}
            {!rulesOk ? (
              <KPress accessibilityRole="checkbox" accessibilityState={{ checked: d.confirmed }} accessibilityLabel={t("ugc.add.terms")} onActivate={() => !locked && store().confirm(d.id, !d.confirmed)} pressedScale={0.99} style={styles.confirm}>
                <View style={[styles.box, { borderColor: d.confirmed ? amColors.orange700 : theme.textBody, backgroundColor: d.confirmed ? amColors.orange700 : "transparent" }]}>
                  {d.confirmed ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <View style={styles.confirmText}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>{t("ugc.add.terms")}</Text>
                  <Text style={[styles.hint, { color: theme.textBody }]}>{t("set.rules.once")}</Text>
                </View>
              </KPress>
            ) : (
              <Text style={[styles.hint, { color: theme.textBody }]}>{t("ugc.add.termsAgreed", { date: formatDate(acceptedAt ?? "", "medium") })}</Text>
            )}
            {stopText ? (
              <Text style={[styles.hint, { color: theme.dangerText }]} accessibilityLiveRegion="polite">
                {stopText}
              </Text>
            ) : null}
            {retryable > 0 && !running ? (
              <KPress accessibilityRole="button" accessibilityLabel={t("set.up.retryAll")} onPress={() => void store().retryAll(d.id)} pressedScale={0.98} style={[styles.secondary, { borderColor: theme.line, backgroundColor: theme.card }]}>
                <Text style={[styles.secondaryText, { color: theme.textHeading }]}>{t("set.up.retryAll")}</Text>
              </KPress>
            ) : null}
            {/* nothing left to send (the rest cannot go up as it is): no button, the note above says what to do */}
            {running !== null || open > 0 ? (
              <>
                <Primary theme={theme} label={label} onPress={() => void send()} disabled={running !== null} busy={running !== null} />
                <Text style={[styles.hint, { color: theme.textBody, textAlign: "center" }]}>{t("set.up.keepOpen")}</Text>
              </>
            ) : null}
          </>
        )}
      </View>
    )
  }

  const pickerValue: LanguageValue = (() => {
    if (!draft || langFor === null) return { language: null, languageOther: "" }
    if (langFor === "set") return { language: draft.defaultLanguage, languageOther: draft.defaultLanguageOther }
    if (langFor === "all") return { language: null, languageOther: "" }
    const track = draft.tracks.find((row) => row.id === langFor)
    if (!track) return { language: null, languageOther: "" }
    const fields = effectiveFields(track, { ...setDefaults(draft), kind: trackKind(track, draft) })
    return { language: fields.language ?? null, languageOther: fields.languageOther ?? "" }
  })()
  const pickKind: RecordingKind = !draft ? "kiirtan" : langFor && langFor !== "set" && langFor !== "all" ? trackKind(draft.tracks.find((row) => row.id === langFor) ?? ({} as SetTrack), draft) : draft.defaultKind
  const onPickLanguage = (value: LanguageValue) => {
    if (!draft || !langFor) return
    if (langFor === "set") store().details(draft.id, { defaultLanguage: value.language, defaultLanguageOther: value.languageOther })
    else if (langFor === "all") {
      store().applyToAll(draft.id, { language: value.language, languageOther: value.languageOther })
      actions.flash(t("rec.q.applied", { count: draft.tracks.filter((track) => track.status === "waiting").length }))
    } else store().fields(draft.id, langFor, { language: value.language, languageOther: value.languageOther })
    setLangFor(null)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.root, { backgroundColor: theme.page }]}>
      <SheetTopBar closeLabel={t("set.close")} onClose={close} />
      <ScrollView ref={form.scrollRef} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 40 }]}>
        {body()}
      </ScrollView>
      <LanguagePicker visible={langFor !== null} value={pickerValue} allowClear={!kindRequiresLanguage(pickKind)} onPick={onPickLanguage} onClose={() => setLangFor(null)} />
      <Toast message={actions.toast} theme={theme} />
    </KeyboardAvoidingView>
  )
}

function Primary({ theme: _theme, label, onPress, grow, disabled, busy }: { theme: SongsTheme; label: string; onPress: () => void; grow?: boolean; disabled?: boolean; busy?: boolean }) {
  return (
    <KPress accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, busy: !!busy }} disabled={disabled} onPress={onPress} pressedScale={0.98} outerStyle={grow ? styles.grow : styles.full} style={[styles.send, { backgroundColor: amColors.orange700, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={styles.sendText}>{label}</Text>
    </KPress>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 22, paddingTop: 8, maxWidth: 560, width: "100%", alignSelf: "center" },
  stack: { gap: 16 },
  over: { fontFamily: amFonts.semi, fontSize: 13, lineHeight: 16, letterSpacing: 1.04, textTransform: "uppercase", marginBottom: 6 },
  h1: { fontFamily: amFonts.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8, textTransform: "uppercase" },
  dots: { flexDirection: "row", gap: 6, marginTop: 12 },
  dot: { height: 6, flex: 1, borderRadius: 3 },
  field: { gap: 10 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20 },
  hint: { fontFamily: amFonts.medium, fontSize: 13, lineHeight: 18 },
  inputBox: { minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: "row" },
  input: { flex: 1, minWidth: 0, fontFamily: amFonts.medium, fontSize: 16, lineHeight: 22, paddingVertical: 12, outlineStyle: "none" as never },
  multi: { minHeight: 88, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: amFonts.semi, fontSize: 14, lineHeight: 18 },
  drop: { minHeight: 96, borderRadius: 24, borderWidth: 1.5, padding: 18, gap: 12, justifyContent: "center" },
  dropTitle: { fontFamily: amFonts.display, fontSize: 22, lineHeight: 26, letterSpacing: -0.3, textTransform: "uppercase" },
  pill: { alignSelf: "flex-start", height: 40, paddingHorizontal: 18, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  pillText: { fontFamily: amFonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
  card: { borderRadius: 24, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle: { fontFamily: amFonts.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.2, textTransform: "uppercase" },
  cardActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  rows: { gap: 14 },
  nav: { flexDirection: "row", gap: 10, alignItems: "center" },
  navBack: { flexShrink: 0 },
  grow: { flex: 1 },
  full: { alignSelf: "stretch" },
  send: { height: 56, borderRadius: 70, alignItems: "center", justifyContent: "center", flexDirection: "row", paddingHorizontal: 20 },
  sendText: { fontFamily: amFonts.bold, fontSize: 17, lineHeight: 22, color: "#FFFFFF" },
  secondary: { height: 56, borderRadius: 70, borderWidth: 1.5, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  secondaryText: { fontFamily: amFonts.bold, fontSize: 16, lineHeight: 20 },
  confirm: { flexDirection: "row", alignItems: "flex-start", gap: 14, paddingVertical: 4 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  tick: { color: "#FFFFFF", fontFamily: amFonts.bold, fontSize: 16, lineHeight: 18 },
  confirmText: { flex: 1, gap: 2 },
})
