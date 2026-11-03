import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { useRouter } from "expo-router"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"
import { SafeAreaView } from "react-native-safe-area-context"
import { Car, ChevronDown, Ellipsis, Heart, ListMusic, ListPlus, Type } from "lucide-react-native"

import { DriveControls } from "@/components/player-v2/DriveControls"
import { EmptyPlayer, type EmptyAction } from "@/components/player-v2/EmptyPlayer"
import { LyricsOptionsSheet } from "@/components/player-v2/LyricsOptionsSheet"
import { LyricsPanel } from "@/components/player-v2/LyricsPanel"
import { PlaybackSheet } from "@/components/player-v2/PlaybackSheet"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { QueueSheet, type QueueRow } from "@/components/player-v2/QueueSheet"
import { Scrubber } from "@/components/player-v2/Scrubber"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { TransportRow } from "@/components/player-v2/TransportRow"
import { PlayModeToggle, VersionChip } from "@/components/player-v2/VersionControls"
import { VersionsSheet } from "@/components/player-v2/VersionsSheet"
import { Reveal } from "@/components/today/motion"
import { brandAssets } from "@/constants/brand"
import { amGap, amSpace, amTouchTarget } from "@/constants/tokens/amSpacing"
import { amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { hasPlayableAudio, randomPlayableSongNumber } from "@/lib/playableAudio"
import { hydratePlayableSong } from "@/lib/playback/radioAdvance"
import { playlistSongNumbers, playPlaylist } from "@/lib/playPlaylist"
import {
  activeQueue,
  canGoNext,
  goNext,
  goPrevious,
  playNumber,
  playVersion,
} from "@/lib/playerV2/controller"
import {
  activeLineIndex,
  activeWordIndex,
  alignTranslation,
  buildLyricLines,
  lineTimings,
  seekTargetForLine,
  splitLines,
  splitWords,
} from "@/lib/playerV2/lyricsSync"
import { clampRate } from "@/lib/playerV2/playbackSpeed"
import { sourceLabel } from "@/lib/playerV2/queueOps"
import { realControllerDeps, realQueueActions, startPlayerV2Services } from "@/lib/playerV2/services"
import { sleepLabel } from "@/lib/playerV2/sleepTimer"
import { knownDuration, playButtonState } from "@/lib/playerV2/transportState"
import {
  effectivePlayMode,
  versionPositionLabel,
} from "@/lib/playerV2/versionMode"
import { selectedVersionIndex, versionsFromSong, versionSummary } from "@/lib/playerV2/versions"
import { readTodayCache } from "@/lib/todayCache"
import { todayItemToMockSong } from "@/lib/today"
import { recentPlayToSong } from "@/lib/todayView"
import { offlineRecordingState, useOfflineAudioStore } from "@/lib/offlineAudio"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayerV2Store } from "@/stores/playerV2Store"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { useResumeStore } from "@/stores/resumeStore"
import { resumePositionFor } from "@/lib/playerV2/resume"
import type { MockSong } from "@/data/mock"
import { href } from "@/utils/href"

/**
 * Player (spec SCR-12). Redesign screen, reachable at /player-v2 until the
 * tab bar branch makes it the Player tab. Dark forest ground in both themes,
 * the photograph fading in from the top, a karaoke lyric panel, version chip
 * with "This version / All N versions", transport, and the queue, versions,
 * lyrics and playback sheets. One audio engine: this screen only renders
 * playerStore state and sends commands to it.
 */
export default function PlayerV2Screen() {
  const router = useRouter()
  const theme = useAmTheme()

  useEffect(() => {
    startPlayerV2Services()
  }, [])

  const song = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const audioError = usePlayerStore((s) => s.audioError)
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const rate = usePlayerStore((s) => s.rate)
  const legacyRepeat = usePlayerStore((s) => s.repeat)
  const queue = usePlayerStore((s) => s.queue)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const playlistBounds = usePlayerStore((s) => s.playlistBounds)
  const activePlaylist = usePlayerStore((s) => s.activePlaylist)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const play = usePlayerStore((s) => s.play)
  const seekTo = usePlayerStore((s) => s.seekTo)
  const setRate = usePlayerStore((s) => s.setRate)
  const toggleLegacyRepeat = usePlayerStore((s) => s.toggleRepeat)
  const storeNext = usePlayerStore((s) => s.next)
  const storePrevious = usePlayerStore((s) => s.previous)

  const v2 = usePlayerV2Store()
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const toggleSaved = usePreferencesStore((s) => s.toggleSaved)
  const recentPlays = usePreferencesStore((s) => s.recentPlays)
  const resumeEntries = useResumeStore((s) => s.entries)
  const playlists = usePlaylistStore((s) => s.playlists)
  const authMode = useAuthStore((s) => s.mode)
  const offlineFiles = useOfflineAudioStore((s) => s.files)
  const offlineProgress = useOfflineAudioStore((s) => s.progress)
  const offlineErrors = useOfflineAudioStore((s) => s.errors)
  const offlineActive = useOfflineAudioStore((s) => s.activeBySong)
  const downloadAudio = useOfflineAudioStore((s) => s.download)
  const removeAudio = useOfflineAudioStore((s) => s.remove)
  const stopIfPlayingLocalUri = usePlayerStore((s) => s.stopIfPlayingLocalUri)

  const [sheet, setSheet] = useState<null | "versions" | "queue" | "lyrics" | "playback">(null)
  const [drive, setDrive] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [todaySong, setTodaySong] = useState<MockSong | null>(null)

  // The legacy repeat flag is the engine's "loop this track". Keep it in step with repeat "one".
  useEffect(() => {
    const wantOne = v2.repeatMode === "one"
    if (legacyRepeat !== wantOne) toggleLegacyRepeat()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v2.repeatMode])

  // Sleep timer countdown label ticks once a second only while a timer runs.
  useEffect(() => {
    if (v2.sleep.kind !== "minutes") return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [v2.sleep.kind])

  // Drive mode keeps the screen awake.
  useEffect(() => {
    if (!drive) return
    void activateKeepAwakeAsync("player-v2-drive").catch(() => undefined)
    return () => {
      void deactivateKeepAwake("player-v2-drive").catch(() => undefined)
    }
  }, [drive])

  useEffect(() => {
    let alive = true
    void readTodayCache().then((cache) => {
      const first = cache?.recommendations?.[0]
      if (alive && first) setTodaySong(todayItemToMockSong(first, 0))
    })
    return () => {
      alive = false
    }
  }, [])

  const deps = useMemo(() => realControllerDeps(), [])
  const queueActions = useMemo(() => realQueueActions(), [])

  const versions = useMemo(() => (song ? versionsFromSong(song) : []), [song])
  const versionIndex = song
    ? selectedVersionIndex(versions, song.audioUrl, v2.versionByNumber[String(song.number)])
    : -1
  const selectedVersion = versions[versionIndex]
  const mode = effectivePlayMode(v2.playMode, versions.length)

  const playState = playButtonState({ isPlaying, isBuffering, audioError })
  const knownLength = knownDuration({
    duration,
    position,
    isBuffering,
    placeholder: song?.durationSeconds,
  })

  // Lyrics
  const romanLines = useMemo(() => splitLines(song?.lyrics), [song?.lyrics])
  const devanagariLines = useMemo(() => splitLines(song?.lyricsDevanagari), [song?.lyricsDevanagari])
  const useDevanagari = v2.script === "devanagari" && devanagariLines.length > 0
  const scriptLines = useDevanagari ? devanagariLines : romanLines
  const aligned = useMemo(() => alignTranslation(scriptLines, song?.translation), [scriptLines, song?.translation])
  const showTranslation = v2.translation === "en" && aligned != null
  const lyricLines = useMemo(
    () => buildLyricLines(scriptLines, showTranslation ? aligned : null),
    [scriptLines, aligned, showTranslation],
  )
  const timings = useMemo(() => lineTimings(scriptLines, knownLength ?? 0), [scriptLines, knownLength])
  const activeLine = activeLineIndex(timings, position)
  const activeWord =
    activeLine >= 0 ? activeWordIndex(splitWords(scriptLines[activeLine] ?? ""), timings[activeLine]!, position) : -1

  const playableOrUnknown = useCallback((n: number) => hasPlayableAudio(n), [])

  const savedNumbers = useMemo(() => {
    const set = new Set<number>()
    for (const id of savedSongIds) {
      const n = Number(/^ps-(\d+)$/i.exec(id)?.[1])
      if (Number.isFinite(n) && n > 0) set.add(n)
    }
    return set
  }, [savedSongIds])
  const isSaved = song ? savedSongIds.includes(song.id) : false

  const list = song
    ? activeQueue({ currentSong: song, queue, playbackMode, playlistBounds, position })
    : queue
  const queueRows: QueueRow[] = useMemo(() => {
    if (sheet !== "queue") return []
    const titles = new Map(
      catalogSongsByNumbers(list, list.length).map((hit) => [hit.number, hit.firstLine || hit.title]),
    )
    return list.map((number) => ({
      key: `ps-${number}`,
      number,
      title: titles.get(number) ?? `Prabhat Samgiita ${number}`,
    }))
  }, [sheet, list])
  const source = sourceLabel({ playbackMode, playlistName: activePlaylist?.name ?? null })

  // Offline state of the selected version, for the Download pill in the Versions sheet.
  const offline = offlineRecordingState(
    selectedVersion?.url,
    { files: offlineFiles, progress: offlineProgress, errors: offlineErrors, activeBySong: offlineActive },
    { songNumber: song?.number },
  )
  const downloadPill = !song || !selectedVersion
    ? null
    : authMode !== "signed_in"
      ? { label: "Sign in to download", disabled: false, onPress: () => router.push(href("/signin")) }
      : offline.downloading
        ? {
            label: `Downloading ${Math.round((offline.progress ?? 0) * 100)}%`,
            disabled: true,
            onPress: () => undefined,
          }
        : offline.downloaded
          ? {
              label: "Downloaded · tap to remove",
              disabled: false,
              onPress: () => {
                void removeAudio(offline.key).then(() => stopIfPlayingLocalUri(offline.fileUri))
              },
            }
          : {
              label: "Download",
              disabled: false,
              onPress: () => {
                void downloadAudio(selectedVersion.url, song.number, { userInitiated: true }).catch(() => undefined)
              },
            }

  // Actions
  const onPlayPause = () => {
    if (playState === "error") play()
    else togglePlay()
  }
  const onNext = () => {
    if (!goNext(deps)) storeNext()
  }
  const onPrevious = () => {
    if (!goPrevious(deps)) storePrevious()
  }
  const onRepeat = () => {
    v2.cycleRepeat()
  }
  const onShuffle = () => {
    queueActions.toggleShuffle()
  }
  const onFavourite = () => {
    if (!song) return
    void toggleSaved(song.id).then((result) => {
      if (result.needsAuth) router.push(href("/signin"))
    })
  }
  const onAddToPlaylist = () => {
    if (song) router.push(href(`/playlist/add?song=${song.number}`))
  }
  const onSeekLine = (index: number) => {
    const target = seekTargetForLine(timings, index)
    if (target != null) seekTo(target)
  }

  // Empty state data
  const continuePlay = recentPlays[0]
  const continueSong = continuePlay ? recentPlayToSong(continuePlay) : null
  const emptyContinue = continueSong
    ? {
        id: "continue",
        title: continueSong.title,
        resumeSeconds: resumePositionFor(resumeEntries[String(continueSong.number)]),
        onPress: () => usePlayerStore.getState().playOrToggle(continueSong, [continueSong.number]),
      }
    : null
  const emptyToday: EmptyAction = {
    id: "today",
    title: "Play today's song",
    hint: todaySong ? todaySong.title : "Waiting for today's song",
    disabled: !todaySong,
    onPress: () => todaySong && usePlayerStore.getState().playOrToggle(todaySong, [todaySong.number]),
  }
  const emptyRandom: EmptyAction = {
    id: "random",
    title: "Play random",
    hint: "A song with audio, chosen for you",
    onPress: () => {
      const number = randomPlayableSongNumber(0)
      void hydratePlayableSong(number).then((picked) => {
        if (picked) usePlayerStore.getState().loadSong(picked, [number], "default")
      })
    },
  }
  const emptyPlaylists: EmptyAction[] = playlists.slice(0, 3).map((p) => ({
    id: p.id,
    title: p.name,
    hint: `${playlistSongNumbers(p).length} songs`,
    onPress: () => void playPlaylist(p),
  }))

  const sleepRunning = v2.sleep.kind === "off" ? null : sleepLabel(v2.sleep, now)

  return (
    <View style={[styles.root, { backgroundColor: playerColors.ground }]}>
      <Image
        source={brandAssets.guruQuoteHero}
        style={styles.photo}
        contentFit="cover"
        contentPosition="top"
        accessibilityLabel="Shrii Shrii Anandamurti"
      />
      <LinearGradient
        pointerEvents="none"
        colors={[playerColors.groundClear, playerColors.groundMostly, playerColors.ground]}
        locations={[0, 0.55, 1]}
        style={styles.photo}
      />

      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <View style={[styles.column, { paddingBottom: playerSize.tabBarClearance }]}>
          <Reveal index={0}>
            <View style={styles.topBar}>
              <TouchButton
                accessibilityRole="button"
                accessibilityLabel={`Playing from ${source}. Open the queue`}
                onAction={() => setSheet("queue")}
                style={styles.sourceChip}
              >
                <Text style={styles.sourceText} numberOfLines={1}>
                  Playing from {source}
                </Text>
                <ChevronDown size={16} color={playerColors.textSoft} />
              </TouchButton>
              {song ? (
                <TouchButton
                  accessibilityRole="button"
                  accessibilityLabel="Lyrics options"
                  onAction={() => setSheet("lyrics")}
                  style={styles.round}
                >
                  <Type size={20} color={playerColors.text} />
                </TouchButton>
              ) : null}
            </View>
          </Reveal>

          {!song ? (
            <Reveal index={1} style={styles.flex}>
              <EmptyPlayer
                title={"Nothing\nplaying"}
                continueCard={emptyContinue}
                today={emptyToday}
                random={emptyRandom}
                playlists={emptyPlaylists}
              />
            </Reveal>
          ) : (
            <>
              <View style={styles.photoSpace} />
              <Reveal index={1}>
                {selectedVersion ? (
                  <VersionChip
                    songNumber={song.number}
                    summary={versionSummary(selectedVersion)}
                    position={versionPositionLabel(mode, versionIndex, versions.length)}
                    onPress={() => setSheet("versions")}
                  />
                ) : (
                  <Text style={styles.noAudio}>PS {song.number} · No recording available yet</Text>
                )}
              </Reveal>

              <Reveal index={2}>
                <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
                  {song.title}
                </Text>
              </Reveal>

              <Reveal index={3}>
                <PlayModeToggle mode={mode} versionCount={versions.length} onChange={v2.setPlayMode} />
              </Reveal>

              {drive ? (
                <View style={styles.flex} />
              ) : (
                <Reveal index={4} style={styles.flex}>
                  <LyricsPanel
                    lines={lyricLines}
                    devanagari={useDevanagari}
                    activeLine={activeLine}
                    activeWord={activeWord}
                    showGloss={false}
                    showTranslation={showTranslation}
                    onSeekToLine={onSeekLine}
                    emptyText="Lyrics are not available for this song yet."
                    note={
                      knownLength == null
                        ? null
                        : "The sung line is timed from the song length until line timestamps arrive."
                    }
                  />
                </Reveal>
              )}

              <Reveal index={5}>
                <Scrubber position={position} duration={knownLength} onSeek={seekTo} />
              </Reveal>

              <Reveal index={6}>
                {drive ? (
                  <DriveControls
                    playState={playState}
                    canNext={canGoNext(deps) || playbackMode === "random"}
                    onPlayPause={onPlayPause}
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onExit={() => setDrive(false)}
                  />
                ) : (
                  <TransportRow
                    playState={playState}
                    shuffleOn={v2.shuffleOriginal != null}
                    repeatMode={v2.repeatMode}
                    canNext={canGoNext(deps) || playbackMode === "random"}
                    onPlayPause={onPlayPause}
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onShuffle={onShuffle}
                    onRepeat={onRepeat}
                  />
                )}
              </Reveal>

              {drive ? null : (
                <Reveal index={7}>
                  <View style={styles.iconRow}>
                    <IconButton label="Drive mode" onPress={() => setDrive(true)}>
                      <Car size={playerSize.smallGlyph} color={playerColors.textSoft} />
                    </IconButton>
                    <IconButton label="Add to playlist" onPress={onAddToPlaylist}>
                      <ListPlus size={playerSize.smallGlyph} color={playerColors.textSoft} />
                    </IconButton>
                    <IconButton label="Queue" onPress={() => setSheet("queue")}>
                      <ListMusic size={playerSize.smallGlyph} color={playerColors.textSoft} />
                    </IconButton>
                    <IconButton label={isSaved ? "Remove from favourites" : "Add to favourites"} onPress={onFavourite}>
                      <Heart
                        size={playerSize.smallGlyph}
                        color={isSaved ? playerColors.brand : playerColors.textSoft}
                        fill={isSaved ? playerColors.brand : "none"}
                      />
                    </IconButton>
                    <IconButton label="More: speed and sleep timer" onPress={() => setSheet("playback")}>
                      <Ellipsis size={playerSize.smallGlyph} color={playerColors.textSoft} />
                    </IconButton>
                  </View>
                </Reveal>
              )}
            </>
          )}
        </View>

        <VersionsSheet
          visible={sheet === "versions"}
          theme={theme}
          versions={versions}
          selectedIndex={versionIndex}
          download={downloadPill}
          onSelect={(index) => {
            const picked = versions[index]
            if (song && picked && index !== versionIndex) playVersion(deps, song, picked)
          }}
          onClose={() => setSheet(null)}
        />
        <QueueSheet
          visible={sheet === "queue"}
          theme={theme}
          sourceTitle={source}
          rows={queueRows}
          currentNumber={song?.number ?? null}
          savedNumbers={savedNumbers}
          isPlayable={playableOrUnknown}
          onPlay={(number) => {
            void playNumber(deps, number)
            setSheet(null)
          }}
          onRemove={queueActions.remove}
          onOrder={queueActions.setOrder}
          onClearUpcoming={queueActions.clearUpcoming}
          onClose={() => setSheet(null)}
        />
        <LyricsOptionsSheet
          visible={sheet === "lyrics"}
          theme={theme}
          script={v2.script}
          translation={v2.translation}
          wordMeanings={false}
          hasDevanagari={devanagariLines.length > 0}
          hasLineTranslation={aligned != null}
          hasWordMeanings={false}
          onScript={v2.setScript}
          onTranslation={v2.setTranslation}
          onWordMeanings={v2.setWordMeanings}
          onClose={() => setSheet(null)}
        />
        <PlaybackSheet
          visible={sheet === "playback"}
          theme={theme}
          rate={rate}
          sleep={v2.sleep}
          sleepRunning={sleepRunning}
          onRate={(next) => setRate(clampRate(next))}
          onSleepMinutes={(minutes) => v2.startSleepMinutes(minutes)}
          onSleepEndOfSong={() => song && v2.startSleepEndOfSong(song.number)}
          onSleepOff={v2.cancelSleep}
          onDrive={() => {
            setSheet(null)
            setDrive(true)
          }}
          onClose={() => setSheet(null)}
        />
      </SafeAreaView>
    </View>
  )
}

function IconButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <TouchButton accessibilityRole="button" accessibilityLabel={label} onAction={onPress} style={styles.icon}>
      {children}
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  photo: { position: "absolute", top: 0, left: 0, right: 0, height: playerSize.photoHeight },
  safe: { flex: 1 },
  column: { flex: 1, paddingHorizontal: amGap.gutter, gap: amSpace.s3 },
  flex: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56 },
  sourceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: amSpace.s2,
    minHeight: amTouchTarget,
    paddingHorizontal: amSpace.s3,
    borderRadius: 9999,
    backgroundColor: playerColors.glass,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
    maxWidth: 260,
  },
  sourceText: { ...amType.label, color: playerColors.text, flexShrink: 1 },
  round: {
    width: amTouchTarget,
    height: amTouchTarget,
    borderRadius: amTouchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: playerColors.glass,
    borderWidth: 1,
    borderColor: playerColors.glassEdge,
  },
  /** Keeps the title below the face (spec section 1: the title never crosses the eyes). */
  photoSpace: { height: amSpace.s8 },
  title: {
    ...amType.title,
    fontSize: playerSize.title,
    lineHeight: playerSize.titleLine,
    letterSpacing: playerSize.title * -0.02,
    color: playerColors.text,
  },
  noAudio: { ...amType.label, color: playerColors.gold },
  iconRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: amSpace.s2 },
  icon: { width: playerSize.small, height: playerSize.small, alignItems: "center", justifyContent: "center" },
})
