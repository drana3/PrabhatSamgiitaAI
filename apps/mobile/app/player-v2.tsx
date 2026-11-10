import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { useNavigationContainerRef, useRouter } from "expo-router"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { AboutCard, AboutSheet } from "@/components/player-v2/AboutSong"
import { ActionsSheet } from "@/components/player-v2/ActionsSheet"
import { CrossfadeGradient } from "@/components/player-v2/CrossfadeGradient"
import { DriveControls } from "@/components/player-v2/DriveControls"
import { KiirtanCover, kiirtanTone } from "@/components/kirtan/KiirtanCover"
import { LyricsOptionsSheet } from "@/components/player-v2/LyricsOptionsSheet"
import { LyricsPanel } from "@/components/player-v2/LyricsPanel"
import { PlaybackSheet } from "@/components/player-v2/PlaybackSheet"
import { PlayerIcon } from "@/components/player-v2/PlayerIcons"
import { PlayerToast, usePlayerToast } from "@/components/player-v2/PlayerToast"
import { DownloadButton } from "@/components/offline/DownloadButton"
import { SaveButton } from "@/components/save/SaveButton"
import { SaveHost } from "@/components/save/SaveHost"
import { PlaylistSheet, type PlaylistSheetRow } from "@/components/player-v2/PlaylistSheet"
import { askNewPlaylist } from "@/stores/playlistSheetsStore"
import { playerColors, playerSize } from "@/components/player-v2/playerTokens"
import { QueueSheet, splitQueue, type QueueRow } from "@/components/player-v2/QueueSheet"
import { ResumeNotice } from "@/components/player-v2/ResumeNotice"
import { ThickScrubber, ThinScrubber } from "@/components/player-v2/Scrubber"
import { ShareSheet } from "@/components/player-v2/ShareSheet"
import { SourceSheet } from "@/components/player-v2/SourceSheet"
import { TouchButton } from "@/components/player-v2/TouchButton"
import { TransportRow } from "@/components/player-v2/TransportRow"
import { VersionChip } from "@/components/player-v2/VersionControls"
import { demoDownloadSize } from "@/lib/playerV2/demoDownloads"
import { VersionsSheet } from "@/components/player-v2/VersionsSheet"
import { Reveal } from "@/components/today/motion"
import { amColors } from "@/constants/tokens/amColors"
import { amSpring, projectMomentum } from "@/constants/tokens/amMotion"
import { allCollections } from "@/data/collections"
import { amFonts, amType } from "@/constants/tokens/amTypography"
import { useAmTheme } from "@/hooks/useAmTheme"
import { useSpTheme } from "@/hooks/useSpTheme"
import { RecordingChordsSheet } from "@/components/recording-extras/RecordingChordsSheet"
import { apiIdOf, recordingPageHref } from "@/lib/recordingExtras/links"
import { withRecordingExtras } from "@/lib/recordingExtras/playerRows"
import { useSaveState } from "@/hooks/useSaveState"
import { sampleArtists } from "@/lib/fixtures/kirtanGate"
import { SAMPLE_GLOSS_LANGUAGES, sampleGloss, sampleTranslationLines } from "@/lib/fixtures/player"
import { t, useLanguage } from "@/lib/i18n"
import { playerErrorKey } from "@/lib/playback/playerError"
import { storedMeaningForLanguage } from "@/lib/songMap"
import {
  LYRIC_LANGUAGE_CODES,
  OFF,
  REQUESTED_LABEL,
  REQUEST_LABEL,
  REQUEST_TOAST,
  lyricGaps,
  lyricLanguageName,
  pickShown,
  resolveLyricChoice,
} from "@/lib/songPage/lyricLanguages"
import { gapText, playerGlossRows, playerSampleKey } from "@/lib/songPage/honest"
import { artistForAuthor } from "@/lib/kirtan/artists"
import { moodForText, photoWithoutPeople } from "@/lib/photos/catalog"
import { recordingMood } from "@/lib/photos/recordingPhoto"
import { ensureKirtansRegistered, kirtanById, kiirtanSongByNumber } from "@/lib/kirtan/catalog"
import { openReportSheet } from "@/stores/safetySheetStore"
import { playEverything } from "@/lib/kirtan/mixPlayback"
import { kirtanSharePayload } from "@/lib/kirtan/share"
import { kindHasChords, kindLabel, kindSubtitle, kindTag } from "@/lib/kirtan/kind"
import { isKiirtanNumber, isKiirtanSong, recordingKindOfSong } from "@/lib/kirtan/track"
import { flattenRoutes, rubberBand, songPageInStack } from "@/lib/navV2"
import { formatClock } from "@/lib/playerV2/transportState"
import { DEMO_LINE_SECONDS, demoSeconds, demoTitle } from "@/lib/fixtures/playerDemo"
import { mockupSong } from "@/lib/fixtures/songMockup"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { skipToNextSong, skipToPreviousSong } from "@/lib/playerV2/transport"
import { catalogSongsByNumbers } from "@/lib/lyricSearch"
import { hasPlayableAudio, playableAudioCount, playableNumbersList } from "@/lib/playableAudio"
import { playlistSongNumbers, playPlaylist, starterSongForNumber } from "@/lib/playPlaylist"
import {
  activeQueue,
  canGoNext,
  playNumber,
  playVersion,
} from "@/lib/playerV2/controller"
import {
  activeLineIndex,
  activeWordIndex,
  lyricsAreSynced,
  alignTranslation,
  buildLyricLines,
  lineTimings,
  seekTargetForLine,
  sentenceCaseLine,
  splitLines,
  splitWords,
} from "@/lib/playerV2/lyricsSync"
import { hexAlpha, tintForSong } from "@/lib/playerV2/coverTint"
import {
  aboutContent,
  buildActionRows,
  collectionForSong,
  queueAddMessage,
  type ActionId,
} from "@/lib/playerV2/playerActions"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import type { SaveItem } from "@/lib/save/saveToSheet"
import { buildSharePayload, shareToast, type SharePayload, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { formatRate } from "@/lib/playerV2/playbackSpeed"
import { trackKeyOf } from "@/lib/playerV2/playbackPrefs"
import { longOfferVisible } from "@/lib/playerV2/longResume"
import { useLongResumeOffer } from "@/lib/playerV2/longResumeOffer"
import { usePlaybackPrefsStore } from "@/stores/playbackPrefsStore"
import { ContinueOffer } from "@/components/player-v2/ContinueOffer"
import { RecordingPageChip } from "@/components/player-v2/RecordingPageChip"
import { SleepChip } from "@/components/player-v2/SleepChip"
import { SleepSheet } from "@/components/player-v2/SleepSheet"
import { SpeedSheet } from "@/components/player-v2/SpeedSheet"
import { RadioChannelStrip } from "@/components/radio/RadioChannelStrip"
import { RadioBabaFrame, RadioHero } from "@/components/radio/RadioHero"
import { RadioMixSheet } from "@/components/radio/RadioMixSheet"
import { RadioPlayerBody } from "@/components/radio/RadioPlayerBody"
import { useRadioPools } from "@/hooks/useRadioPools"
import { radioChannelLabel } from "@/lib/radio/labels"
import { radioArtFor, radioHeroLayout } from "@/lib/radio/radioArt"
import { isRadioRunning } from "@/lib/playerV2/playbackPrefs"
import { sourceLabel } from "@/lib/playerV2/queueOps"
import { useResumeNotice, resumeNoticeVisible } from "@/lib/playerV2/resumeNotice"
import { realControllerDeps, realQueueActions, startPlayerV2Services, startSongOver } from "@/lib/playerV2/services"
import { sleepLabel } from "@/lib/playerV2/sleepTimer"
import {
  activeSourceKey,
  MINE_SOURCE_ID,
  sourcePickedMessage,
  sourceRows,
  startNumber,
  type SourceKey,
} from "@/lib/playerV2/sources"
import { knownDuration, playButtonState } from "@/lib/playerV2/transportState"
import { effectivePlayMode, versionChipText } from "@/lib/playerV2/versionMode"
import { selectedVersionIndex, versionsFromSong, versionSummary } from "@/lib/playerV2/versions"
import { songDownloadItem } from "@/lib/offline/downloadItems"
import type { DownloadItem } from "@/lib/offline/downloadModel"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayerV2Store } from "@/stores/playerV2Store"
import { isPlaylist, usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"
import { openSaveSheet } from "@/stores/saveSheetStore"
import { href } from "@/utils/href"

type SheetName = null | "versions" | "queue" | "lyrics" | "playback" | "speed" | "sleep" | "mix" | "source" | "playlist" | "actions" | "share" | "about"

/**
 * Player (prototype PLAYER, Main.dc.html). Dark forest ground in both themes, the
 * photograph fading in from the top, the playing-from header, version chip and
 * title, the "Play: This version | All N versions" switch, the word-by-word
 * karaoke card, the waveform, the transport and the utility bar; Drive mode swaps
 * the lyrics and transport for big controls. One audio engine: this screen only
 * renders playerStore state and sends commands to it.
 * A Prabhat Samgiita song shows the karaoke card, versions, Aa and About. A Kiirtan (an uploaded audio
 * file in the same queue) shows a large cover, its title and "Kiirtan · artist" (or "Bhajan · artist"), the same scrubber and
 * transport, and none of those. Dragging the header or the cover down closes the player.
 */
export default function PlayerV2Screen() {
  const router = useRouter()
  const navigation = useNavigationContainerRef()
  const theme = useAmTheme()
  const spTheme = useSpTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight, width: windowWidth } = useWindowDimensions()
  const toast = usePlayerToast()

  useEffect(() => {
    startPlayerV2Services()
  }, [])

  const song = usePlayerStore((s) => s.currentSong)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isBuffering = usePlayerStore((s) => s.isBuffering)
  const audioError = usePlayerStore((s) => s.audioError)

  // Say why the song did not play (the play button then shows "try again"); each new reason once.
  useEffect(() => {
    const key = playerErrorKey(audioError)
    if (key) toast.show(t(key))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioError])
  const position = usePlayerStore((s) => s.position)
  const duration = usePlayerStore((s) => s.duration)
  const rate = usePlayerStore((s) => s.rate)
  const queue = usePlayerStore((s) => s.queue)
  const playbackMode = usePlayerStore((s) => s.playbackMode)
  const playlistBounds = usePlayerStore((s) => s.playlistBounds)
  const activePlaylist = usePlayerStore((s) => s.activePlaylist)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const play = usePlayerStore((s) => s.play)
  const seekTo = usePlayerStore((s) => s.seekTo)
  const setRate = usePlayerStore((s) => s.setRate)

  const v2 = usePlayerV2Store()
  const savedSongIds = usePreferencesStore((s) => s.savedSongIds)
  const playlists = usePlaylistStore((s) => s.playlists)
  const addSong = usePlaylistStore((s) => s.addSong)
  const removeSong = usePlaylistStore((s) => s.removeSong)
  const flushPlaylists = usePlaylistStore((s) => s.flushSync)

  const [sheet, setSheet] = useState<SheetName>(null)
  const [chordsOpen, setChordsOpen] = useState(false)
  const [drive, setDrive] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const reduce = useReducedMotion()
  const isK = isKiirtanSong(song)
  const resumeNotice = useResumeNotice()
  const resumeVisible = !isK && resumeNoticeVisible(resumeNotice, song?.number ?? null, position)
  // Long recordings (a Kiirtan of half an hour) offer "Continue from 12:40" instead of jumping there by themselves.
  const longOffer = useLongResumeOffer()
  const continueVisible = isK && longOfferVisible(longOffer, song?.number ?? null, position)
  const prefs = usePlaybackPrefsStore()
  // The Radio (design variant D): channels on top, the picture, the dark block with the big buttons. "Normal view" in the menu
  // shows the usual player while the Radio keeps playing.
  const radioOn = usePlayerStore((s) => isRadioRunning(s) && s.currentSong != null)
  const exitDriveMode = usePlayerStore((s) => s.exitDriveMode)
  const [radioNormal, setRadioNormal] = useState(false)
  const radioView = radioOn && !radioNormal
  const radioPools = useRadioPools()
  useEffect(() => {
    if (!radioOn) setRadioNormal(false)
  }, [radioOn])
  const trackKey = song ? trackKeyOf(song) : null
  /** a Kiirtan or a Bhajan: same screen, the words differ */
  const recKind = recordingKindOfSong(song)
  const kiirtanId = song?.kiirtan?.id ?? null

  // Queue numbers of Kiirtans can be turned back into tracks (next, previous, the queue sheet).
  useEffect(() => {
    ensureKirtansRegistered()
  }, [])

  // Opened with nothing loaded (an old link): there is no empty player, so go back.
  useEffect(() => {
    if (song) return
    const id = setTimeout(() => {
      if (router.canGoBack()) router.back()
      else router.replace(href("/v2/today"))
    }, 700)
    return () => clearTimeout(id)
  }, [song, router])

  // Song <-> Kiirtan: the photo fades, the body fades and rises in (opacity and transform only).
  const swap = useSharedValue(1)
  const photoShown = useSharedValue(isK ? 0 : 1)
  const prevKind = useRef(isK)
  useEffect(() => {
    photoShown.value = reduce ? (isK ? 0 : 1) : withTiming(isK ? 0 : 1, { duration: 320, easing: Easing.out(Easing.cubic) })
    if (prevKind.current === isK) return
    prevKind.current = isK
    cancelAnimation(swap)
    swap.value = reduce ? 1 : 0
    if (!reduce) swap.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })
  }, [isK, reduce, swap, photoShown])
  const bodyStyle = useAnimatedStyle(() => ({
    flex: 1,
    opacity: swap.value,
    transform: [{ translateY: reduce ? 0 : (1 - swap.value) * 14 }],
  }))
  const photoStyle = useAnimatedStyle(() => ({ opacity: photoShown.value }))
  // The title and header sit over this picture, so it is a stock photo (no people), never one of Baba:
  // his photographs are only shown clean, by BabaPhoto. One song, one photo.
  const heroPhoto = useMemo(() => photoWithoutPeople(`player-${song?.number ?? 0}`, moodForText(song?.title ?? "")), [song?.number, song?.title])

  // Drag down to collapse: 1:1 with the finger, the release carries its velocity into a spring.
  const dragY = useSharedValue(0)
  const closeNow = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace(href("/v2/today"))
  }, [router])
  const makeCollapse = () =>
    Gesture.Pan()
      .activeOffsetY([10, 9999])
      .failOffsetX([-24, 24])
      .onStart(() => {
        "worklet"
        cancelAnimation(dragY)
      })
      .onUpdate((event) => {
        "worklet"
        dragY.value = rubberBand(event.translationY, 0, windowHeight, 160)
      })
      .onEnd((event) => {
        "worklet"
        const landing = projectMomentum(event.translationY, event.velocityY)
        if (landing > 180) {
          dragY.value = reduce
            ? withTiming(windowHeight, { duration: 180 }, (done) => {
                if (done) scheduleOnRN(closeNow)
              })
            : withSpring(windowHeight, { ...amSpring.fling, velocity: event.velocityY }, (done) => {
                if (done) scheduleOnRN(closeNow)
              })
        } else {
          dragY.value = reduce
            ? withTiming(0, { duration: 150 })
            : withSpring(0, { ...(Math.abs(event.velocityY) > 500 ? amSpring.fling : amSpring.default), velocity: event.velocityY })
        }
      })
      .onFinalize((_event, success) => {
        "worklet"
        if (!success) dragY.value = reduce ? withTiming(0, { duration: 150 }) : withSpring(0, amSpring.default)
      })
  const headGesture = makeCollapse()
  const coverGesture = makeCollapse()
  const titleGesture = makeCollapse()
  const dragStyle = useAnimatedStyle(() => ({ flex: 1, transform: [{ translateY: dragY.value }] }))

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
  const romanLines = useMemo(() => splitLines(song?.lyrics).map(sentenceCaseLine), [song?.lyrics])
  const devanagariLines = useMemo(() => splitLines(song?.lyricsDevanagari), [song?.lyricsDevanagari])
  const useDevanagari = v2.script === "devanagari" && devanagariLines.length > 0
  const scriptLines = useDevanagari ? devanagariLines : romanLines

  // The two settings are separate: the language of the lines under the lyrics and the language of the
  // word meanings. A saved "follow the app" resolves to the app language here, at the point of use.
  const appLanguage = useLanguage()
  const translationChoice = resolveLyricChoice(v2.translation, appLanguage)
  const wordChoice = resolveLyricChoice(v2.wordLanguage, appLanguage)

  // Invented sample content (PS 1 / PS 3 word meanings, Russian lines) exists only in the demo preview
  // and only for those two songs. A real song has none of it and says so.
  const sampleKey = playerSampleKey({ demo: MOCKUP_DATA, songNumber: song?.number })
  // TODO(api): sample translations and word glosses come from lib/fixtures/player.ts until the catalog has them.
  const translationByLanguage = useMemo(() => {
    const map: Record<string, string[] | null> = {}
    for (const code of LYRIC_LANGUAGE_CODES) {
      if (code === "en") map[code] = alignTranslation(scriptLines, song?.translation)
      else {
        const sample = sampleKey !== null && song ? sampleTranslationLines(song.number, code, scriptLines.length) : null
        map[code] = sample ?? alignTranslation(scriptLines, song ? storedMeaningForLanguage(song, code) : null)
      }
    }
    return map
  }, [scriptLines, song, sampleKey])
  const hasTranslationIn = useCallback((code: string) => translationByLanguage[code] != null, [translationByLanguage])
  const translationPick = translationChoice === OFF ? null : pickShown(translationChoice, hasTranslationIn)
  const translationLines = translationPick?.shown ? (translationByLanguage[translationPick.shown] ?? null) : null
  const showTranslation = translationLines != null

  const glossesByLanguage = useMemo(
    () =>
      playerGlossRows({
        sampleKey,
        languages: SAMPLE_GLOSS_LANGUAGES,
        scriptLines,
        romanLines,
        useDevanagari,
        splitWords,
        englishGloss: sampleGloss,
      }),
    [sampleKey, scriptLines, romanLines, useDevanagari],
  )
  const hasWordMeaningsIn = useCallback((code: string) => glossesByLanguage[code] != null, [glossesByLanguage])
  const wordPick = wordChoice === OFF ? null : pickShown(wordChoice, hasWordMeaningsIn)
  const glosses = wordPick?.shown ? (glossesByLanguage[wordPick.shown] ?? null) : null
  const showGloss = glosses != null

  // Asked-for languages the song lacks: the sheet and the panel say so and offer Request.
  const [requestedLanguages, setRequestedLanguages] = useState<string[]>([])
  const gaps = lyricGaps({ translation: translationChoice, wordLanguage: wordChoice, hasTranslationIn, hasWordMeaningsIn })
  const requestLanguage = (code: string) => {
    // TODO(api): send the request to the catalogue; for now it is remembered on this screen only (as on the song page)
    setRequestedLanguages((list) => (list.includes(code) ? list : [...list, code]))
    toast.show(REQUEST_TOAST)
  }
  const panelNotice = gaps.length
    ? (() => {
        const wanted = [...new Set(gaps.map((gap) => gap.wanted))]
        const text = gaps.length > 1 && wanted.length > 1
          ? gaps.map((gap) => `${gap.kind === "translation" ? "Translation" : "Word meanings"}: ${gapText(gap)}`).join(" ")
          : gapText(gaps[0]!)
        const single = wanted.length === 1 ? wanted[0]! : null
        const asked = single != null && requestedLanguages.includes(single)
        return {
          text,
          action: asked ? REQUESTED_LABEL : single ? `${REQUEST_LABEL} ${lyricLanguageName(single)}` : "Options",
          onAction: asked ? undefined : single ? () => requestLanguage(single) : () => setSheet("lyrics"),
        }
      })()
    : null

  const lyricLines = useMemo(
    () => buildLyricLines(scriptLines, translationLines, showGloss ? glosses : null),
    [scriptLines, translationLines, glosses, showGloss],
  )
  // The prototype steps the karaoke highlight one line every 7 seconds and loops, so the preview does the same.
  const timings = useMemo(
    () =>
      MOCKUP_DATA
        ? scriptLines.map((_, i) => ({ start: i * DEMO_LINE_SECONDS, end: (i + 1) * DEMO_LINE_SECONDS }))
        : lineTimings(scriptLines, knownLength ?? 0),
    [scriptLines, knownLength],
  )
  const loopSlot = Math.floor(position / DEMO_LINE_SECONDS)
  const activeLine =
    MOCKUP_DATA && scriptLines.length ? loopSlot % scriptLines.length : activeLineIndex(timings, position)
  const activeWord =
    activeLine < 0
      ? -1
      : activeWordIndex(
          splitWords(scriptLines[activeLine] ?? ""),
          MOCKUP_DATA
            ? { start: loopSlot * DEMO_LINE_SECONDS, end: (loopSlot + 1) * DEMO_LINE_SECONDS }
            : timings[activeLine]!,
          position,
        )

  const playableOrUnknown = useCallback((n: number) => hasPlayableAudio(n), [])

  const savedNumbers = useMemo(() => {
    const set = new Set<number>()
    for (const id of savedSongIds) {
      const n = Number(/^ps-(\d+)$/i.exec(id)?.[1])
      if (Number.isFinite(n) && n > 0) set.add(n)
    }
    return set
  }, [savedSongIds])
  /** The song or Kiirtan this screen is playing, for the circle-plus and the "Save to" sheet. */
  const saveItem: SaveItem | null = song
    ? isK && kiirtanId
      ? { kind: "kiirtan", id: kiirtanId }
      : { kind: "song", number: song.number }
    : null
  const isSaved = useSaveState(saveItem).saved

  const list = song
    ? activeQueue({ currentSong: song, queue, playbackMode, playlistBounds, position })
    : queue
  const queueRows: QueueRow[] = useMemo(() => {
    if (sheet !== "queue") return []
    // Only the rows the sheet will draw look up a title; a long catalog list keeps cheap placeholders after them.
    const { head, upcoming } = splitQueue(list.map((number) => ({ number })), song?.number ?? null)
    const shown = [...head, ...upcoming].map((r) => r.number).filter((n) => !isKiirtanNumber(n))
    const titles = new Map(
      MOCKUP_DATA
        ? shown.flatMap((n) => (demoTitle(n) ? ([[n, demoTitle(n)!]] as Array<[number, string]>) : []))
        : catalogSongsByNumbers(shown, shown.length).map((hit) => [hit.number, hit.firstLine || hit.title] as [number, string]),
    )
    return list.map((number) => {
      if (isKiirtanNumber(number)) {
        const k = kiirtanSongByNumber(number)
        const parts = [k?.durationSeconds ? formatClock(k.durationSeconds) : null, k?.performer || null].filter(Boolean)
        return {
          key: `k-${number}`,
          number,
          title: k?.title ?? kindLabel(recordingKindOfSong(k)),
          seconds: k?.durationSeconds || undefined,
          sub: parts.length ? `${kindTag(recordingKindOfSong(k))} · ${parts.join(" · ")}` : kindTag(recordingKindOfSong(k)),
        }
      }
      return {
        key: `ps-${number}`,
        number,
        title: sentenceCaseLine(titles.get(number) ?? `Prabhat Samgiita ${number}`),
        seconds: MOCKUP_DATA ? demoSeconds(number) : undefined,
      }
    })
  }, [sheet, list, song?.number])
  const source = sourceLabel({ playbackMode, playlistName: activePlaylist?.name ?? null })

  // Actions
  const onPlayPause = () => {
    if (playState === "error") play()
    else togglePlay()
  }
  const onNext = () => skipToNextSong()
  const onPrevious = () => skipToPreviousSong()
  // No pop-up text here: it covered the buttons. The button itself shows the state (gold icon, "1" badge,
  // accessibility label and selected state), see __tests__/playerNoToastOnModes.test.ts.
  const onRepeat = () => {
    v2.cycleRepeat()
  }
  const onShuffle = () => {
    queueActions.toggleShuffle()
  }
  const onSeekLine = (index: number) => {
    const target = seekTargetForLine(timings, index)
    if (target != null) seekTo(target)
  }
  const onPlayMode = (next: "this" | "all") => {
    v2.setPlayMode(next)
    toast.show(next === "this" ? "Playing this version only" : `Playing all ${versions.length} versions in a row`)
  }

  // Lyrics display: each row steps through its options.
  const onCycleScript = () => v2.setScript(v2.script === "roman" ? "devanagari" : "roman")

  // Play songs from
  const sourceChoices = useMemo(
    () =>
      sourceRows({
        catalogCount: playableAudioCount() || 5018,
        savedCount: savedNumbers.size,
        playlists: playlists.map((p) => ({ id: p.id, name: p.name, count: p.songs.length })),
      }),
    [savedNumbers.size, playlists],
  )
  const onPickSource = (key: SourceKey) => {
    setSheet(null)
    const current = song?.number ?? null
    if (key === "all") {
      const numbers = [...playableNumbersList()]
      const first = startNumber(numbers, current, hasPlayableAudio)
      if (first == null) return toast.show(sourcePickedMessage(t("songs.allSongs"), 0))
      usePlayerStore.setState({ activePlaylist: null })
      usePlayerStore.getState().loadSong(starterSongForNumber(first), numbers, "default")
      return toast.show(sourcePickedMessage(t("songs.allSongs"), numbers.length))
    }
    if (key === "mine") {
      const numbers = [...savedNumbers].sort((a, b) => a - b)
      const first = startNumber(numbers, current, hasPlayableAudio)
      if (first == null) return toast.show(sourcePickedMessage(t("songs.mine"), 0))
      usePlayerStore.setState({ activePlaylist: { id: MINE_SOURCE_ID, name: t("songs.mine") } })
      usePlayerStore.getState().loadSong(starterSongForNumber(first), numbers, "playlist")
      return toast.show(sourcePickedMessage(t("songs.mine"), numbers.length))
    }
    const playlist = playlists.find((p) => `pl:${p.id}` === key)
    if (!playlist) return
    const count = playlistSongNumbers(playlist).length
    void playPlaylist(playlist)
    toast.show(sourcePickedMessage(playlist.name, count))
  }

  // Add to playlist, in place
  const playlistRows: PlaylistSheetRow[] = playlists.map((p) => ({
    id: p.id,
    name: p.name,
    meta: t("songs.count", { count: p.songs.length }),
    has: song ? playlistSongNumbers(p).includes(song.number) : false,
  }))
  const reportPlaylistFailure = (result: unknown) => {
    if (result && typeof result === "object" && "needsAuth" in result) {
      setSheet(null)
      router.push(href("/signin"))
    } else if (result && typeof result === "object" && "error" in result) {
      Alert.alert(t("player.playlist"), String((result as { error: string }).error))
    }
  }
  const onTogglePlaylist = (id: string, has: boolean) => {
    if (!song) return
    const name = playlists.find((p) => p.id === id)?.name ?? "playlist"
    void (has ? removeSong(id, song.number) : addSong(id, song.number)).then((result) => {
      if (!isPlaylist(result)) return reportPlaylistFailure(result)
      toast.show(has ? `Removed from ${name}` : `Saved to ${name}`)
      void flushPlaylists()
    })
  }
  // New playlist: the name sheet (default name typed and selected); the song goes into the playlist once it exists.
  // The sheet comes up when the "Add to playlist" sheet has left, so two native modals never swap at once.
  const onNewPlaylist = () => {
    if (!song) return
    const songNumber = song.number
    setSheet(null)
    setTimeout(
      () =>
        askNewPlaylist((created) =>
          addSong(created.id, songNumber).then((result) => {
            if (!isPlaylist(result)) return reportPlaylistFailure(result)
            toast.show(`Created ${created.name}`)
            void flushPlaylists()
          }),
        ),
      280,
    )
  }

  const sleepValue = v2.sleep.kind === "off" ? t("common.off") : sleepLabel(v2.sleep, now)

  // More actions, Share and About this song
  const songTitle = sentenceCaseLine(song?.title ?? "")

  // The one download control: the icon in the action row and the pill in the Versions sheet act on the same item.
  const downloadItem: DownloadItem | null = !song
    ? null
    : isK
      ? { kind: "kiirtan", number: song.number, url: song.audioUrl, title: songTitle, seconds: song.durationSeconds || undefined }
      : selectedVersion
        ? songDownloadItem(song.number, {
            url: selectedVersion.url,
            versionIndex: MOCKUP_DATA ? versionIndex : undefined,
            title: songTitle,
            seconds: selectedVersion.lengthSeconds ?? undefined,
          })
        : null
  const collection = useMemo(() => (song ? collectionForSong(song.number, allCollections) : null), [song])
  const performer = selectedVersion?.performer ?? song?.performer ?? ""
  const extrasRecording = useMemo(() => {
    const k = isK && kiirtanId ? kirtanById(kiirtanId) : null
    return k && k.status === "published" && (k.serverId || MOCKUP_DATA) ? k : null
  }, [isK, kiirtanId])
  const actionRows = useMemo(() => {
    const rows = buildActionRows({
        saved: isSaved,
        inQueue: song ? list.includes(song.number) : false,
        collectionName: collection?.label ?? null,
        sourceName: source,
        speedText: formatRate(rate).replace("x", "×"),
        sleepText: sleepValue,
      })
    // A Kiirtan has no song page, collection, playlist or song sources.
    if (!isK) return rows
    const kept = rows.filter((r) => ["share", "save", "queue", "goQueue", "playback", "drive", "report"].includes(r.id))
    // a recording that is on the server also has chords, videos and comments (docs/recording-extras.md)
    return extrasRecording ? withRecordingExtras(kept, kindHasChords(extrasRecording.kind)) : kept
  }, [isSaved, isK, song, list, collection, source, rate, sleepValue, extrasRecording])
  const sharePayload = useMemo(
    () =>
      !song
        ? null
        : isK
          ? kirtanSharePayload({ title: song.title, author: song.performer ?? "", kind: recKind })
          : buildSharePayload({ number: song.number, title: songTitle, performer }),
    [song, isK, recKind, songTitle, performer],
  )
  // TODO(api): the story text comes from the song's central idea; the prototype's sample text stands in
  // while MOCKUP_DATA is on (its "Placeholder." lines are skipped).
  const about = useMemo(() => {
    if (!song || isK) return null
    const sample = MOCKUP_DATA ? mockupSong(song.number)?.centralIdea : null
    return aboutContent(song, sample && !/^placeholder/i.test(sample) ? sample : null)
  }, [song, isK])
  // a Kiirtan with a page of its own (chords, video, notes, stories): a chip that opens it
  const pageChip =
    isK && extrasRecording && !drive ? (
      <RecordingPageChip
        onOpen={() => {
          closePlayer()
          router.push(href(recordingPageHref(apiIdOf(extrasRecording))))
        }}
      />
    ) : null
  const showAbout = about != null && !isK && !drive && windowHeight >= 740
  const openSongPage = () => {
    if (!song) return
    setSheet(null)
    const path = href(`/song-v2/ps-${song.number}`)
    // the page of this song is already under the player: go back to it, not a second copy on top
    if (navigation.isReady() && songPageInStack(flattenRoutes(navigation.getRootState()), `ps-${song.number}`)) router.dismissTo(path)
    else router.push(path)
  }
  const onAction = (id: ActionId) => {
    if (!song) return
    switch (id) {
      case "share":
        return setSheet("share")
      case "save":
        setSheet(null)
        if (saveItem) openSaveSheet(saveItem)
        return
      case "playlist":
        return setSheet("playlist")
      case "queue": {
        const there = list.includes(song.number)
        if (!there) queueActions.add(song.number)
        setSheet(null)
        return toast.show(queueAddMessage(there))
      }
      case "goQueue":
        return setSheet("queue")
      case "songPage":
        return openSongPage()
      case "collection": {
        setSheet(null)
        const label = collection?.label
        return router.push(
          href(label ? `/songs-v2-collection?id=${encodeURIComponent(label)}&title=${encodeURIComponent(label)}` : "/songs-v2-index"),
        )
      }
      case "source":
        return setSheet("source")
      case "playback":
        return setSheet("playback")
      case "drive":
        setSheet(null)
        return setDrive(true)
      case "recordingChords":
        setSheet(null)
        return setChordsOpen(true)
      case "recordingPage": {
        if (!extrasRecording) return
        closePlayer()
        return router.push(href(recordingPageHref(apiIdOf(extrasRecording))))
      }
      case "report": {
        setSheet(null)
        // A Kiirtan or a Bhajan: the report sheet (reason, then it is sent to the team).
        const recording = isK && kiirtanId ? kirtanById(kiirtanId) : null
        if (recording) return openReportSheet(recording)
        // A song: Send feedback with this song picked ("A mistake in a song or lyrics").
        return router.push(href(`/feedback?song=${song.number}`))
      }
    }
  }
  const onShareTarget = (target: ShareTargetId, override?: SharePayload) => {
    if (!sharePayload) return
    void runShare(target, override ?? sharePayload).then((outcome) => {
      const message = shareToast(outcome)
      // A copied link closes the sheet, so the toast rises over the Player and not over the buttons.
      if (message) {
        setSheet(null)
        toast.show(message)
      }
    })
  }
  const coverTint = isK ? kiirtanTone(song?.kiirtan?.type, recKind)[0] : tintForSong(song?.number ?? null)
  const subtitleText = isK && song ? kindSubtitle(recKind, song.performer, song.kiirtan?.addedBy, sampleArtists()) : ""
  const artist = isK && song ? artistForAuthor(sampleArtists(), song.performer) : null
  const openArtist = () => {
    if (!artist) return
    // Leave the player first, then show the artist; the pill stays above it.
    closePlayer()
    router.push(href(`/kirtan-artist?id=${encodeURIComponent(artist.id)}`))
  }
  const radioArt = song
    ? radioArtFor({
        recordingKind: isK ? recKind : null,
        coverUrl: song.thumbnailUrl || null,
        authorPhotoUrl: artist?.photoUrl ?? null,
        seed: isK ? (song.kiirtan?.photoSeed ?? song.kiirtan?.id ?? String(song.id)) : `ps-${song.number}`,
      })
    : null
  // the picture ends where the text starts: header (status bar, title row, channels) + a gap that is 0 on a short screen
  const radioHeroHeight = Math.round(windowHeight * 0.46)
  const radioHeader = (insets.top || playerSize.topBand) + playerSize.topBar + 52
  const radioGap = Math.max(0, radioHeroHeight - radioHeader - 56)
  const radioChannel = radioChannelLabel(radioPools.chosen, radioPools.counts)
  const coverSize = Math.max(180, Math.min(windowWidth - 56, windowHeight * 0.36, 340))
  const chip = versionChipText(selectedVersion ? versionSummary(selectedVersion) : "", versions.length, mode, versionIndex)
  const closePlayer = closeNow
  const canAdvance = canGoNext(deps) || playbackMode === "random"
  const sourceKey = activeSourceKey(playbackMode, activePlaylist?.id)

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.flex, dragStyle, { backgroundColor: playerColors.ground }]}>
      {radioView && radioArt && radioArt.kind !== "baba" ? (
        <RadioHero art={radioArt} title={song?.title ?? ""} durationSec={song?.durationSeconds || null} height={radioHeroHeight} />
      ) : null}
      {!radioView ? (
      <Animated.View pointerEvents="none" style={[styles.photo, photoStyle]}>
        <Image
          source={heroPhoto.cover}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          accessibilityIgnoresInvertColors
        />
        <LinearGradient
          colors={[playerColors.fadeTop, playerColors.fadeMid, playerColors.ground]}
          locations={[0, 0.46, 0.82]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      ) : null}

      {!radioView ? (
      <CrossfadeGradient
        colors={
          isK
            ? [hexAlpha(coverTint, 0.5), hexAlpha(coverTint, 0.32), hexAlpha(coverTint, 0.22)]
            : [hexAlpha(coverTint, 0.42), hexAlpha(coverTint, 0.3), hexAlpha(coverTint, 0.26)]
        }
        locations={[0, 0.5, 1]}
        duration={400}
        style={StyleSheet.absoluteFill}
      />
      ) : null}

      <View style={[styles.column, { paddingTop: insets.top || playerSize.topBand, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
        <GestureDetector gesture={headGesture}>
          <View collapsable={false}>
            <Reveal index={0}>
              <View style={styles.topBar}>
                <TouchButton
                  accessibilityRole="button"
                  accessibilityLabel={t("player.close")}
                  onAction={closePlayer}
                  style={styles.topButton}
                >
                  <PlayerIcon name="chevronDown" size={30} color={amColors.white} />
                </TouchButton>
                {radioView ? (
                  <View style={styles.sourceHit}>
                    <View style={styles.sourceChip}>
                      <Text style={styles.sourceText} numberOfLines={1} accessibilityRole="header">
                        {t("radio.player.label")}
                      </Text>
                    </View>
                  </View>
                ) : (
                <TouchButton
                  accessibilityRole="button"
                  accessibilityLabel={`${drive ? "Radio" : `Playing from ${source}`}. Open the queue`}
                  onAction={() => setSheet("queue")}
                  containerStyle={styles.sourceHit}
                  style={styles.sourceChip}
                >
                  <Text style={styles.sourceText} numberOfLines={1}>
                    {drive ? "Radio" : source}
                  </Text>
                </TouchButton>
                )}
                {radioView ? (
                  <TouchButton
                    accessibilityRole="button"
                    accessibilityLabel={t("radio.player.stop")}
                    onAction={() => {
                      exitDriveMode()
                      closePlayer()
                    }}
                    style={styles.stopPill}
                  >
                    <PlayerIcon name="stop" size={22} color={playerColors.gold} />
                  </TouchButton>
                ) : null}
                {song && radioView ? (
                  <TouchButton
                    accessibilityRole="button"
                    accessibilityLabel={t("radio.player.menu")}
                    onAction={() => setSheet("playback")}
                    style={styles.topButton}
                  >
                    <PlayerIcon name="more" size={playerSize.topIcon} color={amColors.white} />
                  </TouchButton>
                ) : song ? (
                  <TouchButton
                    accessibilityRole="button"
                    accessibilityLabel={isK ? "More actions: share, save, queue" : "More actions: share, save, add to playlist, queue, song page"}
                    onAction={() => setSheet("actions")}
                    style={styles.topButton}
                  >
                    <PlayerIcon name="more" size={playerSize.topIcon} color={amColors.white} />
                  </TouchButton>
                ) : (
                  <View style={styles.topButton} />
                )}
              </View>
            </Reveal>
          </View>
        </GestureDetector>

        {radioView ? <RadioChannelStrip /> : null}

        {song && radioView ? (
          <Animated.View style={[bodyStyle, styles.flex]}>
            {radioArt && radioHeroLayout(radioArt) === "baba-clean" ? <RadioBabaFrame height={Math.round(windowHeight * 0.3)} /> : null}
            <RadioPlayerBody
              channel={radioChannel}
              title={song.title}
              subtitle={isK ? subtitleText : sentenceCaseLine(selectedVersion ? versionSummary(selectedVersion) : "")}
              position={position}
              duration={knownLength}
              onSeek={seekTo}
              playState={playState}
              canNext={canAdvance}
              onPlayPause={onPlayPause}
              onPrevious={onPrevious}
              onNext={onNext}
              onMix={() => setSheet("mix")}
              extra={
                <>
                  {pageChip}
                  {v2.sleep.kind !== "off" ? <SleepChip text={sleepValue} onCancel={v2.cancelSleep} /> : null}
                </>
              }
              topGap={radioGap}
            />
          </Animated.View>
        ) : song ? (
          <Animated.View style={bodyStyle}>
            {isK && !drive ? (
              <GestureDetector gesture={coverGesture}>
                <View collapsable={false} style={styles.coverArea}>
                  <Reveal index={1}>
                    <View style={[styles.coverShadow, { width: coverSize, height: coverSize }]}>
                      <KiirtanCover type={song.kiirtan?.type} kind={recKind} coverUrl={song.thumbnailUrl || null} width={coverSize} height={coverSize} radius={28} photoSeed={song.kiirtan?.photoSeed ?? song.kiirtan?.id ?? String(song.id)} title={song.title} durationSec={song.durationSeconds || null} />
                    </View>
                  </Reveal>
                </View>
              </GestureDetector>
            ) : null}

            <GestureDetector gesture={titleGesture}>
              <View collapsable={false}>
                <Reveal index={isK && !drive ? 2 : 1}>
                  <View style={[styles.titleBlock, isK && !drive ? styles.titleBlockUnderCover : null]}>
                    <Text style={styles.title} accessibilityRole="header">
                      {song.title}
                    </Text>
                    {isK ? (
                      artist ? (
                        <View style={styles.subtitleRow}>
                          <Text style={styles.subtitle}>{kindLabel(recKind)} · </Text>
                          <TouchButton
                            accessibilityRole="link"
                            accessibilityLabel={`Open the artist page of ${artist.name}`}
                            onAction={openArtist}
                            hitSlop={{ top: 8, bottom: 8 }}
                            pressedScale={0.97}
                            style={styles.artistLink}
                          >
                            <Text style={styles.artistText} numberOfLines={1}>
                              {artist.name}
                            </Text>
                          </TouchButton>
                        </View>
                      ) : (
                        <Text style={styles.subtitle} numberOfLines={1}>
                          {subtitleText}
                        </Text>
                      )
                    ) : selectedVersion ? (
                      <VersionChip
                        text={chip.text}
                        position={chip.position}
                        pickable={chip.pickable}
                        instrument={selectedVersion.instrument === "voice" ? "voice" : "other"}
                        onPress={() => setSheet("versions")}
                      />
                    ) : (
                      <Text style={styles.noAudio}>PS {song.number} · No recording available yet</Text>
                    )}
                  </View>
                </Reveal>
              </View>
            </GestureDetector>

            {drive ? (
              <>
                <View style={styles.driveSpace} />
                <Reveal index={2}>
                  <ThickScrubber position={position} duration={knownLength} onSeek={seekTo} />
                </Reveal>
                <Reveal index={3}>
                  <View style={styles.driveControls}>
                    <DriveControls
                      playState={playState}
                      canNext={canAdvance}
                      onPlayPause={onPlayPause}
                      onPrevious={onPrevious}
                      onNext={onNext}
                      onExit={() => setDrive(false)}
                    />
                  </View>
                </Reveal>
              </>
            ) : (
              <>
                {isK ? null : (
                  <Reveal index={2} style={styles.flex}>
                    <LyricsPanel
                      lines={lyricLines}
                      devanagari={useDevanagari}
                      activeLine={activeLine}
                      activeWord={activeWord}
                      synced={lyricsAreSynced(MOCKUP_DATA)}
                      showGloss={showGloss}
                      showTranslation={showTranslation}
                      notice={panelNotice}
                      demoTag={sampleKey !== null}
                      onSeekToLine={onSeekLine}
                      emptyText="Lyrics are not available for this song yet."
                      onOptions={() => setSheet("lyrics")}
                    />
                  </Reveal>
                )}
                <View style={styles.gap} />
                <Reveal index={3}>
                  <ThinScrubber position={position} duration={knownLength} onSeek={seekTo} />
                  {resumeVisible ? <ResumeNotice from={resumeNotice.from} onStartOver={startSongOver} /> : null}
                  {continueVisible ? (
                    <ContinueOffer
                      at={longOffer.at}
                      onContinue={() => {
                        seekTo(longOffer.at)
                        longOffer.clear()
                      }}
                    />
                  ) : null}
                  {pageChip}
                  {v2.sleep.kind !== "off" ? <SleepChip text={sleepValue} onCancel={v2.cancelSleep} /> : null}
                </Reveal>
                <Reveal index={4}>
                  <TransportRow
                    playState={playState}
                    shuffleOn={v2.shuffleOriginal != null}
                    repeatMode={v2.repeatMode}
                    canNext={canAdvance}
                    onPlayPause={onPlayPause}
                    onPrevious={onPrevious}
                    onNext={onNext}
                    onShuffle={onShuffle}
                    onRepeat={onRepeat}
                  />
                </Reveal>
                <Reveal index={5}>
                  <View style={styles.iconRow}>
                    <View style={styles.util}>
                      {saveItem ? (
                        <SaveButton item={saveItem} size={28} color={playerColors.utilIcon} title={songTitle} hit={playerSize.util} />
                      ) : null}
                    </View>
                    <DownloadButton
                      item={downloadItem}
                      size={26}
                      hit={playerSize.util}
                      color={playerColors.utilIcon}
                      onDark
                    />
                    <UtilButton label={t("player.queue.title")} onPress={() => setSheet("queue")}>
                      <PlayerIcon name="queue" size={playerSize.utilGlyph} color={playerColors.utilIcon} />
                    </UtilButton>
                    <UtilButton label={t("songs.menu.share")} onPress={() => setSheet("share")}>
                      <PlayerIcon name="share" size={playerSize.utilGlyph} color={playerColors.utilIcon} />
                    </UtilButton>
                  </View>
                </Reveal>
                {showAbout && about ? (
                  <Reveal index={6}>
                    <View style={styles.aboutWrap}>
                      <AboutCard preview={about.preview} onOpen={() => setSheet("about")} />
                    </View>
                  </Reveal>
                ) : null}
              </>
            )}
          </Animated.View>
        ) : null}
      </View>
      </Animated.View>

      <PlayerToast message={toast.message} theme={theme} />
      {/* The full player is a native modal on iOS and hides the root, so it draws the Save to sheet itself. */}
      <SaveHost />
      {extrasRecording ? (
        <RecordingChordsSheet t={spTheme} recordingId={apiIdOf(extrasRecording)} title={extrasRecording.title} visible={chordsOpen} onClose={() => setChordsOpen(false)} beforeNavigate={closePlayer} />
      ) : null}

      {!isK ? (
      <VersionsSheet
        visible={sheet === "versions"}
        theme={theme}
        versions={versions}
        selectedIndex={versionIndex}
        downloadItem={downloadItem}
        sizeText={MOCKUP_DATA && selectedVersion ? demoDownloadSize(selectedVersion.lengthSeconds ?? 0) : undefined}
        playMode={mode}
        onPlayMode={onPlayMode}
        onSelect={(index) => {
          const picked = versions[index]
          if (song && picked && index !== versionIndex) playVersion(deps, song, picked)
        }}
        onClose={() => setSheet(null)}
      />
      ) : null}
      <QueueSheet
        visible={sheet === "queue"}
        theme={theme}
        sourceTitle={source}
        rows={queueRows}
        currentNumber={song?.number ?? null}
        currentTitle={sentenceCaseLine(song?.title ?? "")}
        playing={isPlaying}
        savedNumbers={savedNumbers}
        isPlayable={playableOrUnknown}
        onPlay={(number) => {
          void playNumber(deps, number)
          setSheet(null)
        }}
        onRemove={queueActions.remove}
        onOrder={queueActions.setOrder}
        onClearUpcoming={queueActions.clearUpcoming}
        compact={MOCKUP_DATA}
        footer={{
          shuffleOn: v2.shuffleOriginal != null,
          repeat: v2.repeatMode,
          timerOn: v2.sleep.kind !== "off",
          onShuffle,
          onRepeat,
          onTimer: () => setSheet("playback"),
          onShuffleEverything: () => {
            setSheet(null)
            const message = playEverything()
            if (message) toast.show(message)
          },
        }}
        onClose={() => setSheet(null)}
      />
      {!isK ? (
      <LyricsOptionsSheet
        visible={sheet === "lyrics"}
        theme={theme}
        script={v2.script}
        translation={translationChoice}
        wordLanguage={wordChoice}
        hasDevanagari={devanagariLines.length > 0}
        hasTranslationIn={hasTranslationIn}
        hasWordMeaningsIn={hasWordMeaningsIn}
        requested={requestedLanguages}
        onCycleScript={onCycleScript}
        onPickTranslation={v2.setTranslation}
        onPickWordLanguage={v2.setWordLanguage}
        onRequest={requestLanguage}
        onClose={() => setSheet(null)}
      />
      ) : null}
      <PlaybackSheet
        visible={sheet === "playback"}
        theme={theme}
        rate={rate}
        sleepValue={sleepValue}
        onOpenSpeed={() => setSheet("speed")}
        onOpenSleep={() => setSheet("sleep")}
        radio={
          radioOn
            ? {
                radioView,
                onToggleView: () => {
                  setSheet(null)
                  setRadioNormal(radioView)
                },
              }
            : undefined
        }
        onDrive={() => {
          setSheet(null)
          setDrive(true)
        }}
        onClose={() => setSheet(null)}
      />
      <RadioMixSheet visible={sheet === "mix"} theme={theme} onClose={() => setSheet(null)} />
      <SpeedSheet
        visible={sheet === "speed"}
        theme={theme}
        rate={rate}
        onRate={(next) => {
          setRate(next)
          // a speed saved for this recording follows the change
          if (trackKey && prefs.rateByTrack[trackKey]) prefs.setTrackRate(trackKey, next)
        }}
        keepPitch={prefs.keepPitch}
        onKeepPitch={prefs.setKeepPitch}
        remembered={trackKey != null && prefs.rateByTrack[trackKey] != null}
        onRemember={(on) => {
          if (trackKey) prefs.setTrackRate(trackKey, on ? rate : null)
        }}
        defaultRate={prefs.defaultRate}
        onMakeDefault={() => prefs.setDefaultRate(rate)}
        onClose={() => setSheet(null)}
      />
      <SleepSheet
        visible={sheet === "sleep"}
        theme={theme}
        timer={v2.sleep}
        now={now}
        canEndOfList={list.length > 1}
        onMinutes={(minutes) => {
          v2.startSleepMinutes(minutes)
          setSheet(null)
        }}
        onEndOfTrack={() => {
          if (song) v2.startSleepEndOfSong(song.number)
          setSheet(null)
        }}
        onEndOfList={() => {
          const last = list[list.length - 1]
          if (last != null) v2.startSleepEndOfList(last)
          setSheet(null)
        }}
        onCancel={() => {
          v2.cancelSleep()
          setSheet(null)
        }}
        onClose={() => setSheet(null)}
      />
      <SourceSheet
        visible={sheet === "source"}
        theme={theme}
        rows={sourceChoices}
        activeKey={sourceKey}
        onPick={onPickSource}
        onClose={() => setSheet(null)}
      />
      <PlaylistSheet
        visible={sheet === "playlist"}
        theme={theme}
        songTitle={sentenceCaseLine(song?.title ?? "")}
        rows={playlistRows}
        onToggle={onTogglePlaylist}
        onNew={onNewPlaylist}
        onClose={() => setSheet(null)}
      />
      {song ? (
        <>
          <ActionsSheet
            visible={sheet === "actions"}
            theme={theme}
            songNumber={song.number}
            title={songTitle}
            subtitle={isK ? subtitleText : [collection?.label, performer].filter(Boolean).join(" · ") || `PS ${song.number}`}
            rows={actionRows}
            onAction={onAction}
            onClose={() => setSheet(null)}
          />
          <ShareSheet
            visible={sheet === "share"}
            theme={theme}
            songNumber={song.number}
            title={songTitle}
            performer={performer}
            kiirtan={isK}
            tint={coverTint}
            photoSeed={isK ? (song.kiirtan?.photoSeed ?? song.kiirtan?.id ?? String(song.id)) : undefined}
            photoMood={isK ? recordingMood(recKind, song.title, song.durationSeconds || null) : undefined}
            lyrics={song.lyrics}
            lyricsDevanagari={song.lyricsDevanagari}
            onShare={onShareTarget}
            onClose={() => setSheet(null)}
          />
          {!isK ? (
          <AboutSheet
            visible={sheet === "about"}
            theme={theme}
            songTitle={songTitle}
            about={about}
            onOpenSong={openSongPage}
            onClose={() => setSheet(null)}
          />
          ) : null}
        </>
      ) : null}
    </View>
  )
}

function UtilButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TouchButton accessibilityRole="button" accessibilityLabel={label} onAction={onPress} style={styles.util}>
      {children}
    </TouchButton>
  )
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  photo: { position: "absolute", top: 0, left: 0, right: 0, height: playerSize.photoHeight },
  coverArea: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  coverShadow: { borderRadius: 28, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 28, shadowOffset: { width: 0, height: 14 } },
  subtitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  subtitle: { fontFamily: amFonts.semi, fontSize: 15, lineHeight: 20, color: "rgba(255, 255, 255, 0.78)" },
  artistLink: { minHeight: 32, justifyContent: "center" },
  artistText: { fontFamily: amFonts.bold, fontSize: 15, lineHeight: 20, color: playerColors.gold, textDecorationLine: "underline" },
  column: { flex: 1 },
  flex: { flex: 1, minHeight: 0 },
  gap: { height: 8 },
  topBar: {
    height: playerSize.topBar,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: playerSize.topBarInsetLeft,
    paddingRight: playerSize.topBarInsetRight,
  },
  stopPill: {
    width: playerSize.topButton,
    height: playerSize.topButton,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: playerColors.gold,
    backgroundColor: playerColors.glassDark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  topButton: { width: playerSize.topButton, height: playerSize.topButton, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  sourceHit: { flex: 1, minWidth: 0 },
  sourceChip: { height: playerSize.topButton, alignItems: "center", justifyContent: "center" },
  sourceText: { ...amType.label, color: amColors.white, textAlign: "center" },
  aboutWrap: { marginTop: 10 },
  titleBlock: { paddingHorizontal: 20, gap: 12, marginTop: playerSize.titleLift },
  // A Kiirtan has a square cover above the title (a song has the photograph): keep a clear gap under it.
  titleBlockUnderCover: { marginTop: 20 },
  title: {
    fontFamily: amFonts.display,
    fontSize: playerSize.titleFont,
    lineHeight: playerSize.titleLine,
    letterSpacing: playerSize.titleFont * -0.02,
    textTransform: "uppercase",
    color: playerColors.text,
  },
  noAudio: { fontFamily: amFonts.bold, fontSize: 13, color: playerColors.gold },
  driveSpace: { flex: 1, minHeight: 12 },
  driveControls: { marginTop: 16 },
  iconRow: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "center", marginTop: 6, marginHorizontal: 24 },
  util: { width: playerSize.util, height: playerSize.util, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
})
