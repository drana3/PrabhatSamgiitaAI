import { useCallback, useEffect, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { NestableScrollContainer } from "react-native-draggable-flatlist"
import { LinearGradient } from "expo-linear-gradient"
import { Car, ListMusic, Shuffle } from "lucide-react-native"

import { ScreenContainer } from "@/components/common/ScreenContainer"
import { useExitDriveOnBlur } from "@/hooks/useExitDriveOnBlur"
import { DriveNowPlaying } from "@/components/drive/DriveNowPlaying"
import { DrivePlaylistAccordion } from "@/components/drive/DrivePlaylistAccordion"
import { DriveReorderableQueue } from "@/components/drive/DriveReorderableQueue"
import { PlaylistSyncBar } from "@/components/playlists/PlaylistSyncBar"
import { colors } from "@/constants/colors"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { playlistPlaybackSubtitle } from "@/lib/playlistPlayback"
import { playPlaylist, starterSongForNumber } from "@/lib/playPlaylist"
import { shouldAutoStartRandomOnDriveFocus } from "@/lib/driveAutoStart"
import { randomPlayableSongNumber } from "@/lib/playableAudio"
import { canStepPlaylist } from "@/lib/playbackQueue"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useAuthStore } from "@/stores/authStore"

export default function DriveScreen() {
  useExitDriveOnBlur()
  const mode = useAuthStore((s) => s.mode)
  const playlists = usePlaylistStore((s) => s.playlists)
  const refresh = usePlaylistStore((s) => s.refresh)
  const current = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const loadSong = usePlayerStore((s) => s.loadSong)
  const enterDrivePlayback = usePlayerStore((s) => s.enterDrivePlayback)
  const next = usePlayerStore((s) => s.next)
  const previous = usePlayerStore((s) => s.previous)
  const seekTo = usePlayerStore((s) => s.seekTo)
  const driveRepeat = usePlayerStore((s) => s.driveRepeat)
  const driveAutoAdvance = usePlayerStore((s) => s.driveAutoAdvance)
  const driveScreenFocused = usePlayerStore((s) => s.driveScreenFocused)
  const toggleDriveRepeat = usePlayerStore((s) => s.toggleDriveRepeat)
  const playlistBounds = usePlayerStore((s) => s.playlistBounds)
  const queue = usePlayerStore((s) => s.queue)
  const activePlaylist = usePlayerStore((s) => s.activePlaylist)
  const drivePlaylistLine = playlistPlaybackSubtitle(
    playbackMode,
    playlistBounds,
    current?.number ?? null,
    activePlaylist,
  )
  const [showPlaylists, setShowPlaylists] = useState(false)
  const [startingRandom, setStartingRandom] = useState(false)
  const drivePlaylistChosenRef = useRef(false)
  const driveFocusSeqRef = useRef(0)

  useEffect(() => {
    if (mode === "signed_in") void refresh()
  }, [mode, refresh])

  const startRandom = useCallback(async (pickNew = false, focusSeq?: number) => {
    const state = usePlayerStore.getState()
    if (!state.driveScreenFocused && !state.driveAutoAdvance) return
    if (
      !pickNew &&
      !drivePlaylistChosenRef.current &&
      state.driveAutoAdvance &&
      state.playbackMode === "random" &&
      state.currentSong
    ) {
      return
    }
    drivePlaylistChosenRef.current = false
    setStartingRandom(true)
    try {
      await usePlayerStore.getState().prepareCatalogAudioForDriveEntry()
      if (focusSeq != null && focusSeq !== driveFocusSeqRef.current) return
      const latest = usePlayerStore.getState()
      if (!latest.driveScreenFocused) return
      enterDrivePlayback()
      if (
        pickNew &&
        latest.playbackMode === "random" &&
        latest.driveAutoAdvance &&
        latest.currentSong
      ) {
        usePlayerStore.getState().next()
        return
      }
      const number = randomPlayableSongNumber(latest.currentSong?.number ?? 0)
      const song = starterSongForNumber(number)
      loadSong(song, [number], "random")
    } finally {
      setStartingRandom(false)
    }
  }, [enterDrivePlayback, loadSong])

  useFocusEffect(
    useCallback(() => {
      const focusSeq = (driveFocusSeqRef.current += 1)
      drivePlaylistChosenRef.current = false
      const state = usePlayerStore.getState()
      if (state.driveAutoAdvance && state.playbackMode === "playlist") {
        drivePlaylistChosenRef.current = true
        return () => {
          driveFocusSeqRef.current += 1
        }
      }
      if (!shouldAutoStartRandomOnDriveFocus(state)) {
        return () => {
          driveFocusSeqRef.current += 1
        }
      }
      const run = () => {
        void startRandom(false, focusSeq)
      }
      if (Platform.OS === "android") {
        const task = InteractionManager.runAfterInteractions(run)
        return () => {
          driveFocusSeqRef.current += 1
          task.cancel()
        }
      }
      run()
      return () => {
        driveFocusSeqRef.current += 1
      }
    }, [startRandom]),
  )

  const driving =
    driveAutoAdvance &&
    driveScreenFocused &&
    (playbackMode === "random" || playbackMode === "playlist")

  const playlistNavQueue = playlistBounds?.length ? playlistBounds : queue
  const canGoNext = canStepPlaylist(playbackMode, current?.number, playlistNavQueue, 1)
  const canGoPrevious = canStepPlaylist(playbackMode, current?.number, playlistNavQueue, -1)

  const handlePrevious = () => {
    if (playbackMode === "random") {
      seekTo(0)
      if (!isPlaying && !isBuffering) togglePlay()
      return
    }
    if (!canGoPrevious) return
    previous()
  }

  const handleNext = () => {
    if (!canGoNext) return
    next()
  }

  const playDrivePlaylist = useCallback(
    (playlist: (typeof playlists)[number], startAt?: number) => {
      if (!usePlayerStore.getState().driveScreenFocused) return
      drivePlaylistChosenRef.current = true
      void (async () => {
        await usePlayerStore.getState().prepareCatalogAudioForDriveEntry()
        if (!usePlayerStore.getState().driveScreenFocused) return
        enterDrivePlayback()
        const error = await playPlaylist(playlist, startAt)
        if (error) Alert.alert("Drive Mode", error)
      })()
    },
    [enterDrivePlayback],
  )

  return (
    <ScreenContainer edges={["top"]} title="Drive Mode" subtitle="Random play by default · pick a playlist to switch">
      <PlaylistSyncBar />
      <NestableScrollContainer
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play random Prabhat Samgiita"
          disabled={startingRandom}
          onPress={() => void startRandom(true)}
          style={({ pressed }) => [
            styles.modeCard,
            playbackMode === "random" && driveAutoAdvance && styles.modeCardActive,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={[colors.primaryLight, colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modeIcon}>
            <Shuffle size={22} color={colors.primaryDark} />
          </View>
          <Text style={styles.modeTitle}>Random Prabhat Samgiita</Text>
          <Text style={styles.modeBody}>
            {playbackMode === "random" && driveAutoAdvance
              ? "Now playing · tap for another random song"
              : "Starts automatically when you open Drive"}
          </Text>
          {startingRandom ? (
            <ActivityIndicator style={styles.modeSpinner} color={colors.primary} />
          ) : null}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play a playlist"
          onPress={() => setShowPlaylists((value) => !value)}
          style={({ pressed }) => [
            styles.modeCard,
            playbackMode === "playlist" && driveAutoAdvance && styles.modeCardActive,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.modeIcon}>
            <ListMusic size={22} color={colors.primaryDark} />
          </View>
          <Text style={styles.modeTitle}>Your playlist</Text>
          <Text style={styles.modeBody}>
            {showPlaylists ? "Tap a playlist to expand · ▶ to play" : "Tap to show your playlists"}
          </Text>
        </Pressable>

        {showPlaylists ? (
          mode === "signed_in" ? (
            <DrivePlaylistAccordion playlists={playlists} onPlayPlaylist={playDrivePlaylist} />
          ) : (
            <Text style={styles.modeBody}>Playlist playback requires you to sign in.</Text>
          )
        ) : null}
        {showPlaylists && mode === "signed_in" && !playlists.length ? (
          <Text style={styles.modeBody}>Create a playlist from the Saved tab first.</Text>
        ) : null}

        {driving && current ? (
          <>
            <DriveNowPlaying
              song={current}
              mode={playbackMode}
              isPlaying={isPlaying}
              isBuffering={isBuffering}
              position={position}
              duration={duration}
              onSeek={seekTo}
              onTogglePlay={togglePlay}
              onPrevious={handlePrevious}
              onNext={handleNext}
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              driveRepeat={driveRepeat}
              onToggleDriveRepeat={toggleDriveRepeat}
              playlistSubtitle={drivePlaylistLine}
            />
            <DriveReorderableQueue />
          </>
        ) : (
          <View style={styles.hint}>
            <Car size={18} color={colors.textMuted} />
            <Text style={styles.hintText}>Starting random play…</Text>
          </View>
        )}
      </NestableScrollContainer>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: 160 },
  modeCard: {
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    ...(Platform.OS === "android" ? { elevation: 0 } : softShadow(1)),
  },
  pressed: { opacity: 0.94 },
  modeCardActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  modeTitle: { fontFamily: "Lora_700Bold", fontSize: 22, lineHeight: 28, color: colors.textPrimary },
  modeBody: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  modeSpinner: { marginTop: spacing.sm, alignSelf: "flex-start" },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
  },
  hintText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
})
