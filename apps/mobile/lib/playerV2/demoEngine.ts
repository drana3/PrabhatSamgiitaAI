import type { MemberPlaylist } from "@prabhat/core"

import type { MockSong } from "@/data/mock"
import {
  DEMO_PLAYLISTS,
  DEMO_SAVED_NUMBERS,
  DEMO_START_NUMBER,
  DEMO_START_POSITION,
  demoNumbers,
  demoSong,
  demoVersionIndex,
  demoVersionSeconds,
} from "@/lib/fixtures/playerDemo"
import { isSameSong } from "@/lib/playback"
import type { PlaybackMode } from "@/lib/playbackQueue"
import {
  createTrackEndHook,
  goNext,
  goPrevious,
  type ControllerDeps,
} from "@/lib/playerV2/controller"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { usePlayerStore } from "@/stores/playerStore"
import { usePlayerV2Store } from "@/stores/playerV2Store"
import { usePlaylistStore } from "@/stores/playlistStore"
import { usePreferencesStore } from "@/stores/preferencesStore"

/**
 * Web-preview demo player (EXPO_PUBLIC_MOCKUP_DATA=1 only). Seeds the player with the design's
 * opening state (PS 3 at 1:12, paused) and replaces the audio engine with a simulated clock, so
 * play, pause, next, previous, seek, speed, repeat, shuffle, the queue and every sheet work on the
 * screens, the mini player included, without any audio or API. The real engine is never touched
 * on a device, and none of this runs when the flag is off.
 */

type PlaylistSong = MemberPlaylist["songs"][number]

const TICK_MS = 200

let installed = false
let timer: ReturnType<typeof setInterval> | null = null
let lastTick = 0

const player = usePlayerStore

function demoDuration(song: MockSong): number {
  // a Kiirtan has one recording: its own length (12 minutes when the sample has none)
  if (song.kind === "kiirtan") return song.durationSeconds > 0 ? song.durationSeconds : 720
  const index = Math.max(0, demoVersionIndex(song.audioUrl))
  return demoVersionSeconds(song.number, index)
}

/** The song with the design's content and the version that was asked for (or remembered). */
function prepare(song: MockSong): MockSong {
  // A Kiirtan keeps its own record (no lyrics, no versions); the clock simulates the missing audio.
  if (song.kind === "kiirtan") return song
  let index = demoVersionIndex(song.audioUrl)
  if (index < 0) {
    const remembered = usePlayerV2Store.getState().versionByNumber[String(song.number)]
    const match = /-v(\d+)$/.exec(remembered ?? "")
    index = match ? Number(match[1]) - 1 : 0
  }
  return demoSong(song.number, song.title, index)
}

function startClock(): void {
  lastTick = Date.now()
  if (timer) return
  timer = setInterval(tick, TICK_MS)
}

function tick(): void {
  const now = Date.now()
  const dt = (now - lastTick) / 1000
  lastTick = now
  const s = player.getState()
  if (!s.isPlaying || !s.currentSong) return
  const position = s.position + dt * s.rate
  if (s.duration > 0 && position >= s.duration) {
    onTrackEnded()
    return
  }
  player.setState({ position })
}

let endDeps: ControllerDeps | null = null

function onTrackEnded(): void {
  if (!endDeps) return
  const s = player.getState()
  player.setState({ position: s.duration })
  if (createTrackEndHook(endDeps).onTrackEnded()) return
  if (usePlayerV2Store.getState().repeatMode === "one") {
    player.setState({ position: 0 })
    return
  }
  player.setState({ isPlaying: false, position: 0 })
}

function loadSong(song: MockSong, queue?: number[], mode?: PlaybackMode): void {
  const existing = player.getState()
  const prepared = prepare(song)
  const number = prepared.number
  const nextMode: PlaybackMode =
    mode ?? (existing.playbackMode === "playlist" && existing.playlistBounds?.includes(number) ? "playlist" : "default")
  const nextQueue = queue?.length ? queue : existing.queue.includes(number) ? existing.queue : [number]
  player.setState({
    currentSong: prepared,
    queue: nextQueue,
    playbackMode: nextMode,
    playlistBounds: nextMode === "playlist" ? (queue?.length ? queue : existing.playlistBounds) : null,
    activePlaylist: nextMode === "playlist" ? existing.activePlaylist : null,
    isPlaying: true,
    isBuffering: false,
    hasAudio: true,
    audioError: null,
    position: 0,
    duration: demoDuration(prepared),
  })
  startClock()
}

function togglePlay(): void {
  if (player.getState().isPlaying) pauseDemo()
  else playDemo()
}

function playDemo(): void {
  const s = player.getState()
  if (!s.currentSong) return
  player.setState({
    isPlaying: true,
    isBuffering: false,
    audioError: null,
    position: s.duration > 0 && s.position >= s.duration ? 0 : s.position,
  })
  startClock()
}

function pauseDemo(): void {
  player.setState({ isPlaying: false, isBuffering: false })
}

function seekTo(position: number): void {
  const { duration } = player.getState()
  const max = duration > 0 ? duration : position
  player.setState({ position: Math.max(0, Math.min(max, position)) })
}

function seekBy(delta: number): void {
  seekTo(player.getState().position + delta)
}

/** Local-only library: the design's saved songs and two playlists, no sign in, no sync. */
function installLibrary(): void {
  const seedSaved = () =>
    usePreferencesStore.setState({
      savedSongIds: DEMO_SAVED_NUMBERS.map((n) => `ps-${n}`),
      toggleSaved: async (songId: string) => {
        const existing = usePreferencesStore.getState().savedSongIds
        usePreferencesStore.setState({
          savedSongIds: existing.includes(songId) ? existing.filter((id) => id !== songId) : [...existing, songId],
        })
        return { needsAuth: false }
      },
    })
  if (usePreferencesStore.persist.hasHydrated()) seedSaved()
  else usePreferencesStore.persist.onFinishHydration(seedSaved)

  const toPlaylist = (p: (typeof DEMO_PLAYLISTS)[number]): MemberPlaylist => ({
    id: p.id,
    name: p.name,
    songs: p.songs.map((song_number, i) => ({ song_number, position: i + 1 })),
  })
  const store = usePlaylistStore
  const write = (playlists: MemberPlaylist[]) => store.setState({ playlists, error: null })
  const find = (id: string) => store.getState().playlists.find((p) => p.id === id)
  const replace = (next: MemberPlaylist) =>
    write(store.getState().playlists.map((p) => (p.id === next.id ? next : p)))
  store.setState({
    playlists: DEMO_PLAYLISTS.map(toPlaylist),
    loading: false,
    error: null,
    hydrateFromCache: async () => undefined,
    refresh: async () => undefined,
    flushSync: async () => undefined,
    createPlaylist: async (name: string) => {
      const created: MemberPlaylist = { id: `demo-pl-${Date.now()}`, name: name.trim() || "New playlist", songs: [] }
      write([...store.getState().playlists, created])
      return created
    },
    renamePlaylist: async (id: string, name: string) => {
      const current = find(id)
      if (!current) return { error: "Playlist not found." }
      const next = { ...current, name }
      replace(next)
      return next
    },
    deletePlaylist: async (id: string) => {
      write(store.getState().playlists.filter((p) => p.id !== id))
      return { ok: true as const }
    },
    addSong: async (id: string, songNumber: number) => {
      const current = find(id)
      if (!current) return { error: "Playlist not found." }
      if (current.songs.some((s: PlaylistSong) => s.song_number === songNumber)) return current
      const next = { ...current, songs: [...current.songs, { song_number: songNumber, position: current.songs.length + 1 }] }
      replace(next)
      return next
    },
    removeSong: async (id: string, songNumber: number) => {
      const current = find(id)
      if (!current) return { error: "Playlist not found." }
      const songs = current.songs
        .filter((s: PlaylistSong) => s.song_number !== songNumber)
        .map((s: PlaylistSong, i: number) => ({ ...s, position: i + 1 }))
      const next = { ...current, songs }
      replace(next)
      return next
    },
  })
}

/** Reset the persisted player choices so every reload opens like the prototype. */
function installPreferences(): void {
  const reset = () =>
    usePlayerV2Store.setState({
      playMode: "this",
      repeatMode: "off",
      script: "roman",
      translation: "en",
      wordMeanings: true,
      versionByNumber: {},
      shuffleOriginal: null,
    })
  if (usePlayerV2Store.persist.hasHydrated()) reset()
  else usePlayerV2Store.persist.onFinishHydration(reset)
}

/**
 * Installs the demo player. Call once at startup with the controller wiring (the same functions
 * the real player uses for next, previous and what follows a finished track).
 */
export function installDemoPlayer(deps: ControllerDeps): void {
  if (!MOCKUP_DATA || installed) return
  installed = true
  endDeps = deps

  const start = demoSong(DEMO_START_NUMBER)
  player.setState({
    currentSong: start,
    queue: demoNumbers(),
    playbackMode: "default",
    playlistBounds: null,
    activePlaylist: null,
    isPlaying: false,
    isBuffering: false,
    hasAudio: true,
    audioError: null,
    position: DEMO_START_POSITION,
    duration: demoDuration(start),
    rate: 1,

    loadSong,
    playOrToggle: (song, queue) => {
      if (isSameSong(player.getState().currentSong, song)) {
        if (queue?.length) player.setState({ queue })
        togglePlay()
        return
      }
      loadSong(song, queue, "default")
    },
    togglePlay,
    play: playDemo,
    pause: pauseDemo,
    seekTo,
    seekBy,
    setRate: (rate: number) => player.setState({ rate: Math.min(1.5, Math.max(0.5, rate)) }),
    next: () => {
      goNext(deps)
    },
    previous: () => {
      if (!goPrevious(deps)) seekTo(0)
    },
    setQueue: (numbers: number[]) => player.setState({ queue: numbers }),
    replaceQueue: (numbers: number[]) =>
      player.setState((s) => ({
        queue: numbers,
        playlistBounds: s.playbackMode === "playlist" ? numbers : s.playlistBounds,
      })),
    toggleRepeat: () => player.setState((s) => ({ repeat: !s.repeat })),
    syncCurrentSong: () => undefined,
    warmAudio: () => undefined,
    clear: () =>
      player.setState({
        currentSong: null,
        isPlaying: false,
        position: 0,
        duration: 0,
        hasAudio: false,
        playlistBounds: null,
        activePlaylist: null,
      }),
  })

  installPreferences()
  installLibrary()
  startClock()
  // Handle for tests and for poking the preview from the console.
  ;(globalThis as { __psDemo?: unknown }).__psDemo = { player: usePlayerStore, prefs: usePlayerV2Store }
}
