import { vi } from "vitest"

type Track = { id?: string; url?: string; title?: string; duration?: number }

const queue: Track[] = []
let index = 0
let playing = false
const listeners = new Map<string, Set<(event: unknown) => void>>()

function emit(event: string, payload: unknown) {
  for (const cb of listeners.get(event) ?? []) cb(payload)
}

export const Event = {
  RemotePlay: "remote-play",
  RemotePause: "remote-pause",
  RemoteStop: "remote-stop",
  RemoteNext: "remote-next",
  RemotePrevious: "remote-previous",
  RemoteSeek: "remote-seek",
  PlaybackState: "playback-state",
  PlaybackProgressUpdated: "playback-progress-updated",
  PlaybackActiveTrackChanged: "playback-active-track-changed",
  PlaybackQueueEnded: "playback-queue-ended",
  PlaybackError: "playback-error",
}

export const State = {
  None: "none",
  Ready: "ready",
  Playing: "playing",
  Paused: "paused",
  Stopped: "stopped",
  Buffering: "buffering",
  Loading: "loading",
  Error: "error",
  Ended: "ended",
}

export const Capability = {
  Play: "play",
  Pause: "pause",
  SkipToNext: "skip-to-next",
  SkipToPrevious: "skip-to-previous",
  SeekTo: "seek-to",
  Stop: "stop",
}

export const RepeatMode = { Off: "off", Track: "track", Queue: "queue" }
export const AppKilledPlaybackBehavior = { ContinuePlayback: "continue" }

const TrackPlayer = {
  setupPlayer: vi.fn(async () => undefined),
  updateOptions: vi.fn(async () => undefined),
  registerPlaybackService: vi.fn(),
  reset: vi.fn(async () => {
    queue.splice(0, queue.length)
    index = 0
    playing = false
  }),
  add: vi.fn(async (track: Track | Track[]) => {
    const items = Array.isArray(track) ? track : [track]
    queue.push(...items)
  }),
  play: vi.fn(async () => {
    playing = true
    emit(Event.PlaybackState, { state: State.Playing })
  }),
  pause: vi.fn(async () => {
    playing = false
    emit(Event.PlaybackState, { state: State.Paused })
  }),
  stop: vi.fn(async () => {
    playing = false
    emit(Event.PlaybackState, { state: State.Stopped })
  }),
  seekTo: vi.fn(async () => undefined),
  setVolume: vi.fn(async () => undefined),
  setRepeatMode: vi.fn(async () => undefined),
  skipToNext: vi.fn(async () => {
    if (index >= queue.length - 1) throw new Error("no next")
    index += 1
    emit(Event.PlaybackActiveTrackChanged, { index, track: queue[index] })
    if (playing) emit(Event.PlaybackState, { state: State.Playing })
  }),
  skipToPrevious: vi.fn(async () => {
    if (index <= 0) throw new Error("no previous")
    index -= 1
    emit(Event.PlaybackActiveTrackChanged, { index, track: queue[index] })
  }),
  removeUpcomingTracks: vi.fn(async () => {
    if (index < queue.length - 1) queue.splice(index + 1)
  }),
  getQueue: vi.fn(async () => [...queue]),
  getActiveTrackIndex: vi.fn(async () => (queue.length ? index : null)),
  getActiveTrack: vi.fn(async () => queue[index] ?? null),
  getProgress: vi.fn(async () => ({ position: 0, duration: 300 })),
  getPlaybackState: vi.fn(async () => ({ state: playing ? State.Playing : State.Paused })),
  addEventListener: vi.fn((event: string, cb: (payload: unknown) => void) => {
    const set = listeners.get(event) ?? new Set()
    set.add(cb)
    listeners.set(event, set)
    return { remove: () => set.delete(cb) }
  }),
}

export function __resetFakeTrackPlayer() {
  queue.splice(0, queue.length)
  index = 0
  playing = false
  listeners.clear()
  TrackPlayer.setupPlayer.mockClear()
  TrackPlayer.updateOptions.mockClear()
  TrackPlayer.reset.mockClear()
  TrackPlayer.add.mockClear()
  TrackPlayer.play.mockClear()
  TrackPlayer.pause.mockClear()
  TrackPlayer.stop.mockClear()
  TrackPlayer.seekTo.mockClear()
  TrackPlayer.setVolume.mockClear()
  TrackPlayer.setRepeatMode.mockClear()
  TrackPlayer.skipToNext.mockClear()
  TrackPlayer.skipToPrevious.mockClear()
  TrackPlayer.addEventListener.mockClear()
}

export function __fakeQueue() {
  return queue
}

export function __emitTrackPlayer(event: string, payload: unknown) {
  emit(event, payload)
}

export default TrackPlayer
