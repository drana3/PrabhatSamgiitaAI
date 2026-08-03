import { Audio, type AVPlaybackStatus } from "expo-av"
import { create } from "zustand"

import type { MockSong } from "@/data/mock"
import { api } from "@/lib/client"
import { isSameSong } from "@/lib/playback"
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
  playOrToggle: (song: MockSong, queue?: number[]) => void
  setQueue: (numbers: number[]) => void
  togglePlay: () => void
  play: () => void
  pause: () => void
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
}

const bag = globalThis as typeof globalThis & AudioBag
if (typeof bag.__psLoadId !== "number") bag.__psLoadId = 0
if (typeof bag.__psPlayToken !== "number") bag.__psPlayToken = 0
if (bag.__psSound === undefined) bag.__psSound = null
if (!bag.__psAudioChain) bag.__psAudioChain = Promise.resolve()

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
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  })
}

/** Stop every native stream, including orphans that lost their JS handle. */
async function silenceAllAudio() {
  try {
    await Audio.setIsEnabledAsync(false)
    await Audio.setIsEnabledAsync(true)
  } catch {
    /* ignore */
  }
  try {
    await setPlaybackMode()
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
  try {
    await current.stopAsync()
  } catch {
    /* ignore */
  }
  try {
    await current.unloadAsync()
  } catch {
    /* ignore */
  }
}

function bindStatus(owner: Audio.Sound) {
  owner.setOnPlaybackStatusUpdate((status) => {
    if (getSound() !== owner) return

    if (!status.isLoaded) {
      if (status.error) {
        usePlayerStore.setState({
          isPlaying: false,
          isBuffering: false,
          audioError: "Audio could not be played.",
        })
      }
      return
    }

    if (status.didJustFinish) {
      usePlayerStore.setState({
        isPlaying: false,
        isBuffering: false,
        position: Math.max(1, Math.floor((status.durationMillis || 0) / 1000)),
        duration: Math.max(1, Math.floor((status.durationMillis || 0) / 1000)),
        audioError: null,
      })
      return
    }

    usePlayerStore.setState({
      isPlaying: status.isPlaying,
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
  if (song.mediaHydrated && song.audioUrl) return song
  try {
    const detail = await api.fetchSong(song.number)
    if (!detail) return { ...song, mediaHydrated: true }
    const mapped = songDetailToMockSong(detail)
    return {
      ...song,
      ...mapped,
      imageUrl: song.imageUrl || mapped.imageUrl,
      thumbnailUrl: song.thumbnailUrl || mapped.thumbnailUrl,
      mediaHydrated: true,
    }
  } catch {
    return { ...song, mediaHydrated: true }
  }
}

async function attachSound(
  song: MockSong,
  options: { shouldPlay: boolean; positionMillis?: number; id: number; token: number },
) {
  const uri = song.audioUrl?.trim()
  if (!uri) {
    usePlayerStore.setState({
      hasAudio: false,
      isPlaying: false,
      isBuffering: false,
      audioError: "No in-app audio stream is available for this song yet.",
    })
    return
  }

  await setPlaybackMode()
  await destroySound()
  // Kill orphans from any prior raced createAsync before starting a new one.
  await silenceAllAudio()
  if (options.id !== bag.__psLoadId || options.token !== bag.__psPlayToken) return

  const created = await Audio.Sound.createAsync(
    { uri },
    {
      shouldPlay: options.shouldPlay,
      positionMillis: Math.max(0, options.positionMillis ?? 0),
      volume: usePlayerStore.getState().volume,
      progressUpdateIntervalMillis: 400,
    },
  )

  if (options.id !== bag.__psLoadId || options.token !== bag.__psPlayToken) {
    try {
      await created.sound.stopAsync()
    } catch {
      /* ignore */
    }
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
    await silenceAllAudio()
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
}

async function openAndPlay(song: MockSong, queue: number[] | undefined, id: number) {
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
    const existing = getSound()
    if (existing) bindStatus(existing)
  },

  loadSong: (song, queue) => {
    if (isSameSong(get().currentSong, song)) {
      get().syncCurrentSong(song, queue)
      return
    }
    bag.__psLoadId += 1
    bag.__psPlayToken += 1
    const id = bag.__psLoadId
    void enqueueAudio(() => openAndPlay(song, queue, id))
  },

  playOrToggle: (song, queue) => {
    if (isSameSong(get().currentSong, song)) {
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
      set({ isPlaying: true, isBuffering: !getSound(), audioError: null })
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
              await silenceAllAudio()
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
        set({ isPlaying: false, isBuffering: false })
        return
      }
      bag.__psLoadId += 1
      await openAndPlay(song, undefined, bag.__psLoadId)
    })
  },

  pause: () => {
    bag.__psPlayToken += 1
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
    void enqueueAudio(async () => {
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
