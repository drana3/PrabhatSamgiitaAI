import { Audio, type AVPlaybackStatus } from "expo-av"
import { create } from "zustand"

import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { isSameAudioTrack, isSameSong } from "@/lib/playback"
import { resolvePlaybackUri } from "@/lib/offlineAudio"
import { songDetailToMockSong } from "@/lib/songMap"
import { usePreferencesStore } from "@/stores/preferencesStore"

type PlayerState = {
  currentSong: MockSong | null
  queue: number[]
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  hasAudio: boolean
  audioError: string | null
  isBuffering: boolean
  loadSong: (song: MockSong, queue?: number[]) => void
  /** Sync metadata/queue for the already-active track. Never restarts audio. */
  syncCurrentSong: (song: MockSong, queue?: number[]) => void
  /** Warm audio session + cache media URL so the next Play starts faster. */
  warmAudio: (song?: MockSong | null) => void
  playOrToggle: (song: MockSong, queue?: number[]) => void
  setQueue: (numbers: number[]) => void
  togglePlay: () => void
  play: () => void
  pause: () => void
  /** Pause playback and reopen the mic for speech recognition. */
  prepareForSpeechCapture: () => Promise<void>
  seekTo: (position: number) => void
  seekBy: (deltaSeconds: number) => void
  setVolume: (volume: number) => void
  adjustVolume: (delta: number) => void
  next: () => void
  previous: () => void
  clear: () => void
}

/** Survive Fast Refresh so we never lose the native player handle. */
type AudioBag = {
  __psSound: Audio.Sound | null
  __psLoadId: number
  __psPlayToken: number
  __psAudioChain: Promise<void>
  __psModeReady: boolean
  __psMediaCache: Map<number, MockSong>
  __psPreload: { uri: string; number: number; sound: Audio.Sound } | null
  /** User intends continuous playback — used to auto-resume after buffer stalls. */
  __psWantPlaying: boolean
  __psLastResumeNudgeMs: number
}

const bag = globalThis as typeof globalThis & AudioBag
if (typeof bag.__psLoadId !== "number") bag.__psLoadId = 0
if (typeof bag.__psPlayToken !== "number") bag.__psPlayToken = 0
if (bag.__psSound === undefined) bag.__psSound = null
if (!bag.__psAudioChain) bag.__psAudioChain = Promise.resolve()
if (typeof bag.__psModeReady !== "boolean") bag.__psModeReady = false
if (!bag.__psMediaCache) bag.__psMediaCache = new Map()
if (bag.__psPreload === undefined) bag.__psPreload = null
if (typeof bag.__psWantPlaying !== "boolean") bag.__psWantPlaying = false
if (typeof bag.__psLastResumeNudgeMs !== "number") bag.__psLastResumeNudgeMs = 0

function getSound() {
  return bag.__psSound
}

function setSound(next: Audio.Sound | null) {
  bag.__psSound = next
}

/** Serialize native audio work so create/destroy/pause never overlap. */
function enqueueAudio(op: () => Promise<void>) {
  const run = bag.__psAudioChain.then(op, op)
  bag.__psAudioChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function setPlaybackMode() {
  if (bag.__psModeReady) return
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  })
  bag.__psModeReady = true
}

function isIosPlatform() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native") as { Platform: { OS: string } }
    return Platform.OS === "ios"
  } catch {
    return false
  }
}

/** Stop every native stream, including orphans that lost their JS handle. */
async function silenceAllAudio() {
  try {
    await Audio.setIsEnabledAsync(false)
    await Audio.setIsEnabledAsync(true)
  } catch {
    /* ignore */
  }
  bag.__psModeReady = false
  try {
    await setPlaybackMode()
  } catch {
    /* ignore */
  }
}

async function discardPreload() {
  const preload = bag.__psPreload
  bag.__psPreload = null
  if (!preload) return
  try {
    preload.sound.setOnPlaybackStatusUpdate(null)
  } catch {
    /* ignore */
  }
  try {
    await preload.sound.unloadAsync()
  } catch {
    /* ignore */
  }
}

async function destroySound() {
  const current = getSound()
  setSound(null)
  if (!current) return
  try {
    current.setOnPlaybackStatusUpdate(null)
  } catch {
    /* ignore */
  }
  // unloadAsync stops playback — skip stopAsync to save a native round-trip
  try {
    await current.unloadAsync()
  } catch {
    /* ignore */
  }
}

/** Touch the CDN so TLS + first bytes are ready before AVPlayer opens the stream. */
async function warmNetwork(uri: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1200)
  try {
    await fetch(uri, {
      method: "GET",
      headers: { Range: "bytes=0-2047" },
      signal: controller.signal,
    })
  } catch {
    /* ignore — best-effort only; never block playback */
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Preload a paused Sound only when nothing is currently loaded.
 * Creating a second AVPlayer/Sound while one is playing interrupts iOS streams mid-song.
 */
async function preloadSound(songNumber: number, uri: string) {
  const trimmed = uri.trim()
  if (!trimmed) return
  if (getSound()) return
  if (bag.__psPreload?.uri === trimmed && bag.__psPreload.number === songNumber) return

  await setPlaybackMode()
  if (getSound()) return
  await discardPreload()
  try {
    const created = await Audio.Sound.createAsync(
      { uri: trimmed },
      {
        shouldPlay: false,
        volume: usePlayerStore.getState().volume,
        progressUpdateIntervalMillis: 500,
      },
      null,
      false,
    )
    // A play may have started while we were loading — never keep a competing Sound.
    if (getSound()) {
      try {
        await created.sound.unloadAsync()
      } catch {
        /* ignore */
      }
      return
    }
    await discardPreload()
    bag.__psPreload = { uri: trimmed, number: songNumber, sound: created.sound }
  } catch {
    /* ignore preload failures — play path will create normally */
  }
}

/** Cache next track URL + CDN warm only — do not create a second Sound while playing. */
function prefetchNextInQueue(currentNumber: number, queue: number[]) {
  const idx = queue.indexOf(currentNumber)
  const nextNumber =
    idx >= 0 && idx < queue.length - 1 ? queue[idx + 1] : currentNumber > 0 ? currentNumber + 1 : null
  if (!nextNumber) return
  void (async () => {
    try {
      const stub: MockSong = {
        id: `ps-${nextNumber}`,
        number: nextNumber,
        title: "",
        shortDescription: "",
        imageUrl: "",
        thumbnailUrl: "",
        themes: [],
        meaning: "",
        lyrics: "",
        translation: "",
        durationSeconds: 300,
        performer: "",
        videos: [],
        audioUrl: null,
        mediaHydrated: false,
      }
      const ready = await hydrate(stub)
      const uri = ready.audioUrl?.trim()
      if (!uri) return
      bag.__psMediaCache.set(nextNumber, ready)
      // Do not fetch the next MP3 until the user plays or saves it.
    } catch {
      /* ignore */
    }
  })()
}

function bindStatus(owner: Audio.Sound) {
  owner.setOnPlaybackStatusUpdate((status) => {
    if (getSound() !== owner) return

    if (!status.isLoaded) {
      if (status.error) {
        bag.__psWantPlaying = false
        usePlayerStore.setState({
          isPlaying: false,
          isBuffering: false,
          audioError: "Audio could not be played.",
        })
      }
      return
    }

    if (status.didJustFinish) {
      bag.__psWantPlaying = false
      usePlayerStore.setState({
        isPlaying: false,
        isBuffering: false,
        position: Math.max(1, Math.floor((status.durationMillis || 0) / 1000)),
        duration: Math.max(1, Math.floor((status.durationMillis || 0) / 1000)),
        audioError: null,
      })
      return
    }

    const finished = atEnd(status)
    const wantPlaying = bag.__psWantPlaying && !finished

    // Buffer underrun / brief stall: keep wanting play and nudge AVPlayer to continue.
    if (wantPlaying && !status.isPlaying && !status.isBuffering) {
      const now = Date.now()
      if (now - bag.__psLastResumeNudgeMs > 1200) {
        bag.__psLastResumeNudgeMs = now
        void owner.playAsync().catch(() => undefined)
      }
    }

    usePlayerStore.setState({
      isPlaying: status.isPlaying || (wantPlaying && Boolean(status.isBuffering)),
      isBuffering: Boolean(status.isBuffering) && !status.isPlaying,
      position: Math.floor((status.positionMillis || 0) / 1000),
      duration: Math.max(1, Math.floor((status.durationMillis || 0) / 1000)),
      hasAudio: true,
      audioError: null,
    })
  })
}

function atEnd(status: AVPlaybackStatus) {
  if (!status.isLoaded || status.isPlaying) return false
  if (status.didJustFinish) return true
  const duration = status.durationMillis || 0
  const position = status.positionMillis || 0
  return duration > 0 && position >= duration - 400
}

async function hydrate(song: MockSong): Promise<MockSong> {
  if (song.mediaHydrated && song.audioUrl) {
    bag.__psMediaCache.set(song.number, song)
    return song
  }
  const cached = bag.__psMediaCache.get(song.number)
  if (cached?.audioUrl) {
    return {
      ...song,
      ...cached,
      imageUrl: song.imageUrl || cached.imageUrl,
      thumbnailUrl: song.thumbnailUrl || cached.thumbnailUrl,
      mediaHydrated: true,
    }
  }
  try {
    const detail = await api.fetchSong(song.number)
    if (!detail) return { ...song, mediaHydrated: true }
    const mapped = songDetailToMockSong(detail)
    const ready = {
      ...song,
      ...mapped,
      imageUrl: song.imageUrl || mapped.imageUrl,
      thumbnailUrl: song.thumbnailUrl || mapped.thumbnailUrl,
      mediaHydrated: true,
    }
    bag.__psMediaCache.set(song.number, ready)
    return ready
  } catch {
    return { ...song, mediaHydrated: true }
  }
}

async function attachSound(
  song: MockSong,
  options: { shouldPlay: boolean; positionMillis?: number; id: number; token: number },
) {
  const source = await resolvePlaybackUri(song.number, song.audioUrl)
  if (!source) {
    usePlayerStore.setState({
      hasAudio: false,
      isPlaying: false,
      isBuffering: false,
      audioError: "No in-app audio stream is available for this song yet.",
    })
    return
  }
  const { uri } = source

  await setPlaybackMode()
  if (options.id !== bag.__psLoadId || options.token !== bag.__psPlayToken) return

  // Fast path: promote a preloaded Sound (already buffered) — play starts immediately.
  const preload = bag.__psPreload
  if (
    preload &&
    preload.uri === uri &&
    preload.number === song.number &&
    (options.positionMillis ?? 0) === 0
  ) {
    bag.__psPreload = null
    await destroySound()
    if (options.id !== bag.__psLoadId || options.token !== bag.__psPlayToken) {
      try {
        await preload.sound.unloadAsync()
      } catch {
        /* ignore */
      }
      return
    }
    setSound(preload.sound)
    bindStatus(preload.sound)
    try {
      if (options.shouldPlay) await preload.sound.playAsync()
      const status = await preload.sound.getStatusAsync()
      usePlayerStore.setState({
        currentSong: song,
        hasAudio: true,
        isPlaying: status.isLoaded ? status.isPlaying : options.shouldPlay,
        isBuffering: status.isLoaded ? Boolean(status.isBuffering) && !status.isPlaying : false,
        audioError: null,
        position: status.isLoaded ? Math.floor((status.positionMillis || 0) / 1000) : 0,
        duration: status.isLoaded
          ? Math.max(1, Math.floor((status.durationMillis || 0) / 1000))
          : song.durationSeconds,
      })
      if (options.shouldPlay) {
        prefetchNextInQueue(song.number, usePlayerStore.getState().queue)
      }
      return
    } catch {
      try {
        await preload.sound.unloadAsync()
      } catch {
        /* fall through to create */
      }
      setSound(null)
    }
  }

  // Warm CDN in parallel for remote streams only. Local files skip the network.
  if (!source.local && !uri.startsWith("file:")) {
    void warmNetwork(uri)
  }
  await destroySound()
  if (options.id !== bag.__psLoadId || options.token !== bag.__psPlayToken) return

  const created = await Audio.Sound.createAsync(
    { uri },
    {
      shouldPlay: options.shouldPlay,
      positionMillis: Math.max(0, options.positionMillis ?? 0),
      volume: usePlayerStore.getState().volume,
      progressUpdateIntervalMillis: 500,
    },
    null,
    false,
  )

  if (options.id !== bag.__psLoadId || options.token !== bag.__psPlayToken) {
    try {
      await created.sound.unloadAsync()
    } catch {
      /* ignore */
    }
    return
  }

  setSound(created.sound)
  bindStatus(created.sound)

  if (options.token !== bag.__psPlayToken) {
    try {
      await created.sound.pauseAsync()
    } catch {
      /* ignore */
    }
    usePlayerStore.setState({ isPlaying: false, isBuffering: false, hasAudio: true })
    return
  }

  const status = await created.sound.getStatusAsync()
  usePlayerStore.setState({
    currentSong: song,
    hasAudio: true,
    isPlaying: status.isLoaded ? status.isPlaying : options.shouldPlay,
    isBuffering: status.isLoaded ? Boolean(status.isBuffering) && !status.isPlaying : options.shouldPlay,
    audioError: null,
    position: status.isLoaded
      ? Math.floor((status.positionMillis || 0) / 1000)
      : Math.floor((options.positionMillis ?? 0) / 1000),
    duration: status.isLoaded
      ? Math.max(1, Math.floor((status.durationMillis || 0) / 1000))
      : song.durationSeconds,
  })
  if (options.shouldPlay) {
    prefetchNextInQueue(song.number, usePlayerStore.getState().queue)
  }
}

async function openAndPlay(song: MockSong, queue: number[] | undefined, id: number) {
  bag.__psWantPlaying = true
  usePreferencesStore.getState().recordRecentPlay(song)
  usePlayerStore.setState({
    currentSong: song,
    queue: queue?.length ? queue : usePlayerStore.getState().queue,
    isPlaying: true,
    isBuffering: true,
    position: 0,
    duration: song.durationSeconds,
    hasAudio: Boolean(song.audioUrl),
    audioError: null,
  })

  // Play a downloaded file immediately — no network needed.
  const offline = await resolvePlaybackUri(song.number, song.audioUrl)
  if (offline?.local) {
    bag.__psMediaCache.set(song.number, song)
    await attachSound(song, {
      shouldPlay: true,
      positionMillis: 0,
      id,
      token: bag.__psPlayToken,
    })
    return
  }

  // If we already have a stream URL, start audio immediately (don't block on metadata merge).
  if (song.mediaHydrated && song.audioUrl?.trim()) {
    bag.__psMediaCache.set(song.number, song)
    await attachSound(song, {
      shouldPlay: true,
      positionMillis: 0,
      id,
      token: bag.__psPlayToken,
    })
    return
  }

  const ready = await hydrate(song)
  if (id !== bag.__psLoadId) return

  usePlayerStore.setState({
    currentSong: ready,
    hasAudio: Boolean(ready.audioUrl),
    duration: ready.durationSeconds,
  })

  await attachSound(ready, {
    shouldPlay: true,
    positionMillis: 0,
    id,
    token: bag.__psPlayToken,
  })
}

function mergeSong(current: MockSong | null, song: MockSong): MockSong {
  if (!current || !isSameSong(current, song)) return song
  return {
    ...current,
    ...song,
    audioUrl: song.audioUrl || current.audioUrl || null,
    audioRecordings: song.audioRecordings?.length ? song.audioRecordings : current.audioRecordings,
    mediaHydrated: Boolean(song.audioUrl || current.audioUrl || song.mediaHydrated || current.mediaHydrated),
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  hasAudio: false,
  audioError: null,
  isBuffering: false,

  setQueue: (numbers) => set({ queue: numbers }),

  syncCurrentSong: (song, queue) => {
    const merged = mergeSong(get().currentSong, song)
    if (queue?.length) set({ queue })
    set({
      currentSong: merged,
      hasAudio: Boolean(merged.audioUrl) || get().hasAudio,
      audioError: null,
    })
    if (merged.audioUrl) bag.__psMediaCache.set(merged.number, merged)
    const existing = getSound()
    if (existing) bindStatus(existing)
  },

  warmAudio: (song) => {
    void setPlaybackMode().catch(() => undefined)
    if (!song) return
    void (async () => {
      try {
        const ready =
          song.mediaHydrated && song.audioUrl?.trim() ? song : await hydrate(song)
        if (ready.audioUrl?.trim()) bag.__psMediaCache.set(ready.number, ready)
        // Metadata only. Do not fetch/save the MP3 until the user taps Play or Save.
      } catch {
        /* ignore */
      }
    })()
  },

  loadSong: (song, queue) => {
    if (isSameAudioTrack(get().currentSong, song)) {
      get().syncCurrentSong(song, queue)
      return
    }
    bag.__psLoadId += 1
    bag.__psPlayToken += 1
    const id = bag.__psLoadId
    void enqueueAudio(() => openAndPlay(song, queue, id))
  },

  playOrToggle: (song, queue) => {
    if (isSameAudioTrack(get().currentSong, song)) {
      if (queue?.length) set({ queue })
      get().togglePlay()
      return
    }
    get().loadSong(song, queue)
  },

  togglePlay: () => {
    void (async () => {
      const sound = getSound()
      if (sound) {
        try {
          const status = await sound.getStatusAsync()
          if (status.isLoaded && status.isPlaying) {
            get().pause()
            return
          }
        } catch {
          /* fall through */
        }
      } else if (get().isPlaying) {
        get().pause()
        return
      }
      get().play()
    })()
  },

  play: () => {
    void enqueueAudio(async () => {
      if (get().isPlaying) {
        const sound = getSound()
        if (sound) {
          try {
            const status = await sound.getStatusAsync()
            if (status.isLoaded && status.isPlaying) return
          } catch {
            /* continue to play */
          }
        }
      }
      const token = (bag.__psPlayToken += 1)
      bag.__psWantPlaying = true
      set({ isPlaying: true, isBuffering: !getSound(), audioError: null })
      // After speech recognition, playback mode may have been switched to recording.
      bag.__psModeReady = false
      const current = getSound()
      if (current) {
        try {
          await setPlaybackMode()
          const status = await current.getStatusAsync()
          if (token !== bag.__psPlayToken) return
          if (status.isLoaded) {
            if (atEnd(status)) await current.setPositionAsync(0)
            await current.playAsync()
            if (token !== bag.__psPlayToken) {
              await current.pauseAsync().catch(() => undefined)
              return
            }
            set({ isPlaying: true, isBuffering: false })
            return
          }
        } catch {
          /* reload below */
        }
        await destroySound()
      }
      if (token !== bag.__psPlayToken) return
      const song = get().currentSong
      if (!song) {
        bag.__psWantPlaying = false
        set({ isPlaying: false, isBuffering: false })
        return
      }
      bag.__psLoadId += 1
      await openAndPlay(song, undefined, bag.__psLoadId)
    })
  },

  pause: () => {
    bag.__psPlayToken += 1
    bag.__psWantPlaying = false
    set({ isPlaying: false, isBuffering: false })
    void enqueueAudio(async () => {
      const current = getSound()
      if (current) {
        try {
          await current.pauseAsync()
        } catch {
          try {
            await current.setStatusAsync({ shouldPlay: false })
          } catch {
            /* ignore */
          }
        }
        return
      }
      // No JS handle — kill orphan native streams only in that case.
      await silenceAllAudio()
    })
  },

  prepareForSpeechCapture: async () => {
    bag.__psPlayToken += 1
    bag.__psWantPlaying = false
    set({ isPlaying: false, isBuffering: false })
    await enqueueAudio(async () => {
      const current = getSound()
      if (current) {
        try {
          await current.pauseAsync()
        } catch {
          try {
            await current.setStatusAsync({ shouldPlay: false })
          } catch {
            /* ignore */
          }
        }
        return
      }
      await silenceAllAudio()
    })
    if (!isIosPlatform()) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      return
    }
    try {
      bag.__psModeReady = false
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      })
    } catch {
      /* ignore */
    }
  },

  seekTo: (position) => {
    set({ position })
    const current = getSound()
    if (current) {
      void current.setPositionAsync(Math.max(0, position) * 1000).catch(() => undefined)
    }
  },

  seekBy: (deltaSeconds) => {
    const { position, duration } = get()
    const max = duration > 0 ? duration : Math.max(0, position + deltaSeconds)
    get().seekTo(Math.max(0, Math.min(max, position + deltaSeconds)))
  },

  setVolume: (volume) => {
    const clamped = Math.min(1, Math.max(0, volume))
    set({ volume: clamped })
    const current = getSound()
    if (current) {
      void current.setVolumeAsync(clamped).catch(() => undefined)
    }
  },

  adjustVolume: (delta) => {
    get().setVolume(get().volume + delta)
  },

  next: () => {
    const current = get().currentSong
    if (!current) return
    const queue = get().queue
    const idx = queue.indexOf(current.number)
    const nextNumber =
      idx >= 0 && idx < queue.length - 1 ? queue[idx + 1] : current.number + 1
    bag.__psLoadId += 1
    const id = bag.__psLoadId
    bag.__psPlayToken += 1
    void (async () => {
      const detail = await api.fetchSong(nextNumber)
      if (!detail || id !== bag.__psLoadId) return
      await openAndPlay(songDetailToMockSong(detail), undefined, id)
    })()
  },

  previous: () => {
    const current = get().currentSong
    if (!current) return
    const queue = get().queue
    const idx = queue.indexOf(current.number)
    const prevNumber = idx > 0 ? queue[idx - 1] : Math.max(1, current.number - 1)
    bag.__psLoadId += 1
    const id = bag.__psLoadId
    bag.__psPlayToken += 1
    void (async () => {
      const detail = await api.fetchSong(prevNumber)
      if (!detail || id !== bag.__psLoadId) return
      await openAndPlay(songDetailToMockSong(detail), undefined, id)
    })()
  },

  clear: () => {
    bag.__psPlayToken += 1
    bag.__psLoadId += 1
    bag.__psWantPlaying = false
    void enqueueAudio(async () => {
      await discardPreload()
      await destroySound()
      await silenceAllAudio()
    })
    set({
      currentSong: null,
      isPlaying: false,
      position: 0,
      duration: 0,
      hasAudio: false,
      audioError: null,
      isBuffering: false,
    })
  },
}))
