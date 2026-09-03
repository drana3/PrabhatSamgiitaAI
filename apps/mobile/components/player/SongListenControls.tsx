import { useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native"
import * as Sharing from "expo-sharing"
import { Download, Repeat, RotateCcw, Share2, Trash2, Volume1, Volume2, VolumeX, ChevronDown } from "lucide-react-native"

import { ScenicPlayButton } from "@/components/player/ScenicPlayButton"
import { SeekBar } from "@/components/player/SeekBar"
import { colors } from "@/constants/colors"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { offlineSaveControls, useOfflineAudioStore } from "@/lib/offlineAudio"
import { audioRecordingLabel } from "@/lib/mediaEmbed"
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
  recordings?: Array<{ title: string; url: string; provider: string }>
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
  const [showMore, setShowMore] = useState(false)
  const signedIn = useAuthStore((s) => s.mode === "signed_in")
  const files = useOfflineAudioStore((s) => s.files)
  const progressMap = useOfflineAudioStore((s) => s.progress)
  const errorsMap = useOfflineAudioStore((s) => s.errors)
  const download = useOfflineAudioStore((s) => s.download)
  const removeDownload = useOfflineAudioStore((s) => s.remove)
  const urlKey = (u?: string | null) => u?.trim() || ""
  const currentKey = urlKey(audioUrl)
  const downloaded = Boolean(files[currentKey])
  const savedPath = files[currentKey]?.fileUri
  const downloadProgress = progressMap[currentKey]
  const downloadError = errorsMap[currentKey]
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
  const repeat = usePlayerStore((s) => s.repeat)
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat)

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
  const extraRecordings = recordings.slice(1)
  const selectedIndex = Math.max(
    0,
    recordings.findIndex((item) => item.url === audioUrl),
  )
  const listenTitle =
    recordings[selectedIndex] ? audioRecordingLabel(recordings[selectedIndex], selectedIndex) : "Original rendition"

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
              void removeDownload(currentKey)
              return
            }
            // Fire-and-forget: play, seek, and navigation stay active during save.
            void download(audioUrl, songNumber, { userInitiated: true }).catch(() => undefined)
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
      {downloaded && savedPath ? (
        <View style={styles.savedActions}>
          <Text style={styles.savedPath} numberOfLines={2}>
            Saved to: {decodeURIComponent(savedPath.replace(/^file:\/\//, ""))}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share downloaded recording"
            onPress={() => {
              void (async () => {
                try {
                  if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(savedPath, {
                      mimeType: "audio/mpeg",
                      dialogTitle: "Share recording",
                    })
                    return
                  }
                  Alert.alert("Share", "Sharing is not available on this device.")
                } catch {
                  Alert.alert("Share", "Could not open the share sheet.")
                }
              })()
            }}
            style={({ pressed }) => [styles.shareBtn, pressed && styles.ctrlPressed]}
          >
            <Share2 size={16} color={colors.textPrimary} />
            <Text style={styles.shareLabel}>Share file</Text>
          </Pressable>
        </View>
      ) : null}

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
            ? recordings.map((item, index) => {
                const selected = item.url === audioUrl
                const recKey = urlKey(item.url)
                const recDownloaded = Boolean(files[recKey])
                const recProgress = progressMap[recKey]
                const recDownloading = recProgress != null
                return (
                  <View
                    key={item.url}
                    style={[styles.recordingRow, selected && styles.recordingRowSelected]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Play ${audioRecordingLabel(item, index)}`}
                      onPress={() => onSelectRecording(item.url)}
                      style={({ pressed }) => [styles.recordingSelect, pressed && styles.ctrlPressed]}
                    >
                      <Text
                        style={[styles.recordingTitle, selected && styles.recordingTitleSelected]}
                      >
                        {audioRecordingLabel(item, index)}
                      </Text>
                      <Text style={styles.recordingAction}>{selected ? "Playing" : "Play"}</Text>
                    </Pressable>
                    {signedIn ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          recDownloaded
                            ? `Remove downloaded ${audioRecordingLabel(item, index)}`
                            : `Download ${audioRecordingLabel(item, index)}`
                        }
                        disabled={recDownloading}
                        hitSlop={6}
                        onPress={() => {
                          if (recDownloaded) {
                            void removeDownload(recKey)
                            return
                          }
                          void download(item.url, songNumber, { userInitiated: true }).catch(
                            () => undefined,
                          )
                        }}
                        style={({ pressed }) => [styles.recordingDl, pressed && styles.ctrlPressed]}
                      >
                        {recDownloading ? (
                          <ActivityIndicator size="small" color={colors.primaryDark} />
                        ) : recDownloaded ? (
                          <Trash2 size={16} color={colors.primaryDark} />
                        ) : (
                          <Download size={16} color={colors.primaryDark} />
                        )}
                      </Pressable>
                    ) : null}
                  </View>
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
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: repeat }}
              accessibilityLabel={repeat ? "Turn off repeat" : "Repeat this song (keeps playing when locked)"}
              onPress={() => once(() => toggleRepeat())}
              hitSlop={8}
              style={({ pressed }) => [
                styles.ctrlBtn,
                repeat && styles.ctrlBtnOn,
                pressed && styles.ctrlPressed,
              ]}
            >
              <Repeat size={18} color={repeat ? colors.white : colors.textPrimary} />
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
  ctrlBtnOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ctrlPressed: {
    opacity: 0.75,
  },
  ctrlLabel: { ...typography.caption, color: colors.textPrimary },
  volumeMeter: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 52 },
  volumeText: { ...typography.caption, color: colors.textMuted },
  offline: { ...typography.caption, color: colors.primary, marginTop: spacing.xs },
  savedPath: { ...typography.caption, color: colors.textMuted, fontSize: 11, flex: 1 },
  savedActions: { gap: spacing.xs },
  shareBtn: {
    minHeight: 40,
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
  shareLabel: { ...typography.label, color: colors.textPrimary },
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
    flexDirection: "row",
    paddingRight: spacing.xs,
  },
  recordingSelect: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  recordingDl: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  recordingTitle: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  recordingTitleSelected: { color: colors.textPrimary, fontWeight: "600" },
  recordingAction: { ...typography.caption, color: colors.primaryDark },
})
