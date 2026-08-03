import { useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { Mic, X } from "lucide-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { PrimaryButton } from "@/components/common/PrimaryButton"
import { SecondaryButton } from "@/components/common/SecondaryButton"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import {
  humanizeSpeechRecognitionError,
  isLikelyIosSimulator,
  isNativeSpeechRecognitionAvailable,
  startNativeSpeechRecognition,
  stopNativeSpeechRecognition,
} from "@/lib/speechRecognition"

type Props = {
  visible: boolean
  busy?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (transcript: string) => void
}

/**
 * Voice search: native STT when the speech-recognition native module is present
 * (dev/production builds). Otherwise falls back to keyboard dictation + text.
 * Both paths still hit POST /api/v1/search/voice for interpretation.
 */
export function VoiceSearchModal({ visible, busy, error, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets()
  const [transcript, setTranscript] = useState("")
  const [listening, setListening] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)
  const [nativeAvailable, setNativeAvailable] = useState(false)
  const stopRef = useRef<null | (() => void)>(null)

  useEffect(() => {
    setNativeAvailable(isNativeSpeechRecognitionAvailable())
  }, [])

  useEffect(() => {
    if (visible) {
      setTranscript("")
      setSpeechError(null)
      setListening(false)
    } else {
      stopRef.current?.()
      stopRef.current = null
      stopNativeSpeechRecognition()
    }
  }, [visible])

  useEffect(() => {
    return () => {
      stopRef.current?.()
      stopNativeSpeechRecognition()
    }
  }, [])

  const startListening = async () => {
    setSpeechError(null)
    // Soft-stop only — hard abort()+immediate start causes Apple error 209.
    if (stopRef.current) {
      stopRef.current()
      stopRef.current = null
      stopNativeSpeechRecognition()
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    try {
      setListening(true)
      stopRef.current = await startNativeSpeechRecognition({
        onPartial: (text) => setTranscript(text),
        onFinal: (text) => setTranscript(text),
        onError: (message) => {
          if (!message) return
          setSpeechError(message)
          setListening(false)
        },
        onEnd: () => setListening(false),
      })
    } catch (err) {
      setListening(false)
      setSpeechError(
        humanizeSpeechRecognitionError(
          err instanceof Error ? err.message : "Could not start speech recognition.",
          { onSimulator: isLikelyIosSimulator() },
        ),
      )
    }
  }

  const stopListening = () => {
    stopRef.current?.()
    stopRef.current = null
    stopNativeSpeechRecognition()
    setListening(false)
  }

  const onSimulator = isLikelyIosSimulator()
  const combinedError =
    speechError ||
    (error ? humanizeSpeechRecognitionError(error, { onSimulator }) : null)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
          onPress={() => {}}
        >
          <View style={styles.header}>
            <View style={[styles.micMark, listening && styles.micMarkActive]}>
              <Mic size={22} color={listening ? colors.white : colors.primaryDark} />
            </View>
            <Text style={styles.title}>Voice search</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.lead}>
            {nativeAvailable
              ? onSimulator
                ? "On Simulator: enable I/O → Audio Input → Mac microphone, or type a query below. On a real iPhone, tap Start listening and speak."
                : "Tap Start listening, speak a song number or theme, then search."
              : "Native mic listening needs a rebuilt app (not Expo Go). For now, use keyboard dictation or type."}
          </Text>

          {nativeAvailable ? (
            listening ? (
              <SecondaryButton label="Stop listening" onPress={stopListening} />
            ) : (
              <PrimaryButton label="Start listening" onPress={() => void startListening()} disabled={busy} />
            )
          ) : null}

          <TextInput
            autoFocus={!nativeAvailable}
            value={transcript}
            onChangeText={setTranscript}
            placeholder="e.g. morning meditation song"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            accessibilityLabel="Voice search transcript"
            editable={!busy}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (transcript.trim()) onSubmit(transcript.trim())
            }}
          />
          {combinedError ? <Text style={styles.error}>{combinedError}</Text> : null}
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.busyText}>Interpreting through the catalog…</Text>
            </View>
          ) : (
            <PrimaryButton
              label="Search with voice"
              onPress={() => {
                stopListening()
                if (transcript.trim()) onSubmit(transcript.trim())
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    ...softShadow(2),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  micMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  micMarkActive: {
    backgroundColor: colors.primary,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    flex: 1,
  },
  lead: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
  busy: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  busyText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
})
