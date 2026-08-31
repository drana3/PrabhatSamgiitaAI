import { useRef, useState, useMemo } from "react"
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import * as Clipboard from "expo-clipboard"
import { Download, FolderOpen, Repeat, RotateCcw, RotateCw, Trash2, Volume1, Volume2, VolumeX, ChevronDown } from "lucide-react-native"

import { ScenicPlayButton } from "@/components/player/ScenicPlayButton"
import { SeekBar } from "@/components/player/SeekBar"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import {
  offlineAudioPathLabel,
  offlineAudioStorageLabel,
  offlineSaveControls,
  useOfflineAudioStore,
} from "@/lib/offlineAudio"
import { audioFreshnessBadge, audioRecordingLabel } from "@/lib/mediaEmbed"
import { mergeRecordingLists } from "@/lib/songMap"
import { songPlayback } from "@/lib/playback"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore, peekMediaCachedSong } from "@/stores/playerStore"
import { formatDuration } from "@/utils/formatDuration"
import { href } from "@/utils/href"

type Props = {
  songId: string
  songNumber: number
  imageUrl: string
  title: string
  performer: string
  audioUrl?: string | null
  recordings?: Array<{
    title: string
    url: string
    provider: string
    isLatest?: boolean
    isOlder?: boolean
    isLowQuality?: boolean
  }>
  onSelectRecording?: (url: string) => void
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
  recordings = [],
  onSelectRecording,
  onTogglePlay,
  compact = false,
}: Props) {
  const router = useRouter()
  const [showMore, setShowMore] = useState(false)
  const signedIn = useAuthStore((s) => s.mode === "signed_in")
  const offlineEntry = useOfflineAudioStore((s) => s.files[songNumber])
  const downloaded = Boolean(offlineEntry?.fileUri)
  const differentRecording = Boolean(offlineEntry && audioUrl && offlineEntry.remoteUrl !== audioUrl)
  const downloadProgress = useOfflineAudioStore((s) => s.progress[songNumber])
  const waitingForPlayback = useOfflineAudioStore((s) => Boolean(s.waiting[songNumber]))
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
  const mediaCacheRevision = usePlayerStore((s) => s.mediaCacheRevision)
  const playerRecordings = usePlayerStore((s) =>
    s.currentSong?.number === songNumber ? s.currentSong.audioRecordings : undefined,
  )
  const cachedRecordings = useMemo(() => {
    void mediaCacheRevision
    return peekMediaCachedSong(songNumber)?.audioRecordings
  }, [songNumber, mediaCacheRevision])
  const effectiveRecordings = useMemo(
    () => mergeRecordingLists(recordings, playerRecordings, cachedRecordings),
    [recordings, playerRecordings, cachedRecordings],
  )
  const repeat = usePlayerStore((s) => s.repeat)
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat)

  const VolumeIcon = volume <= 0.01 ? VolumeX : volume < 0.45 ? Volume1 : Volume2
  const showTransport = isCurrent && (hasAudio || duration > 0 || position > 0 || showPause || isBuffering)
  const saveUi = offlineSaveControls({
    mode: signedIn ? "signed_in" : "guest",
    downloaded,
    progress: downloadProgress,
    error: downloadError,
    differentRecording,
    waitingForPlayback,
  })
  const downloading = downloadProgress != null

  async function startDownload() {
    if (downloading) return
    if (!audioUrl?.trim()) {
      Alert.alert("Download", "No playable recording is selected yet. Wait for audio to load, then try again.")
      return
    }
    try {
      await download(songNumber, audioUrl, { userInitiated: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Download failed."
      Alert.alert("Download", message)
    }
  }

  async function revealDownloadPath() {
    const path = offlineAudioPathLabel(offlineEntry, songNumber)
    const uri = offlineEntry?.fileUri
    try {
      await Clipboard.setStringAsync(path)
    } catch {
      /* ignore */
    }
    Alert.alert("Saved file", `${path}\n\nFiles stay inside the app (iOS/Android private storage). Path copied.`, [
      { text: "OK", style: "cancel" },
      ...(uri
        ? [
            {
              text: "Share file",
              onPress: () => {
                void Share.share({ url: uri, message: `PS ${songNumber}` }).catch(() => undefined)
              },
            },
          ]
        : []),
    ])
  }

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
  const extraRecordings = effectiveRecordings.slice(1)
  const selectedIndex = Math.max(
    0,
    effectiveRecordings.findIndex((item) => item.url === audioUrl),
  )
  const selectedRecording = effectiveRecordings[selectedIndex]
  const selectedBadge =
    effectiveRecordings.length > 1 && selectedRecording
      ? audioFreshnessBadge({
          isLatest: selectedRecording.isLatest === true,
          isOlder: selectedRecording.isOlder === true,
          isLowQuality: selectedRecording.isLowQuality === true,
        })
      : null
  const listenTitle = selectedRecording
    ? [selectedBadge, audioRecordingLabel(selectedRecording, selectedIndex)].filter(Boolean).join(" · ")
    : "Original rendition"

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
          <Text style={styles.listenTitle}>{listenTitle}</Text>
          <Text style={styles.listenSub}>{performer}</Text>
          {isCurrent && audioError ? <Text style={styles.status}>{audioError}</Text> : null}
          {isCurrent && !audioError && isBuffering ? (
            <Text style={styles.status}>{bufferingLabel}</Text>
          ) : null}
          {isCurrent && !audioError && !isBuffering && !hasAudio && !saveUi.badge ? (
            <Text style={styles.status}>No in-app audio stream for this song yet.</Text>
          ) : null}
        </View>
      </View>

      {!signedIn ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign in to download songs for offline listening"
          onPress={() => router.push(href("/signin"))}
          style={({ pressed }) => [styles.downloadBtn, pressed && styles.ctrlPressed]}
        >
          <Download size={16} color={colors.textPrimary} />
          <Text style={styles.downloadLabel}>Sign in to download</Text>
        </Pressable>
      ) : saveUi.showDownload || saveUi.showDownloading ? (
        <View style={styles.downloadBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Download ${title} for offline listening`}
            disabled={downloading}
            onPress={() => {
              void startDownload()
            }}
            style={({ pressed }) => [styles.downloadBtn, pressed && !downloading && styles.ctrlPressed]}
          >
            {downloading ? (
              <ActivityIndicator color={colors.textPrimary} size="small" />
            ) : (
              <Download size={16} color={colors.textPrimary} />
            )}
            <Text style={styles.downloadLabel}>{saveUi.label}</Text>
          </Pressable>
          {downloading ? (
            <View style={styles.downloadTrack} accessibilityLabel={`Download progress ${saveUi.label}`}>
              <View
                style={[
                  styles.downloadFill,
                  { width: `${Math.round((downloadProgress ?? 0) * 100)}%` },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {saveUi.showSavedLocation ? (
        <View style={styles.savedRow}>
          <Text style={styles.savedLocation}>{offlineAudioStorageLabel(songNumber, offlineEntry)}</Text>
          <View style={styles.savedActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show download path"
              onPress={() => void revealDownloadPath()}
              style={({ pressed }) => [styles.removeSavedBtn, pressed && styles.ctrlPressed]}
            >
              <FolderOpen size={14} color={colors.primaryDark} />
              <Text style={styles.pathBtnText}>Path</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove offline download of ${title}`}
              onPress={() => void removeDownload(songNumber)}
              style={({ pressed }) => [styles.removeSavedBtn, pressed && styles.ctrlPressed]}
            >
              <Trash2 size={14} color={colors.textSecondary} />
              <Text style={styles.removeSavedText}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {saveUi.showError && downloadError ? <Text style={styles.status}>{downloadError}</Text> : null}

      {extraRecordings.length > 0 && onSelectRecording ? (
        <View style={styles.moreWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showMore }}
            accessibilityLabel={`More recordings (${extraRecordings.length})`}
            onPress={() => setShowMore((open) => !open)}
            style={({ pressed }) => [styles.moreToggle, pressed && styles.ctrlPressed]}
          >
            <Text style={styles.moreToggleText}>More recordings ({extraRecordings.length})</Text>
            <View style={{ transform: [{ rotate: showMore ? "180deg" : "0deg" }] }}>
              <ChevronDown size={16} color={colors.primaryDark} />
            </View>
          </Pressable>
          {showMore
            ? effectiveRecordings.map((item, index) => {
                const selected = item.url === audioUrl
                const badge =
                  effectiveRecordings.length > 1
                    ? audioFreshnessBadge({
                        isLatest: item.isLatest === true,
                        isOlder: item.isOlder === true,
                        isLowQuality: item.isLowQuality === true,
                      })
                    : null
                const label = audioRecordingLabel(item, index)
                return (
                  <Pressable
                    key={item.url}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Play ${[badge, label].filter(Boolean).join(" · ")}`}
                    onPress={() => onSelectRecording(item.url)}
                    style={({ pressed }) => [
                      styles.recordingRow,
                      selected && styles.recordingRowSelected,
                      pressed && styles.ctrlPressed,
                    ]}
                  >
                    <View style={styles.recordingCopy}>
                      {badge ? (
                        <Text
                          style={[
                            styles.recordingBadge,
                            item.isLatest && styles.recordingBadgeLatest,
                          ]}
                        >
                          {badge}
                        </Text>
                      ) : null}
                      <Text style={[styles.recordingTitle, selected && styles.recordingTitleSelected]}>
                        {label}
                      </Text>
                    </View>
                    <Text style={styles.recordingAction}>{selected ? "Playing" : "Play"}</Text>
                  </Pressable>
                )
              })
            : null}
        </View>
      ) : null}

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
              accessibilityLabel="Jump forward 10 seconds"
              onPressIn={() => once(() => seekBy(10))}
              hitSlop={8}
              style={({ pressed }) => [styles.ctrlBtn, pressed && styles.ctrlPressed]}
            >
              <RotateCw size={18} color={colors.textPrimary} />
              <Text style={styles.ctrlLabel}>+10s</Text>
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
              accessibilityLabel={repeat ? "Disable repeat" : "Enable repeat"}
              accessibilityState={{ selected: repeat }}
              onPressIn={() => once(() => toggleRepeat())}
              hitSlop={8}
              style={({ pressed }) => [
                styles.ctrlBtn,
                repeat && styles.ctrlBtnActive,
                pressed && styles.ctrlPressed,
              ]}
            >
              <Repeat size={18} color={repeat ? colors.primaryDark : colors.textPrimary} />
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
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  ctrlBtn: {
    minWidth: 48,
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
  ctrlBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  ctrlLabel: { ...typography.caption, color: colors.textPrimary },
  volumeMeter: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 52 },
  volumeText: { ...typography.caption, color: colors.textMuted },
  offline: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  savedRow: {
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  savedLocation: { ...typography.caption, color: colors.textSecondary },
  savedActions: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
  pathBtnText: { ...typography.caption, color: colors.primaryDark, fontFamily: "Inter_600SemiBold" },
  removeSavedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    minHeight: 32,
  },
  removeSavedText: { ...typography.caption, color: colors.textSecondary },
  downloadBlock: { gap: spacing.xs },
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
  downloadTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
    overflow: "hidden",
  },
  downloadFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  moreWrap: { gap: spacing.xs },
  moreToggle: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    paddingHorizontal: spacing.md,
  },
  moreToggleText: { ...typography.label, color: colors.primaryDark },
  recordingRow: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  recordingRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  recordingCopy: { flex: 1, gap: 2 },
  recordingBadge: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontSize: 10,
  },
  recordingBadgeLatest: { color: colors.success },
  recordingTitle: { ...typography.caption, color: colors.textPrimary },
  recordingTitleSelected: { color: colors.textPrimary, fontWeight: "600" },
  recordingAction: { ...typography.caption, color: colors.primaryDark },
})
