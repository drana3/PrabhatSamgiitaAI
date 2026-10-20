import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native"
import type { AdminDevanagariSong } from "@prabhat/core"
import * as Clipboard from "expo-clipboard"
import { Languages } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { api } from "@/lib/client"

type ProgressKind = "load" | "save" | "submit" | "approve"

const PROGRESS_STEPS: Record<ProgressKind, { eyebrow: string; steps: readonly string[] }> = {
  load: {
    eyebrow: "Loading song",
    steps: [
      "Loading song…",
      "Fetching Roman lyrics…",
      "Loading Devanagari lyrics…",
      "Preparing review workspace…",
    ],
  },
  save: {
    eyebrow: "Saving provisional",
    steps: [
      "Validating Devanagari draft…",
      "Saving Roman + Devanagari…",
      "Updating review status…",
      "Confirming provisional save…",
    ],
  },
  submit: {
    eyebrow: "Submitting for approval",
    steps: [
      "Validating Devanagari draft…",
      "Saving latest lyrics…",
      "Queuing for approval…",
      "Marking pending review…",
    ],
  },
  approve: {
    eyebrow: "Approving Devanagari",
    steps: [
      "Checking review status…",
      "Approving Devanagari lyrics…",
      "Publishing to apps…",
      "Confirming approved status…",
    ],
  },
}

function ActionProgress({
  kind,
  stepIndex,
  songLabel,
}: {
  kind: ProgressKind
  stepIndex: number
  songLabel: string
}) {
  const { eyebrow, steps } = PROGRESS_STEPS[kind]
  const clamped = Math.min(Math.max(stepIndex, 0), steps.length - 1)
  const percent = Math.round(((clamped + 1) / steps.length) * 100)

  return (
    <View style={styles.progressCard} accessibilityState={{ busy: true }}>
      <Text style={styles.progressEyebrow}>{eyebrow}</Text>
      <Text style={styles.progressTitle}>{songLabel}</Text>
      <Text style={styles.progressActive}>{steps[clamped]}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      {steps.map((label, index) => {
        const done = index < clamped
        const active = index === clamped
        return (
          <View key={label} style={styles.progressStepRow}>
            <View
              style={[
                styles.progressDot,
                done ? styles.progressDotDone : active ? styles.progressDotActive : null,
              ]}
            >
              <Text style={styles.progressDotText}>{done ? "✓" : String(index + 1)}</Text>
            </View>
            <Text
              style={[
                styles.progressStepLabel,
                done ? styles.progressStepDone : active ? styles.progressStepActive : null,
              ]}
            >
              {label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export function AdminDevanagariPanel({
  initialSongNumber,
}: {
  initialSongNumber?: number
}) {
  const [songNumber, setSongNumber] = useState(
    initialSongNumber && initialSongNumber >= 1 ? String(initialSongNumber) : "1",
  )
  const [song, setSong] = useState<AdminDevanagariSong | null>(null)
  const [draft, setDraft] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [progressKind, setProgressKind] = useState<ProgressKind | null>(
    initialSongNumber && initialSongNumber >= 1 ? "load" : null,
  )
  const [progressStep, setProgressStep] = useState(0)
  const [keyboardPad, setKeyboardPad] = useState(0)
  const progressTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef = useRef<ScrollView>(null)
  const cardOffsetY = useRef(0)
  const editorRelativeY = useRef(0)
  const noteRelativeY = useRef(0)

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardPad(event.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardPad(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const scrollFieldIntoView = (absoluteY: number) => {
    const top = Math.max(0, absoluteY - spacing.lg)
    const run = () => scrollRef.current?.scrollTo({ y: top, animated: true })
    requestAnimationFrame(run)
    // Second pass after the keyboard finishes animating / resizing.
    setTimeout(run, Platform.OS === "ios" ? 280 : 120)
  }

  const clearProgressTimers = () => {
    for (const id of progressTimers.current) clearTimeout(id)
    progressTimers.current = []
  }

  const startProgress = (kind: ProgressKind) => {
    clearProgressTimers()
    setProgressKind(kind)
    setProgressStep(0)
    PROGRESS_STEPS[kind].steps.forEach((_, index) => {
      if (index === 0) return
      progressTimers.current.push(
        setTimeout(() => setProgressStep(index), index * 400),
      )
    })
  }

  const finishProgress = (kind: ProgressKind) => {
    clearProgressTimers()
    setProgressStep(PROGRESS_STEPS[kind].steps.length - 1)
  }

  const endProgress = async (holdMs = 0) => {
    if (holdMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, holdMs))
    }
    clearProgressTimers()
    setProgressKind(null)
    setProgressStep(0)
  }

  const loadSong = useCallback(
    async (number = songNumber) => {
      const n = Number(number)
      if (!Number.isInteger(n) || n < 1) {
        Alert.alert("Devanagari", "Enter a valid song number.")
        return
      }
      setBusy(true)
      setMessage(null)
      setSong(null)
      startProgress("load")
      const result = await api.fetchAdminDevanagari(n)
      if (!result.ok) {
        await endProgress()
        setBusy(false)
        Alert.alert("Devanagari", result.detail)
        return
      }
      finishProgress("load")
      setSong(result.song)
      setDraft(result.song.lyrics_devanagari || "")
      setMessage(`Loaded #${result.song.song_number} · ${result.song.devanagari_status}`)
      await endProgress(320)
      setBusy(false)
    },
    [songNumber],
  )

  useEffect(() => {
    if (initialSongNumber && initialSongNumber >= 1) {
      setSongNumber(String(initialSongNumber))
      void loadSong(String(initialSongNumber))
    }
    return () => clearProgressTimers()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route/feedback picks a song
  }, [initialSongNumber])

  const copyText = async (label: string, text: string) => {
    const value = text.trim()
    if (!value) {
      Alert.alert("Copy", `No ${label} to copy.`)
      return
    }
    try {
      await Clipboard.setStringAsync(value)
      Alert.alert("Copied", `${label} copied.`)
    } catch {
      Alert.alert("Copy", "Could not copy.")
    }
  }

  const save = async (submitForApproval: boolean) => {
    if (!song) return
    if (!draft.trim()) {
      Alert.alert("Devanagari", "Devanagari text is required.")
      return
    }
    const kind: ProgressKind = submitForApproval ? "submit" : "save"
    setBusy(true)
    setMessage(null)
    startProgress(kind)
    const result = await api.updateAdminDevanagari(song.song_number, {
      lyrics_devanagari: draft,
      submit_for_approval: submitForApproval,
      review_note: note.trim() || null,
    })
    if (!result.ok) {
      await endProgress()
      setBusy(false)
      Alert.alert("Devanagari", result.detail)
      return
    }
    finishProgress(kind)
    setSong(result.song)
    setDraft(result.song.lyrics_devanagari || "")
    setMessage(
      submitForApproval
        ? "Saved · pending_review"
        : `Saved · ${result.song.devanagari_status}`,
    )
    await endProgress(320)
    setBusy(false)
  }

  const approve = async () => {
    if (!song) return
    if (!draft.trim()) {
      Alert.alert("Devanagari", "Devanagari text is required before approve.")
      return
    }
    setBusy(true)
    setMessage(null)
    startProgress("approve")
    const result = await api.approveAdminDevanagari(
      song.song_number,
      note.trim() || null,
      draft,
    )
    if (!result.ok) {
      await endProgress()
      setBusy(false)
      Alert.alert("Devanagari", result.detail)
      return
    }
    finishProgress("approve")
    setSong(result.song)
    setDraft(result.song.lyrics_devanagari || "")
    setMessage("Approved — reporters notified by email when contact is set.")
    await endProgress(320)
    setBusy(false)
  }

  const roman = song?.lyrics_original?.trim() || ""
  const loading = progressKind === "load"
  const progressLabel = song
    ? `Song #${song.song_number}`
    : songNumber.trim()
      ? `Song #${songNumber.trim()}`
      : "Devanagari review"

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.section + keyboardPad },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.heroSub}>
        Load a song, compare Roman with editable Devanagari, then save or approve. Copy → edit in
        App/Other Tool → paste back here.
      </Text>

      <View style={styles.grantRow}>
        <TextInput
          value={songNumber}
          onChangeText={setSongNumber}
          keyboardType="number-pad"
          placeholder="Song number"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          editable={!busy}
        />
        <Pressable
          style={styles.actionBtn}
          disabled={busy}
          onPress={() => void loadSong()}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primaryDark} />
          ) : (
            <Text style={styles.actionText}>Load</Text>
          )}
        </Pressable>
      </View>
      {message && !progressKind ? <Text style={styles.message}>{message}</Text> : null}

      {loading && progressKind === "load" ? (
        <ActionProgress kind="load" stepIndex={progressStep} songLabel={progressLabel} />
      ) : null}

      {!loading && song ? (
        <View
          style={styles.card}
          onLayout={(event: LayoutChangeEvent) => {
            cardOffsetY.current = event.nativeEvent.layout.y
          }}
        >
          <View style={styles.cardTop}>
            <Languages size={16} color={colors.primary} />
            <Text style={styles.meta}>
              #{song.song_number} · {song.devanagari_status}
            </Text>
          </View>
          <Text style={styles.snippet}>{song.title}</Text>
          {song.theme ? (
            <Text style={styles.meta}>Theme (not lyrics): {song.theme}</Text>
          ) : null}
          {song.conversion_confidence_percent != null ? (
            <View style={styles.confidenceBox}>
              <Text style={styles.confidenceTitle}>
                Roman→Devanagari confidence: {song.conversion_confidence_percent}%
              </Text>
              {song.song_language ? (
                <Text style={styles.meta}>
                  Language: {song.song_language}
                  {song.review_language ? ` · agent ${song.review_language}` : ""}
                </Text>
              ) : null}
              {song.conversion_notes ? (
                <Text style={styles.meta}>{song.conversion_notes}</Text>
              ) : null}
              {song.regional_grammar_notes ? (
                <Text style={styles.meta}>Regional: {song.regional_grammar_notes}</Text>
              ) : null}
              {(song.review_reasons?.length ?? 0) > 0 ? (
                <Text style={styles.meta}>
                  Reasons: {(song.review_reasons ?? []).slice(0, 6).join(" · ")}
                </Text>
              ) : null}
              {(song.ambiguous_tokens?.length ?? 0) > 0 ? (
                <Text style={styles.meta}>
                  Ambiguous: {(song.ambiguous_tokens ?? []).slice(0, 10).join(", ")}
                </Text>
              ) : null}
              {(song.unsupported_tokens?.length ?? 0) > 0 ? (
                <Text style={[styles.meta, styles.warnMeta]}>
                  Unsupported: {(song.unsupported_tokens ?? []).slice(0, 10).join(", ")}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Roman</Text>
              <Pressable onPress={() => void copyText("Roman", roman)} hitSlop={8}>
                <Text style={styles.copyLink}>Copy</Text>
              </Pressable>
            </View>
            <Text style={styles.lyrics} selectable>
              {roman || "—"}
            </Text>
          </View>

          <View
            style={styles.panel}
            onLayout={(event: LayoutChangeEvent) => {
              editorRelativeY.current = event.nativeEvent.layout.y
            }}
          >
            <View style={styles.panelHead}>
              <Text style={styles.panelTitle}>Devanagari (edit)</Text>
              <Pressable onPress={() => void copyText("Devanagari", draft)} hitSlop={8}>
                <Text style={styles.copyLink}>Copy</Text>
              </Pressable>
            </View>
            <Text style={styles.helper}>Copy → edit in App/Other Tool → paste back here.</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              scrollEnabled
              textAlignVertical="top"
              editable={!busy}
              onFocus={() =>
                scrollFieldIntoView(cardOffsetY.current + editorRelativeY.current)
              }
              style={[styles.editor, busy ? styles.disabledField : null]}
            />
          </View>

          <View
            onLayout={(event: LayoutChangeEvent) => {
              noteRelativeY.current = event.nativeEvent.layout.y
            }}
          >
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Review note (optional)"
              placeholderTextColor={colors.textMuted}
              editable={!busy}
              onFocus={() =>
                scrollFieldIntoView(cardOffsetY.current + noteRelativeY.current)
              }
              style={[styles.noteInput, busy ? styles.disabledField : null]}
            />
          </View>

          {progressKind && progressKind !== "load" ? (
            <ActionProgress
              kind={progressKind}
              stepIndex={progressStep}
              songLabel={progressLabel}
            />
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={styles.actionBtn}
              disabled={busy}
              onPress={() => void save(false)}
            >
              {progressKind === "save" ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <Text style={styles.actionText}>Save provisional</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              disabled={busy}
              onPress={() => void save(true)}
            >
              {progressKind === "submit" ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <Text style={styles.actionText}>Submit for approval</Text>
              )}
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.approveBtn]}
              disabled={busy}
              onPress={() => void approve()}
            >
              {progressKind === "approve" ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <Text style={styles.actionText}>Approve</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : !loading ? (
        <Text style={styles.empty}>Enter a song number and tap Load to review Devanagari.</Text>
      ) : null}
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.section, gap: spacing.md },
  heroSub: { ...typography.bodySmall, color: colors.textSecondary },
  grantRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    ...typography.body,
  },
  actionBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: "center",
  },
  actionText: { ...typography.caption, color: colors.primaryDark },
  approveBtn: { borderWidth: 1, borderColor: colors.primary },
  message: { ...typography.caption, color: colors.primaryDark },
  empty: { ...typography.bodySmall, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...softShadow(1),
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meta: { ...typography.caption, color: colors.textMuted },
  snippet: { ...typography.bodySmall, color: colors.textPrimary },
  confidenceBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.sm,
    gap: 4,
  },
  confidenceTitle: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
  },
  warnMeta: { color: colors.error },
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.xs,
  },
  panelHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: { ...typography.label, color: colors.textPrimary },
  helper: { ...typography.caption, color: colors.textMuted },
  copyLink: {
    ...typography.caption,
    color: colors.primaryDark,
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
  },
  lyrics: { ...typography.body, color: colors.textPrimary },
  editor: {
    minHeight: 200,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodySmall,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  disabledField: { opacity: 0.6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...softShadow(1),
  },
  progressEyebrow: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_600SemiBold",
  },
  progressTitle: { ...typography.body, color: colors.textPrimary, fontFamily: "Inter_600SemiBold" },
  progressActive: { ...typography.bodySmall, color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  progressStepRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border,
  },
  progressDotDone: { backgroundColor: "#D1FAE5" },
  progressDotActive: { backgroundColor: colors.primaryLight },
  progressDotText: { ...typography.caption, fontSize: 10, color: colors.textPrimary },
  progressStepLabel: { ...typography.caption, color: colors.textMuted, flex: 1 },
  progressStepDone: { color: "#065F46" },
  progressStepActive: { color: colors.textPrimary, fontFamily: "Inter_600SemiBold" },
})
