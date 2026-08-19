import { useRef } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import { Download, RotateCcw, Trash2, Volume1, Volume2, VolumeX } from "lucide-react-native"

import { ScenicPlayButton } from "@/components/player/ScenicPlayButton"
import { SeekBar } from "@/components/player/SeekBar"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { offlineSaveControls, useOfflineAudioStore } from "@/lib/offlineAudio"
import { songPlayback } from "@/lib/playback"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { formatDuration } from "@/utils/formatDuration"

type Props = {
  songId: string
  songNumber: number
  imageUrl: string
  title: string
  performer: string
  audioUrl?: string | null
  onTogglePlay: () => void
  /** Slim transport while reading lyrics/meaning. */
  compact?: boolean
}

export function SongListenControls({
  songId,
  songNumber,
  imageUrl,
  title,
  performer,
  audioUrl,
  onTogglePlay,
  compact = false,
}: Props) {
  const signedIn = useAuthStore((s) => s.mode === "signed_in")
  const downloaded = useOfflineAudioStore((s) => Boolean(s.files[songNumber]))
  const downloadProgress = useOfflineAudioStore((s) => s.progress[songNumber])
  const downloadError = useOfflineAudioStore((s) => s.errors[songNumber])
  const download = useOfflineAudioStore((s) => s.download)
  const removeDownload = useOfflineAudioStore((s) => s.remove)
  const showPause = usePlayerStore((s) => songPlayback(s, { id: songId, number: songNumber }).showPause)
  const isCurrent = usePlayerStore((s) => songPlayback(s, { id: songId, number: songNumber }).isCurrent)
  const isBuffering = usePlayerStore((s) =>
    songPlayback(s, { id: songId, number: songNumber }).isBuffering,
  )
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const volume = usePlayerStore((s) => s.volume)
  const audioError = usePlayerStore((s) => s.audioError)
  const hasAudio = usePlayerStore((s) => s.hasAudio)
  const seekTo = usePlayerStore((s) => s.seekTo)
  const seekBy = usePlayerStore((s) => s.seekBy)
  const adjustVolume = usePlayerStore((s) => s.adjustVolume)
  const pause = usePlayerStore((s) => s.pause)

  const VolumeIcon = volume <= 0.01 ? VolumeX : volume < 0.45 ? Volume1 : Volume2
  const showTransport = isCurrent && (hasAudio || duration > 0 || position > 0 || showPause || isBuffering)
  const saveUi = offlineSaveControls({
    mode: signedIn ? "signed_in" : "guest",
    downloaded,
    progress: downloadProgress,
    error: downloadError,
  })
  const downloading = downloadProgress != null
  const lastCtrl = useRef(0)
  const once = (fn: () => void) => {
    const now = Date.now()
    if (now - lastCtrl.current < 300) return
    lastCtrl.current = now
    fn()
  }

  const handlePlayPress = () => {
    if (showPause) pause()
    else onTogglePlay()
  }

  const bufferingLabel = saveUi.bufferingLabel

  if (compact) {
    return (
      <View style={styles.compactCard}>
        <ScenicPlayButton
          imageUrl={imageUrl}
          size="sm"
          isPlaying={showPause}
          onPress={handlePlayPress}
          accessibilityLabel={showPause ? `Pause ${title}` : `Play ${title}`}
        />
        <View style={styles.compactTransport}>
          {showTransport ? (
            <>
              <SeekBar position={position} duration={duration} onSeek={seekTo} />
              <View style={styles.timeRow}>
                <Text style={styles.time}>{formatDuration(position)}</Text>
                <Text style={styles.time}>{formatDuration(duration)}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.listenSub} numberOfLines={1}>
              {isBuffering ? bufferingLabel : performer}
            </Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.playWrap}>
          <ScenicPlayButton
            imageUrl={imageUrl}
            size="md"
            isPlaying={showPause}
            onPress={handlePlayPress}
            accessibilityLabel={showPause ? `Pause ${title}` : `Play ${title}`}
          />
          {isBuffering ? (
            <View style={styles.bufferOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.white} size="small" />
            </View>
          ) : null}
        </View>
        <View style={styles.meta}>
          <Text style={styles.listenTitle}>Original rendition</Text>
          <Text style={styles.listenSub}>{performer}</Text>
          {isCurrent && audioError ? <Text style={styles.status}>{audioError}</Text> : null}
          {isCurrent && !audioError && isBuffering ? (
            <Text style={styles.status}>{bufferingLabel}</Text>
          ) : null}
          {isCurrent && !audioError && !isBuffering && !hasAudio && !saveUi.badge ? (
            <Text style={styles.status}>No in-app audio stream for this song yet.</Text>
          ) : null}
          {saveUi.badge && !isBuffering ? (
            <Text style={styles.offline}>Available offline</Text>
          ) : null}
        </View>
      </View>

      {saveUi.visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            downloaded ? `Remove in-app copy of ${title}` : `Save ${title} in this app for offline play`
          }
          disabled={downloading}
          onPress={() => {
            if (downloaded) {
              void removeDownload(songNumber)
              return
            }
            // Fire-and-forget: play, seek, and navigation stay active during save.
            void download(songNumber, audioUrl, { userInitiated: true }).catch(() => undefined)
          }}
          style={({ pressed }) => [styles.downloadBtn, pressed && styles.ctrlPressed]}
        >
          {downloading ? (
            <ActivityIndicator color={colors.textPrimary} size="small" />
          ) : downloaded ? (
            <Trash2 size={16} color={colors.textPrimary} />
          ) : (
            <Download size={16} color={colors.textPrimary} />
          )}
          <Text style={styles.downloadLabel}>{saveUi.label}</Text>
        </Pressable>
      ) : null}
      {saveUi.showError && downloadError ? <Text style={styles.status}>{downloadError}</Text> : null}

      {showTransport ? (
        <View style={styles.transport}>
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Jump back 10 seconds"
              onPressIn={() => once(() => seekBy(-10))}
              hitSlop={8}
              style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]}
            >
              <RotateCcw size={18} color={colors.textPrimary} />
              <Text style={styles.ctrlLabel}>-10s</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volume down"
              onPressIn={() => once(() => adjustVolume(-0.15))}
              hitSlop={8}
              style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]}
            >
              <Volume1 size={18} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.volumeMeter} pointerEvents="none">
              <VolumeIcon size={16} color={colors.textMuted} />
              <Text style={styles.volumeText}>{Math.round(volume * 100)}%</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Volume up"
              onPressIn={() => once(() => adjustVolume(0.15))}
              hitSlop={8}
              style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]}
            >
              <Volume2 size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <SeekBar position={position} duration={duration} onSeek={seekTo} />
          <View style={styles.timeRow}>
            <Text style={styles.time}>{formatDuration(position)}</Text>
            <Text style={styles.time}>{formatDuration(duration)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  compactTransport: { flex: 1, gap: 2 },
  card: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  playWrap: {
    width: 72,
    height: 72,
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,14,10,0.35)",
    borderRadius: radius.lg,
  },
  meta: { flex: 1 },
  listenTitle: { ...typography.label, color: colors.textPrimary },
  listenSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  status: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  transport: {
    gap: spacing.xs,
  },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  time: { ...typography.caption, color: colors.textMuted },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  ctrlBtn: {
    minWidth: 52,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: spacing.sm,
  },
  ctrlPressed: {
    opacity: 0.75,
  },
  ctrlLabel: { ...typography.caption, color: colors.textPrimary },
  volumeMeter: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 52 },
  volumeText: { ...typography.caption, color: colors.textMuted },
  offline: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  downloadBtn: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  downloadLabel: { ...typography.label, color: colors.textPrimary },
})
