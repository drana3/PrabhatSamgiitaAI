import { memo, useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { Audio } from "expo-av"
import {
  HARMONIUM_PLAY_TEMPOS,
  sampleSongTiming,
  type HarmoniumKeyboardKey,
  type SargamCaptureEvent,
  type SargamCaptureLine,
  type SargamCapturePayload,
} from "@prabhat/core"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react-native"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { SecondaryButton } from "@/components/common/SecondaryButton"
import { VirtualHarmonium } from "@/components/songs/VirtualHarmonium"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import {
  applyLineAction,
  applySavedTake,
  concatenateLines,
  eventsToSheet,
  learnerNotationVisible,
  mergeMutation,
  normalizeCapturePayload,
  sargamTextToEvents,
} from "@/lib/adminSargamCapture"
import { api } from "@/lib/client"
import { playSheetEvents } from "@/lib/harmoniumPlayback"

function CaptureListenPlayer({ url }: { url: string }) {
  const soundRef = useRef<Audio.Sound | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync().catch(() => undefined)
      soundRef.current = null
    }
  }, [url])

  async function togglePlayback() {
    if (loading) return
    if (playing && soundRef.current) {
      await soundRef.current.pauseAsync()
      setPlaying(false)
      return
    }
    setLoading(true)
    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true })
        const created = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true })
        soundRef.current = created.sound
        created.sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return
          setPlaying(status.isPlaying)
          if (status.didJustFinish) {
            void created.sound.setPositionAsync(0)
            setPlaying(false)
          }
        })
      } else {
        await soundRef.current.playAsync()
      }
      setPlaying(true)
    } catch {
      Alert.alert("Listen", "Could not play this recording.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.listenCard}>
      <Text style={styles.sectionEyebrow}>Listen while you capture</Text>
      <Pressable
        style={styles.listenBtn}
        onPress={() => void togglePlayback()}
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause song" : "Play song"}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : playing ? (
          <Pause size={18} color={colors.primaryDark} />
        ) : (
          <Play size={18} color={colors.primaryDark} />
        )}
        <Text style={styles.listenBtnText}>{playing ? "Pause song" : "Play song"}</Text>
      </Pressable>
    </View>
  )
}

const LyricLines = memo(function LyricLines({
  lines,
  activeLine,
  onSelect,
}: {
  lines: SargamCaptureLine[]
  activeLine: number
  onSelect: (lineNumber: number) => void
}) {
  return (
    <View style={styles.lyricList}>
      {lines.map((line) => {
        const active = activeLine === line.line_number
        return (
          <Pressable
            key={line.line_number}
            onPress={() => onSelect(line.line_number)}
            style={[styles.lyricRow, active && styles.lyricRowActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={styles.lyricMeta}>
              Line {line.line_number} · {line.status}
            </Text>
            <Text style={styles.lyricText}>{line.lyric}</Text>
            {line.sargam ? <Text style={styles.lyricSargam}>{line.sargam}</Text> : null}
          </Pressable>
        )
      })}
    </View>
  )
})

type Props = {
  songNumber: number
}

export function AdminSargamCapturePanel({ songNumber }: Props) {
  const [capture, setCapture] = useState<SargamCapturePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [recording, setRecording] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [activeLine, setActiveLine] = useState(1)
  const [notesCaptured, setNotesCaptured] = useState(0)
  const [pasteText, setPasteText] = useState("")
  const [tonic, setTonic] = useState("C")
  const [tempoBpm, setTempoBpm] = useState(HARMONIUM_PLAY_TEMPOS.medium.bpm)
  const [playing, setPlaying] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [pendingRetake, setPendingRetake] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  const originMs = useRef(0)
  const pendingKeys = useRef(new Map<string, { startMs: number; key: HarmoniumKeyboardKey }>())
  const liveEventsRef = useRef<SargamCaptureEvent[]>([])
  const recordingRef = useRef(false)
  const captureRef = useRef<SargamCapturePayload | null>(null)
  const playingRef = useRef(false)

  useEffect(() => {
    recordingRef.current = recording
  }, [recording])

  useEffect(() => {
    captureRef.current = capture
  }, [capture])

  useEffect(() => {
    setPasteText("")
  }, [activeLine])

  const loadCapture = useCallback(async (number: number) => {
    setLoading(true)
    setError("")
    const payload = await api.fetchAdminSargamCapture(number)
    if (!payload) {
      setCapture(null)
      setStudioOpen(false)
      setError("Could not load this song.")
      setLoading(false)
      return
    }
    setCapture(normalizeCapturePayload(payload))
    captureRef.current = normalizeCapturePayload(payload)
    setTonic(payload.source_scale || "C")
    setTempoBpm(payload.tempo_bpm || HARMONIUM_PLAY_TEMPOS.medium.bpm)
    const firstOpen = payload.lines.find((line) => line.status !== "confirmed")
    setActiveLine(firstOpen?.line_number || payload.lines[0]?.line_number || 1)
    setStudioOpen(Boolean(payload.lines.length) && !payload.booklet_locked)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadCapture(songNumber)
  }, [songNumber, loadCapture])

  const currentLine = capture?.lines.find((line) => line.line_number === activeLine)

  const onPressKey = useCallback((key: HarmoniumKeyboardKey) => {
    if (!recordingRef.current) return
    pendingKeys.current.set(key.western, { startMs: Date.now(), key })
  }, [])

  const onReleaseKey = useCallback((key: HarmoniumKeyboardKey) => {
    if (!recordingRef.current) return
    const held = pendingKeys.current.get(key.western)
    pendingKeys.current.delete(key.western)
    if (!held) return
    const startSec = Math.max(0, (held.startMs - originMs.current) / 1000)
    const durationSec = Math.max(0.12, (Date.now() - held.startMs) / 1000)
    const octave = Number(key.western.slice(-1))
    const sargam = octave <= 3 ? `.${key.token}` : octave >= 5 ? `${key.token}'` : key.token
    liveEventsRef.current.push({ sargam, western: key.western, startSec, durationSec })
    setNotesCaptured(liveEventsRef.current.length)
  }, [])

  function cancelRecording() {
    pendingKeys.current.clear()
    liveEventsRef.current = []
    setNotesCaptured(0)
    recordingRef.current = false
    setRecording(false)
  }

  function selectLine(lineNumber: number) {
    if (activeLine === lineNumber) return
    cancelRecording()
    setActiveLine(lineNumber)
    setPasteText("")
  }

  function stepLine(delta: -1 | 1) {
    const snapshot = captureRef.current
    if (!snapshot?.lines.length) return
    const index = snapshot.lines.findIndex((line) => line.line_number === activeLine)
    if (index < 0) return
    const nextIndex = index + delta
    if (nextIndex < 0 || nextIndex >= snapshot.lines.length) return
    selectLine(snapshot.lines[nextIndex].line_number)
  }

  function startRecord() {
    if (capture?.booklet_locked) return
    pendingKeys.current.clear()
    liveEventsRef.current = []
    setNotesCaptured(0)
    originMs.current = Date.now()
    recordingRef.current = true
    setRecording(true)
  }

  async function persistTake(events: SargamCaptureEvent[]) {
    const snapshot = captureRef.current
    const line = snapshot?.lines.find((item) => item.line_number === activeLine)
    if (!snapshot || !line || !events.length) return

    const previous = snapshot
    const optimistic = applySavedTake(snapshot, line.line_number, events)
    setCapture(optimistic)
    captureRef.current = optimistic
    liveEventsRef.current = []
    setNotesCaptured(0)
    recordingRef.current = false
    setRecording(false)

    setPendingSave(true)
    setError("")
    const result = await api.saveAdminSargamTake(snapshot.song_number, line.line_number, {
      events,
      source_scale: tonic,
      tempo_bpm: tempoBpm,
    })
    setPendingSave(false)
    if (!result.ok || !result.patch) {
      setCapture(previous)
      captureRef.current = previous
      setError(result.detail ?? "Could not save this take")
      return
    }
    const merged = mergeMutation(optimistic, result.patch)
    setCapture(merged)
    captureRef.current = merged
  }

  async function stopAndSave() {
    const events = [...liveEventsRef.current]
    if (!events.length) return
    await persistTake(events)
  }

  async function savePastedSargam() {
    const events = sargamTextToEvents(pasteText, tonic, tempoBpm)
    if (!events.length) {
      setError("Paste sargam like Sa Re Ga Ma or सा रे ग म")
      return
    }
    await persistTake(events)
    setPasteText("")
  }

  async function postLine(action: "confirm" | "retake") {
    const snapshot = captureRef.current
    const line = snapshot?.lines.find((item) => item.line_number === activeLine)
    if (!snapshot || !line) return

    const previous = snapshot
    const optimistic = applyLineAction(snapshot, line.line_number, action)
    setCapture(optimistic)
    captureRef.current = optimistic
    if (action === "confirm") {
      const next = optimistic.lines.find((item) => item.status !== "confirmed")
      if (next) selectLine(next.line_number)
    } else {
      liveEventsRef.current = []
      setNotesCaptured(0)
      setPasteText("")
    }

    const setPending = action === "confirm" ? setPendingConfirm : setPendingRetake
    setPending(true)
    setError("")
    const result = await api.postAdminSargamLineAction(snapshot.song_number, line.line_number, action)
    setPending(false)
    if (!result.ok || !result.patch) {
      setCapture(previous)
      captureRef.current = previous
      setError(result.detail ?? `Could not ${action} this line`)
      return
    }
    const merged = mergeMutation(optimistic, result.patch)
    setCapture(merged)
    captureRef.current = merged
  }

  async function playEvents(events: SargamCaptureEvent[]) {
    if (!events.length || playingRef.current) return
    playingRef.current = true
    setPlaying(true)
    try {
      await playSheetEvents(eventsToSheet(events))
    } finally {
      playingRef.current = false
      setPlaying(false)
    }
  }

  async function playFinal() {
    const snapshot = captureRef.current
    if (!snapshot || playingRef.current) return
    playingRef.current = true
    setPlaying(true)
    try {
      const timing = sampleSongTiming(tempoBpm)
      await playSheetEvents(concatenateLines(snapshot.lines, timing.lineRestSec))
    } finally {
      playingRef.current = false
      setPlaying(false)
    }
  }

  async function submitSong() {
    const snapshot = captureRef.current
    if (!snapshot) return
    setPendingSubmit(true)
    setError("")
    const result = await api.submitAdminSargamCapture(snapshot.song_number)
    setPendingSubmit(false)
    if (!result.ok || !result.patch) {
      setError(result.detail ?? "Could not submit this song")
      return
    }
    setCapture((current) => (current ? mergeMutation(current, result.patch!) : current))
    captureRef.current =
      captureRef.current && result.patch ? mergeMutation(captureRef.current, result.patch) : captureRef.current
    Alert.alert("Submitted", "This song’s sargam is now available to learners.")
  }

  function setNotationEnabled(enabled: boolean) {
    const snapshot = captureRef.current
    if (!snapshot || learnerNotationVisible(snapshot.notation_enabled) === enabled) return
    const previous = snapshot
    const optimistic = { ...snapshot, notation_enabled: enabled }
    setCapture(optimistic)
    captureRef.current = optimistic
    setError("")
    void api.setAdminSargamVisibility(snapshot.song_number, enabled).then((result) => {
      if (!result.ok) {
        setCapture(previous)
        captureRef.current = previous
        setError(result.detail ?? "Could not update notation visibility")
        return
      }
      if (result.patch) {
        setCapture((current) => (current ? mergeMutation(current, result.patch!) : current))
        if (captureRef.current) {
          captureRef.current = mergeMutation(captureRef.current, result.patch)
        }
      }
    })
  }

  const lineEvents = currentLine?.events || []
  const previewEvents = recording && notesCaptured > 0 ? liveEventsRef.current : lineEvents
  const activeLineIndex = capture?.lines.findIndex((line) => line.line_number === activeLine) ?? -1
  const lineCount = capture?.lines.length ?? 0
  const learnerVisible = capture ? learnerNotationVisible(capture.notation_enabled) : true

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading song {songNumber}…</Text>
      </View>
    )
  }

  if (!capture) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || "Could not load this song."}</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={88}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <Text style={styles.sectionEyebrow}>Song {capture.song_number}</Text>
          <Text style={styles.heroTitle}>{capture.title}</Text>
          <View style={styles.visibilityCard}>
            <Text style={styles.sectionEyebrow}>Learner notation</Text>
            <Text style={styles.visibilityCopy}>
              {learnerVisible
                ? "Harmonium and sargam are visible on the song page."
                : "Hidden from learners until you show it again."}
            </Text>
            <View style={styles.visibilityRow}>
              <Pressable
                style={[styles.chip, learnerVisible && styles.chipActive]}
                onPress={() => setNotationEnabled(true)}
                accessibilityRole="button"
                accessibilityState={{ selected: learnerVisible }}
              >
                <Text style={[styles.chipText, learnerVisible && styles.chipTextActive]}>Show learners</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, !learnerVisible && styles.chipActive]}
                onPress={() => setNotationEnabled(false)}
                accessibilityRole="button"
                accessibilityState={{ selected: !learnerVisible }}
              >
                <Text style={[styles.chipText, !learnerVisible && styles.chipTextActive]}>Hide learners</Text>
              </Pressable>
            </View>
          </View>
          {capture.booklet_locked ? (
            <Text style={styles.warn}>
              Songs 1, 2, and 27 already have booklet sargam. Recording is locked.
            </Text>
          ) : null}
          {capture.submitted ? (
            <Text style={styles.success}>This song’s sargam is already submitted.</Text>
          ) : null}
          {capture.listen_url ? <CaptureListenPlayer url={capture.listen_url} /> : null}
        </View>

        <Text style={styles.sectionTitle}>Lyrics</Text>
        <LyricLines lines={capture.lines} activeLine={activeLine} onSelect={selectLine} />

        {studioOpen ? (
          <>
            <View style={styles.toolbar}>
              <View style={styles.stepper}>
                <Pressable
                  style={[styles.stepBtn, activeLineIndex <= 0 && styles.stepBtnDisabled]}
                  onPress={() => stepLine(-1)}
                  disabled={activeLineIndex <= 0}
                  accessibilityRole="button"
                  accessibilityLabel="Previous line"
                >
                  <ChevronLeft size={18} color={colors.textPrimary} />
                  <Text style={styles.stepBtnText}>Prev</Text>
                </Pressable>
                <Text style={styles.stepCount}>
                  {activeLineIndex >= 0 ? activeLineIndex + 1 : "–"} / {lineCount || "–"}
                </Text>
                <Pressable
                  style={[styles.stepBtn, activeLineIndex < 0 || activeLineIndex >= lineCount - 1 ? styles.stepBtnDisabled : null]}
                  onPress={() => stepLine(1)}
                  disabled={activeLineIndex < 0 || activeLineIndex >= lineCount - 1}
                  accessibilityRole="button"
                  accessibilityLabel="Next line"
                >
                  <Text style={styles.stepBtnText}>Next</Text>
                  <ChevronRight size={18} color={colors.textPrimary} />
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
                <SecondaryButton
                  fullWidth={false}
                  label={playing ? "Playing…" : "Play line"}
                  onPress={() => void playEvents(previewEvents)}
                  disabled={previewEvents.length === 0 || playing}
                />
                {recording ? (
                  <PrimaryButton
                    fullWidth={false}
                    label={pendingSave ? "Saving…" : "Stop & save"}
                    onPress={() => void stopAndSave()}
                    disabled={notesCaptured === 0 || pendingSave}
                  />
                ) : (
                  <PrimaryButton
                    fullWidth={false}
                    label="Record"
                    onPress={startRecord}
                    disabled={capture.booklet_locked || currentLine?.status === "confirmed"}
                  />
                )}
                <SecondaryButton
                  fullWidth={false}
                  label="Replay saved"
                  onPress={() => void playEvents(lineEvents)}
                  disabled={lineEvents.length === 0 || playing}
                />
                <SecondaryButton
                  fullWidth={false}
                  label={pendingConfirm ? "Confirming…" : "Confirm"}
                  onPress={() => void postLine("confirm")}
                  disabled={pendingConfirm || currentLine?.status !== "recorded"}
                />
                <SecondaryButton
                  fullWidth={false}
                  label={pendingRetake ? "Resetting…" : "Retake"}
                  onPress={() => void postLine("retake")}
                  disabled={pendingRetake || currentLine?.status === "empty"}
                />
                <SecondaryButton
                  fullWidth={false}
                  label="Play full song"
                  onPress={() => void playFinal()}
                  disabled={
                    playing ||
                    (!capture.can_submit && !capture.lines.every((line) => line.status === "confirmed"))
                  }
                />
                <PrimaryButton
                  fullWidth={false}
                  label={pendingSubmit ? "Submitting…" : "Submit song"}
                  onPress={() => void submitSong()}
                  disabled={pendingSubmit || !capture.can_submit}
                />
              </ScrollView>

              {recording ? (
                <Text style={styles.recordingBadge}>
                  Recording… {notesCaptured} note{notesCaptured === 1 ? "" : "s"}
                </Text>
              ) : null}
            </View>

            {currentLine ? (
              <Text style={styles.currentLine}>
                Line {currentLine.line_number}: {currentLine.lyric}
              </Text>
            ) : null}

            <View style={styles.pasteCard}>
              <Text style={styles.sectionEyebrow}>Paste sargam for this line</Text>
              <TextInput
                value={pasteText}
                onChangeText={setPasteText}
                placeholder="Sa Re Ga Ma Pa… or सा रे ग म प…"
                placeholderTextColor={colors.textMuted}
                multiline
                style={styles.pasteInput}
              />
              <PrimaryButton
                label="Save pasted sargam"
                onPress={() => void savePastedSargam()}
                disabled={!pasteText.trim() || capture.booklet_locked || currentLine?.status === "confirmed"}
              />
            </View>

            <VirtualHarmonium
              tonic={tonic}
              onTonicChange={setTonic}
              captureMode
              onTempoBpmChange={setTempoBpm}
              onPressKey={onPressKey}
              onReleaseKey={onReleaseKey}
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: spacing.section, gap: spacing.md },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  loadingText: { ...typography.bodySmall, color: colors.textSecondary },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...softShadow(1),
  },
  sectionEyebrow: {
    ...typography.caption,
    color: colors.spiritualGold,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_600SemiBold",
  },
  heroTitle: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xs },
  visibilityCard: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.sm,
  },
  visibilityCopy: { ...typography.bodySmall, color: colors.textSecondary },
  visibilityRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textPrimary },
  chipTextActive: { color: colors.white, fontFamily: "Inter_600SemiBold" },
  warn: {
    ...typography.bodySmall,
    color: colors.warning,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: "#fff8e8",
  },
  success: { ...typography.bodySmall, color: colors.success, marginTop: spacing.sm, fontFamily: "Inter_600SemiBold" },
  listenCard: {
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  listenBtn: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  listenBtnText: { ...typography.label, color: colors.primaryDark },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  lyricList: { gap: spacing.sm },
  lyricRow: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  lyricRowActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  lyricMeta: { ...typography.caption, color: colors.spiritualGold, textTransform: "uppercase" },
  lyricText: { ...typography.body, color: colors.textPrimary, marginTop: spacing.xs },
  lyricSargam: { ...typography.bodySmall, color: colors.primaryDark, marginTop: spacing.xs },
  toolbar: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...softShadow(1),
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  stepBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { ...typography.caption, color: colors.textPrimary, fontFamily: "Inter_600SemiBold" },
  stepCount: { ...typography.caption, color: colors.textPrimary, minWidth: 48, textAlign: "center" },
  actionRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  recordingBadge: { ...typography.caption, color: colors.error, fontFamily: "Inter_600SemiBold" },
  currentLine: { ...typography.h3, color: colors.textPrimary },
  pasteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pasteInput: {
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    ...typography.bodySmall,
    textAlignVertical: "top",
  },
  tempoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  errorText: { ...typography.bodySmall, color: colors.error },
})
