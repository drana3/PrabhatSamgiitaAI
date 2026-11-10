import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { RadioCategoryStrip } from "@/components/radio/RadioCategoryStrip"
import { useRadioPools } from "@/hooks/useRadioPools"
import { PlaylistSyncBar } from "@/components/playlists/PlaylistSyncBar"
import { softShadow } from "@/constants/shadows"
import { radius, spacing } from "@/constants/spacing"
import { typography } from "@/constants/typography"
import { amColors, amDarkSurface, type AmTheme } from "@/constants/tokens/amColors"
import { useAmTheme, useResolvedAppearance } from "@/hooks/useAmTheme"
import { useT } from "@/lib/i18n"
import { playlistPlaybackSubtitle } from "@/lib/playlistPlayback"
import { playPlaylist } from "@/lib/playPlaylist"
import { trackForNumber } from "@/lib/kirtan/mixPlayback"
import { shouldAutoStartRandomOnDriveFocus } from "@/lib/driveAutoStart"
import { randomPlayableSongNumber } from "@/lib/playableAudio"
import { canStepPlaylist } from "@/lib/playbackQueue"
import { startRadioMix } from "@/lib/radio/live"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePlayerStore } from "@/stores/playerStore"
import { useAuthStore } from "@/stores/authStore"

export default function DriveScreen() {
  const t = useT()
  const theme = useAmTheme()
  const dark = useResolvedAppearance() === "dark"
  const styles = useMemo(() => makeStyles(theme), [theme])
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
  const radioChosen = useRadioPools().chosen // the first card names what the Radio plays: songs only, or a mix of categories
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
      startRadioMix() // a fresh radio: a new seed, and the chosen categories from the first track
      const number = randomPlayableSongNumber(latest.currentSong?.number ?? 0)
      // trackForNumber: a catalogue song, or a recording when the chosen categories include recordings
      const song = trackForNumber(number)
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
        if (error) Alert.alert(t("radio.title"), error)
      })()
    },
    [enterDrivePlayback, t],
  )

  return (
    <ScreenContainer themed edges={["top"]} title={t("radio.title")} subtitle={t("radio.subtitle")}>
      <PlaylistSyncBar />
      <NestableScrollContainer
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("radio.random.a11y")}
          disabled={startingRandom}
          onPress={() => void startRandom(true)}
          style={({ pressed }) => [
            styles.modeCard,
            playbackMode === "random" && driveAutoAdvance && styles.modeCardActive,
            pressed && styles.pressed,
          ]}
        >
          <LinearGradient
            colors={[dark ? amDarkSurface.peach : amColors.orange100, theme.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.modeIcon}>
            <Shuffle size={22} color={theme.accentText} />
          </View>
          <Text style={styles.modeTitle}>{radioChosen.length === 1 && radioChosen[0] === "prabhat_samgiita" ? t("radio.random.title") : t("radio.mix.title")}</Text>
          <Text style={styles.modeBody}>
            {playbackMode === "random" && driveAutoAdvance
              ? t("radio.random.playing")
              : t("radio.random.idle")}
          </Text>
          {startingRandom ? (
            <ActivityIndicator style={styles.modeSpinner} color={theme.accentBright} />
          ) : null}
        </Pressable>

        <RadioCategoryStrip />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("radio.list.a11y")}
          onPress={() => setShowPlaylists((value) => !value)}
          style={({ pressed }) => [
            styles.modeCard,
            playbackMode === "playlist" && driveAutoAdvance && styles.modeCardActive,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.modeIcon}>
            <ListMusic size={22} color={theme.accentText} />
          </View>
          <Text style={styles.modeTitle}>{t("radio.list.title")}</Text>
          <Text style={styles.modeBody}>
            {showPlaylists ? t("radio.list.open") : t("radio.list.closed")}
          </Text>
        </Pressable>

        {showPlaylists ? (
          mode === "signed_in" ? (
            <DrivePlaylistAccordion playlists={playlists} onPlayPlaylist={playDrivePlaylist} />
          ) : (
            <Text style={styles.modeBody}>{t("radio.list.signIn")}</Text>
          )
        ) : null}
        {showPlaylists && mode === "signed_in" && !playlists.length ? (
          <Text style={styles.modeBody}>{t("radio.list.none")}</Text>
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
            <Car size={18} color={theme.textMuted} />
            <Text style={styles.hintText}>{t("radio.starting")}</Text>
          </View>
        )}
      </NestableScrollContainer>
    </ScreenContainer>
  )
}

const makeStyles = (theme: AmTheme) => StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingBottom: 160 },
  modeCard: {
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: theme.line,
    padding: spacing.lg,
    overflow: "hidden",
    backgroundColor: theme.card,
    ...(Platform.OS === "android" ? { elevation: 0 } : softShadow(1)),
  },
  pressed: { opacity: 0.94 },
  modeCardActive: {
    borderColor: theme.controlOn,
    borderWidth: 2,
  },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  modeTitle: { fontFamily: "Lora_700Bold", fontSize: 22, lineHeight: 28, color: theme.textHeading },
  modeBody: { ...typography.bodySmall, color: theme.textBody, marginTop: spacing.xs },
  modeSpinner: { marginTop: spacing.sm, alignSelf: "flex-start" },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: theme.inner,
  },
  hintText: { ...typography.bodySmall, color: theme.textBody, flex: 1 },
})
