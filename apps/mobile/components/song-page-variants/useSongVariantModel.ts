import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "expo-router"

import type { MockSong, SongVideo } from "@/data/mock"
import { allCollections } from "@/data/collections"
import { demoUrl } from "@/lib/fixtures/playerDemo"
import { mockupFixtureKey, mockupRow, mockupSong, mockupTranslation, mockupVersions } from "@/lib/fixtures/songMockup"
import { useLanguage } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { songDownloadItem } from "@/lib/offline/downloadItems"
import type { DownloadItem } from "@/lib/offline/downloadModel"
import { buildSharePayload, shareToast, type ShareTargetId } from "@/lib/playerV2/playerShare"
import { buildActionRows, collectionForSong, queueAddMessage, type ActionId } from "@/lib/playerV2/playerActions"
import { runShare } from "@/lib/playerV2/playerActionsIO"
import { realQueueActions } from "@/lib/playerV2/services"
import { listenQueueForSong } from "@/lib/playbackQueue"
import { songPlayback } from "@/lib/playback"
import { openSaveSheet } from "@/stores/saveSheetStore"
import type { SaveItem } from "@/lib/save/saveToSheet"
import { photoForSeed, type StockPhoto } from "@/lib/photos/catalog"
import { NAV_V2_PLAYER_ROUTE } from "@/lib/navV2"
import { routeString } from "@/lib/songMap"
import { peekSongDetail, fetchSongDetailCached } from "@/lib/songCache"
import { peekResolvedSong, resolveSongBundle } from "@/lib/songs"
import { alignLines, type AlignResult } from "@/lib/songPageVariants/alignLines"
import { aboutRows, type AboutRow } from "@/lib/songPageVariants/aboutFacts"
import { type SongFacts } from "@/lib/songPageVariants/layout"
import { meaningSourceFor, officialEnglishMeaning, storedMeaningRaw, type MeaningSource } from "@/lib/songPageVariants/meaningInfo"
import { demoCentralIdea, notationPdfUrl, pageExtras, watchVideos } from "@/lib/songPage/honest"
import { chartIsUsable } from "@/lib/songPage/chordChart"
import {
  effectiveTranslations,
  LYRIC_LANGUAGES,
  pickShown,
  resolveLyricLanguage,
  type LyricLanguage,
} from "@/lib/songPage/lyricLanguages"
import { availableScripts, buildLyricSources, scriptLines, type ScriptChoice, type ScriptId, type ScriptLines } from "@/lib/songPage/scripts"
import { explanationIsUsable, extrasForSong, glossesAreUsable, glossFor, type SongExtras } from "@/lib/songPage/songContent"
import { buildVersions, type SongVersion } from "@/lib/songPage/versions"
import { nowPlaying } from "@/lib/songPage/nowPlaying"
import { useSongMeaning } from "@/hooks/useSongMeaning"
import { useAmTheme } from "@/hooks/useAmTheme"
import { splitWords } from "@/lib/songPage/chordChart"
import { usePlayerStore } from "@/stores/playerStore"
import { useSongPageStore } from "@/stores/songPageStore"
import { href } from "@/utils/href"

import type { ChordChart } from "@/lib/songPage/chordChart"

export type MeaningState = {
  /** what is on screen: the text, still loading, or nothing */
  status: "ready" | "loading" | "none"
  /** the language of the text on screen (English when the asked one is missing) */
  language: string
  /** the language that was asked for */
  wanted: string
  /** the asked language is missing, English is shown instead */
  fellBack: boolean
  /** paragraphs for the Meaning page (soft line wraps joined) */
  text: string
  /** the text as the catalogue has it, line breaks kept: what line-by-line pairing reads */
  raw: string
  source: MeaningSource
  central: string | null
}

export type MeaningLanguageRow = { language: LyricLanguage; source: MeaningSource; inCatalogue: boolean }

export type RecordingRow = { id: string; url: string; title: string; subtitle: string; version: SongVersion | null }

/**
 * Everything the three song page variants draw, from the real data hooks: the song, its lyrics in the chosen
 * script, the meaning in one language with where it comes from, real videos, recordings, About facts, the
 * photo, and the actions (play, share, more, karaoke). One hook, so A, B and C can not disagree about a fact.
 * Sample content (word meanings, chords) is returned only for the preview's demo songs (`demo`).
 */
export function useSongVariantModel(songId: string | undefined) {
  const router = useRouter()
  const am = useAmTheme()
  const appLanguage = useLanguage()

  const [song, setSong] = useState<MockSong | null>(null)
  const [related, setRelated] = useState<MockSong[]>([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState<null | "actions" | "share">(null)
  const [toast, setToast] = useState("")
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(""), 2200)
  }, [])
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  // the preview's sample songs (PS 1 and PS 3) are demo content; every other number is the real catalogue
  const mockNumber = MOCKUP_DATA ? Number.parseInt((songId ?? "").replace(/\D/g, ""), 10) : Number.NaN
  const mockRow = Number.isFinite(mockNumber) ? mockupRow(mockNumber) : null
  const demo = MOCKUP_DATA && Boolean(mockRow)

  useEffect(() => {
    let active = true
    const sample = demo && mockRow ? mockupSong(mockRow.n) : null
    if (sample) {
      setSong(sample)
      setRelated([])
      setLoading(false)
      return
    }
    const peeked = peekResolvedSong(songId)
    if (peeked) {
      setSong(peeked.song)
      setRelated(peeked.related)
      setLoading(false)
    } else {
      setLoading(true)
    }
    void resolveSongBundle(songId).then((bundle) => {
      if (!active) return
      if (bundle) {
        setSong(bundle.song)
        setRelated(bundle.related)
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId, mockRow?.n])

  // the catalogue's own detail (dates, category, the raw english_meaning); the same cached request the page made
  const [detail, setDetail] = useState(() => (song ? peekSongDetail(song.number) : null))
  useEffect(() => {
    if (!song || demo) {
      setDetail(null)
      return
    }
    let active = true
    setDetail(peekSongDetail(song.number))
    void fetchSongDetailCached(song.number).then((d) => {
      if (active) setDetail(d)
    })
    return () => {
      active = false
    }
  }, [song?.number, demo]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- lyrics ----
  const script = useSongPageStore((s) => s.script)
  const setScript = useSongPageStore((s) => s.setScript)
  const sources = useMemo(
    () => buildLyricSources({ lyrics: song?.lyrics, transliteration: song?.transliteration, lyricsDevanagari: song?.lyricsDevanagari }),
    [song?.lyrics, song?.transliteration, song?.lyricsDevanagari],
  )
  const scripts = useMemo(() => availableScripts(sources), [sources])
  const lines: ScriptLines = useMemo(() => scriptLines(sources, script), [sources, script])

  // ---- real extras: nothing today; the demo songs get the prototype's samples ----
  const demoKey = demo && song ? mockupFixtureKey(song.number) : null
  const extras: SongExtras = useMemo(
    () => pageExtras({ real: song ? extrasForSong(song) : { chart: null, glosses: null, explanation: null }, demoKey, romanLines: sources.roman }),
    [song, demoKey, sources.roman],
  )
  const chart: ChordChart | null = chartIsUsable(extras.chart) ? extras.chart : null
  const glosses = glossesAreUsable(extras.glosses) ? extras.glosses : null
  const explanation = explanationIsUsable(extras.explanation) ? extras.explanation : null
  const wordLanguageChoice = useSongPageStore((s) => s.wordLanguage)
  const wordLanguage = useMemo(() => {
    const wanted = resolveLyricLanguage(wordLanguageChoice, appLanguage)
    const have = (code: string) => Object.keys(glosses?.byLanguage[code] ?? {}).length > 0
    return pickShown(wanted, have).shown ?? "en"
  }, [wordLanguageChoice, appLanguage, glosses])
  const wordCountsMatch = useMemo(
    () => lines.primary.map((line, i) => (lines.primaryScript === "roman" ? true : splitWords(line).length === splitWords(sources.roman[i] ?? "").length)),
    [lines, sources.roman],
  )
  /** The meaning of one word, or null (also null for any real song: there are no word meanings yet). */
  const glossOf = useCallback(
    (line: number, word: number): string | null => {
      if (!glosses || !wordCountsMatch[line]) return null
      return glossFor(glosses, [wordLanguage], line, word)?.text ?? null
    },
    [glosses, wordCountsMatch, wordLanguage],
  )

  // ---- meaning: one language at a time ----
  const storedTranslations = useSongPageStore((s) => s.translations)
  const setPrimaryTranslation = useSongPageStore((s) => s.setPrimaryTranslation)
  const wantedLanguage = useMemo(() => effectiveTranslations(storedTranslations, appLanguage)[0] ?? "en", [storedTranslations, appLanguage])
  const view = useSongMeaning(song, wantedLanguage)

  const englishRaw = useMemo(
    () => (song ? (demo ? (mockupTranslation(song.number, "en")?.join("\n") ?? null) : officialEnglishMeaning(song, detail ? detail.english_meaning ?? null : undefined)) : null),
    [song, demo, detail],
  )
  const rawIn = useCallback(
    (code: string): string | null => {
      if (!song) return null
      if (demo) return mockupTranslation(song.number, code)?.join("\n") ?? null
      if (code === "en") return englishRaw
      return storedMeaningRaw(song, code)
    },
    [song, demo, englishRaw],
  )

  const meaningBase: MeaningState = useMemo(() => {
    const none = (language: string): MeaningState => ({
      status: "none", language, wanted: wantedLanguage, fellBack: false, text: "", raw: "", source: "official", central: null,
    })
    if (!song) return none("en")
    const realCentral = (text: string | null | undefined) => (text && !/^placeholder/i.test(text.trim()) ? text.trim() : null)
    const english = (): MeaningState => {
      if (!englishRaw) return none("en")
      const text = view.meaning.status === "ready" && wantedLanguage === "en" ? view.meaning.text : englishRaw.replace(/\r?\n/g, " ")
      return {
        status: "ready", language: "en", wanted: wantedLanguage, fellBack: wantedLanguage !== "en", text, raw: englishRaw, source: "official",
        central: realCentral(song.centralIdea) ?? demoCentralIdea(demoKey),
      }
    }
    if (wantedLanguage === "en") return english()
    // another language: a text the catalogue stores, a demo sample, or what the translation service returned
    const raw = rawIn(wantedLanguage)
    if (raw) {
      return {
        status: "ready", language: wantedLanguage, wanted: wantedLanguage, fellBack: false,
        text: view.meaning.status === "ready" ? view.meaning.text : raw.replace(/\r?\n/g, " "), raw,
        source: meaningSourceFor(song, wantedLanguage), central: realCentral(view.centralIdea),
      }
    }
    if (view.meaning.status === "ready") {
      return {
        status: "ready", language: wantedLanguage, wanted: wantedLanguage, fellBack: false,
        text: view.meaning.text, raw: view.meaning.text, source: "machine", central: realCentral(view.centralIdea),
      }
    }
    if (view.meaning.status === "loading" || view.loading) return { ...none(wantedLanguage), status: "loading" }
    return english()
  }, [song, wantedLanguage, englishRaw, rawIn, view, demoKey])
  // a soft line break inside a paragraph is a space; a blank line stays a paragraph break
  const meaning: MeaningState = useMemo(
    () => ({ ...meaningBase, text: meaningBase.text.replace(/(?<!\n)\r?\n(?!\r?\n)/g, " ") }),
    [meaningBase],
  )

  const meaningRows: MeaningLanguageRow[] = useMemo(
    () =>
      LYRIC_LANGUAGES.map((language) => ({
        language,
        source: language.code === "en" ? "official" : meaningSourceFor(song ?? { hindiMeaning: null, localizedMeanings: {} }, language.code),
        inCatalogue: language.code === "en" ? Boolean(englishRaw) : Boolean(song && rawIn(language.code)),
      })),
    [song, englishRaw, rawIn],
  )

  // the lines the page pairs with the meaning: the script on screen, one for one
  const align: AlignResult = useMemo(() => alignLines(lines.primary, meaning.status === "ready" ? meaning.raw : null), [lines.primary, meaning])

  // ---- watch, recordings ----
  const videos: SongVideo[] = useMemo(() => watchVideos(song?.videos), [song?.videos])

  const recordings = useMemo(() => {
    if (!song) return []
    if (song.audioRecordings?.length) return song.audioRecordings
    return song.audioUrl ? [{ title: "Original rendition", url: song.audioUrl, provider: "official" }] : []
  }, [song])
  const mockVersions = useMemo(() => (demo && song ? mockupVersions(song.number) : null), [demo, song])
  const [mockVer, setMockVer] = useState(0)
  const selectedUrl = demo ? (mockVersions?.[mockVer]?.url ?? null) : (song?.audioUrl ?? recordings[0]?.url ?? null)

  const player = {
    playOrToggle: usePlayerStore((s) => s.playOrToggle),
    pause: usePlayerStore((s) => s.pause),
    syncCurrentSong: usePlayerStore((s) => s.syncCurrentSong),
    playbackMode: usePlayerStore((s) => s.playbackMode),
    queue: usePlayerStore((s) => s.queue),
    playlistBounds: usePlayerStore((s) => s.playlistBounds),
    currentSong: usePlayerStore((s) => s.currentSong),
    isPlaying: usePlayerStore((s) => s.isPlaying),
    isBuffering: usePlayerStore((s) => s.isBuffering),
  }
  const isCurrent = usePlayerStore((s) => (song ? songPlayback(s, song).isCurrent : false))
  const duration = usePlayerStore((s) => s.duration)
  const versions = useMemo(
    () => mockVersions ?? buildVersions(recordings, song?.performer ?? "", selectedUrl, isCurrent && duration > 0 ? duration : 0),
    [mockVersions, recordings, song?.performer, selectedUrl, isCurrent, duration],
  )
  const selectedVersion = mockVersions ? (mockVersions[mockVer] ?? mockVersions[0] ?? null) : (versions.find((v) => v.url === selectedUrl) ?? versions[0] ?? null)
  const queue = song ? listenQueueForSong(song.number, related.map((item) => item.number), player.playbackMode, player.queue, player.playlistBounds) : []
  const playing = song ? nowPlaying({ currentSong: player.currentSong, isPlaying: player.isPlaying, isBuffering: player.isBuffering }, song, versions) : null
  const showPause = playing?.showPause ?? false
  const playingIndex = playing?.versionIndex ?? -1
  useEffect(() => {
    if (demo && playingIndex >= 0) setMockVer(playingIndex)
  }, [demo, playingIndex])

  const playable = (version: SongVersion | null): MockSong => {
    if (!song) throw new Error("no song")
    if (!version) return song
    const url = demo ? demoUrl(song.number, Math.max(0, versions.findIndex((v) => v.id === version.id)) + 1) : version.url
    return { ...song, audioUrl: url, mediaHydrated: true as const }
  }
  const lastPlayAt = useRef(0)
  const handlePlay = () => {
    if (!song) return
    const now = Date.now()
    if (now - lastPlayAt.current < 350) return
    lastPlayAt.current = now
    if (showPause) return player.pause()
    if (demo) usePlayerStore.getState().playOrToggle(playable(selectedVersion), queue)
    else player.playOrToggle(song, queue)
  }
  /** Play one recording of the list. */
  const playRecording = (version: SongVersion) => {
    if (!song) return
    const index = Math.max(0, versions.findIndex((v) => v.id === version.id))
    if (playing?.isCurrent && playing.versionIndex === index) {
      if (showPause) return player.pause()
      return demo ? usePlayerStore.getState().playOrToggle(playable(version), queue) : player.playOrToggle(song, queue)
    }
    if (demo) {
      setMockVer(index)
      usePlayerStore.getState().loadSong(playable(version), queue, "default")
    } else {
      const next = { ...song, audioUrl: version.url, mediaHydrated: true as const }
      setSong(next)
      player.playOrToggle(next, queue)
    }
  }
  const openKaraoke = () => {
    if (!song) return
    // The Player opens on its word-by-word view; nothing starts to play, the song is only put in it.
    if (!isCurrent) {
      if (demo) {
        usePlayerStore.getState().loadSong(playable(selectedVersion), queue, "default")
        player.pause()
      } else {
        player.syncCurrentSong(song, queue)
      }
    }
    router.push(href(NAV_V2_PLAYER_ROUTE))
  }

  const recordingRows: RecordingRow[] = useMemo(
    () =>
      versions.map((version, index) => {
        const recording = recordings[index]
        return {
          id: version.id,
          url: version.url,
          // the catalogue names a recording by its audio file; it does not name a performer
          title: demo ? (version.label ?? version.performer) : (recording?.title ?? "").trim() || "",
          subtitle: demo ? version.performer : "",
          version,
        }
      }),
    [versions, recordings, demo],
  )

  // ---- save, download, share, more ----
  const saveItem: SaveItem | null = song ? { kind: "song", number: song.number } : null
  const downloadItem: DownloadItem | null =
    song && selectedUrl
      ? songDownloadItem(song.number, { url: selectedUrl, versionIndex: demo ? mockVer : undefined, title: song.title, seconds: demo ? (selectedVersion?.length ?? undefined) : undefined })
      : null
  const collection = useMemo(() => (song ? collectionForSong(song.number, allCollections) : null), [song])
  const activeQueue = player.queue
  const actionRows = useMemo(
    () =>
      buildActionRows({
        saved: false,
        inQueue: song ? activeQueue.includes(song.number) : false,
        collectionName: collection?.label ?? null,
        sourceName: "All songs",
        speedText: "1×",
        sleepText: "Off",
      }).filter((row) => (["share", "save", "playlist", "queue", "collection", "report"] as ActionId[]).includes(row.id)),
    [song, activeQueue, collection],
  )
  const sharePayload = useMemo(() => (song ? buildSharePayload({ number: song.number, title: song.title, performer: "" }) : null), [song])
  const onAction = (id: ActionId) => {
    if (!song) return
    switch (id) {
      case "share":
        return setSheet("share")
      case "save":
      case "playlist":
        setSheet(null)
        return saveItem ? openSaveSheet(saveItem) : undefined
      case "queue": {
        const there = activeQueue.includes(song.number)
        if (!there) realQueueActions().add(song.number)
        setSheet(null)
        return showToast(queueAddMessage(there))
      }
      case "collection": {
        setSheet(null)
        const label = collection?.label
        return router.push(href(label ? `/songs-v2-collection?id=${encodeURIComponent(label)}&title=${encodeURIComponent(label)}` : "/songs-v2-index"))
      }
      case "report":
        setSheet(null)
        return router.push(href(`/feedback?song=${song.number}`))
      default:
        return setSheet(null)
    }
  }
  const onShareTarget = (target: ShareTargetId, override?: Parameters<typeof runShare>[1]) => {
    const payload = override ?? sharePayload
    if (!payload) return
    void runShare(target, payload).then((outcome) => {
      const message = shareToast(outcome)
      if (message) {
        setSheet(null)
        showToast(message)
      }
    })
  }
  /** Opens Send feedback with this song picked: used by Report, Suggest a video and Request chords. */
  const sendNote = () => song && router.push(href(`/feedback?song=${song.number}`))

  // ---- About, photo, facts ----
  const about: AboutRow[] = useMemo(
    () => aboutRows({ metadata: detail?.metadata_json ?? null, theme: song?.themes?.[0] && song.themes[0] !== "Prabhat Samgiita" ? song.themes[0] : null, recordings, demo }),
    [detail, song, recordings, demo],
  )
  const theme = useMemo(() => about.find((row) => row.id === "theme") as Extract<AboutRow, { id: "theme" }> | undefined, [about])
  const photo: StockPhoto | null = useMemo(() => (song ? photoForSeed(`ps-${song.number}`, undefined, { size: "large" }) : null), [song?.number]) // eslint-disable-line react-hooks/exhaustive-deps

  const notationUrl = notationPdfUrl(song?.notationSourceUrl)
  const facts: SongFacts = {
    hasLyrics: lines.primary.length > 0,
    hasMeaning: meaning.status !== "none",
    hasWords: Boolean(glosses),
    hasChords: Boolean(chart),
    hasVideo: videos.length > 0,
    hasNotationPdf: Boolean(notationUrl),
    align,
  }

  return {
    // state of the load
    song, loading, demo, detail, related,
    // lyrics
    sources, scripts, lines, script: script as ScriptChoice, setScript: setScript as (script: ScriptChoice) => void, glosses, glossOf,
    chart, explanation, wordCountsMatch,
    // meaning
    meaning, meaningRows, setMeaningLanguage: setPrimaryTranslation, align,
    // watch and listen
    videos, notationUrl, recordingRows, versions, selectedVersion, showPause, handlePlay, playRecording, openKaraoke, playing,
    // actions
    saveItem, downloadItem, sheet, setSheet, actionRows, onAction, onShareTarget, sharePayload, sendNote, am, toast, showToast,
    // about
    about, theme, photo, facts,
  }
}

export type SongVariantModel = ReturnType<typeof useSongVariantModel>
export type { ScriptId }
