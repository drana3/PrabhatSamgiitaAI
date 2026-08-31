import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native"
import { Audio } from "expo-av"
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react-native"

import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"

const SKIP_SECONDS = 10

type Props = {
  url: string
  compact?: boolean
  onStatusChange?: (status: { playing: boolean; loading: boolean }) => void
}

export function CaptureListenPlayer({ url, compact, onStatusChange }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [positionSec, setPositionSec] = useState(0)
  const [durationSec, setDurationSec] = useState(0)

  useEffect(() => {
    onStatusChange?.({ playing, loading })
  }, [playing, loading, onStatusChange])

  useEffect(() => {
    setPlaying(false)
    setLoading(false)
    setPositionSec(0)
    setDurationSec(0)
    void soundRef.current?.unloadAsync().catch(() => undefined)
    soundRef.current = null
  }, [url])

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync().catch(() => undefined)
      soundRef.current = null
    }
  }, [])

  function bindStatusUpdates(sound: Audio.Sound) {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return
      setPlaying(status.isPlaying)
      setPositionSec(Math.floor(status.positionMillis / 1000))
      setDurationSec(Math.floor((status.durationMillis ?? 0) / 1000))
      if (status.didJustFinish) {
        void sound.setPositionAsync(0)
        setPlaying(false)
        setPositionSec(0)
      }
    })
  }

  async function ensureSound() {
    if (soundRef.current) return soundRef.current
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true })
    const created = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: false })
    soundRef.current = created.sound
    bindStatusUpdates(created.sound)
    return created.sound
  }

  async function togglePlayback() {
    if (loading) return
    if (playing && soundRef.current) {
      await soundRef.current.pauseAsync()
      setPlaying(false)
      return
    }
    setLoading(true)
    try {
      const sound = await ensureSound()
      await sound.playAsync()
      setPlaying(true)
    } catch {
      Alert.alert("Listen", "Could not play this recording.")
    } finally {
      setLoading(false)
    }
  }

  async function skipBy(seconds: number) {
    if (loading) return
    setLoading(true)
    try {
      const sound = await ensureSound()
      const status = await sound.getStatusAsync()
      if (!status.isLoaded) return
      const durationMs = status.durationMillis ?? 0
      const nextMs = Math.max(0, Math.min(durationMs, status.positionMillis + seconds * 1000))
      await sound.setPositionAsync(nextMs)
      setPositionSec(Math.floor(nextMs / 1000))
      if (!status.isPlaying) {
        await sound.playAsync()
        setPlaying(true)
      }
    } catch {
      Alert.alert("Listen", "Could not skip in this recording.")
    } finally {
      setLoading(false)
    }
  }

  function formatClock(totalSec: number) {
    const mins = Math.floor(totalSec / 60)
    const secs = totalSec % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {!compact ? <Text style={styles.eyebrow}>Listen while you capture</Text> : null}
      <View style={[styles.controls, compact && styles.controlsCompact]}>
        <Pressable
          style={[styles.iconBtn, compact && styles.iconBtnCompact]}
          onPress={() => void skipBy(-SKIP_SECONDS)}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={`Rewind ${SKIP_SECONDS} seconds`}
        >
          <RotateCcw size={compact ? 16 : 18} color={colors.primaryDark} />
          {!compact ? <Text style={styles.skipLabel}>{SKIP_SECONDS}s</Text> : null}
        </Pressable>

        <Pressable
          style={[styles.playBtn, compact && styles.playBtnCompact]}
          onPress={() => void togglePlayback()}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause reference song" : "Play reference song"}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryDark} size="small" />
          ) : playing ? (
            <Pause size={compact ? 18 : 20} color={colors.primaryDark} />
          ) : (
            <Play size={compact ? 18 : 20} color={colors.primaryDark} />
          )}
          <Text style={[styles.playText, compact && styles.playTextCompact]}>
            {playing ? "Pause" : "Listen"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.iconBtn, compact && styles.iconBtnCompact]}
          onPress={() => void skipBy(SKIP_SECONDS)}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={`Forward ${SKIP_SECONDS} seconds`}
        >
          <RotateCw size={compact ? 16 : 18} color={colors.primaryDark} />
          {!compact ? <Text style={styles.skipLabel}>{SKIP_SECONDS}s</Text> : null}
        </Pressable>
      </View>
      {durationSec > 0 ? (
        <Text style={[styles.clock, compact && styles.clockCompact]}>
          {formatClock(positionSec)} / {formatClock(durationSec)}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  cardCompact: { padding: spacing.xs, backgroundColor: "transparent", borderWidth: 0 },
  eyebrow: {
    ...typography.caption,
    color: colors.spiritualGold,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_600SemiBold",
    marginBottom: spacing.xs,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  controlsCompact: { gap: spacing.sm },
  iconBtn: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
  },
  iconBtnCompact: { minWidth: 40, minHeight: 36, paddingHorizontal: spacing.xs },
  skipLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2, fontSize: 10 },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    minHeight: 44,
  },
  playBtnCompact: {
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  playText: { ...typography.label, color: colors.primaryDark },
  playTextCompact: { ...typography.caption, color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
  clock: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  clockCompact: { marginTop: 2, fontSize: 10, lineHeight: 12 },
})
