import type { PlayEventOut } from "@/lib/authors/types"

/**
 * Counting listening on the phone, without touching the player. The reporter host (components/authors/PlayReporterHost.tsx)
 * watches the player's state and feeds samples to a `PlayTracker`; when a listen qualifies it becomes ONE event for the
 * server (`POST /plays`, apps/api/app/services/author_stats.py). The rules here are the server's rules, so the phone
 * never sends what would be thrown away. Pure: no React, no clock of its own, no storage.
 *
 * What counts: 30 seconds heard, or half of a track shorter than a minute (never less than 10 seconds). Seeking does not
 * count as hearing. One event per recording per day on this phone (the server also keeps one per listener per day).
 */

export const PLAY_MIN_SECONDS = 30
export const PLAY_FLOOR_SECONDS = 10
export const PLAY_SHORT_TRACK_FRACTION = 0.5
/** The server drops events older than this. */
export const MAX_EVENT_AGE_DAYS = 7
/** The server takes at most this many events in one batch. */
export const MAX_EVENTS_PER_BATCH = 50
/** The phone keeps at most this many waiting events (a long offline spell must not grow without end). */
export const MAX_QUEUED_EVENTS = 500

/** Seconds of listening that make a play. */
export function playThreshold(durationSec: number | null | undefined): number {
  if (!durationSec || durationSec <= 0) return PLAY_MIN_SECONDS
  const half = Math.ceil(durationSec * PLAY_SHORT_TRACK_FRACTION)
  return Math.max(PLAY_FLOOR_SECONDS, Math.min(PLAY_MIN_SECONDS, half))
}

export function qualifies(listenedSec: number, durationSec: number | null | undefined): boolean {
  return listenedSec >= playThreshold(durationSec)
}

/** What the reporter reads from the player on each change. `at` is the clock in ms. */
export type Sample = {
  /** the server's recording id, or null when what plays is not a recording (a Prabhat Samgiita song, nothing) */
  recordingId: string | null
  /** the catalogue number of a Prabhat Samgiita song that plays (used only when `recordingId` is null); the event then carries `song_number` */
  songNumber?: number | null
  playing: boolean
  /** seconds into the track */
  position: number
  /** track length in seconds, 0 or null when unknown */
  duration: number | null
  at: number
}

type Listen = {
  /** what is followed: the recording id, or `ps:<number>` for a catalogue song */
  subject: string
  /** set for a catalogue song: the event then carries `song_number` instead of `recording_id` */
  songNumber: number | null
  startedAt: number
  heard: number
  lastPosition: number
  lastAt: number
  wasPlaying: boolean
  duration: number | null
  sent: boolean
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Turns samples into events. Heard time is the progress of the position, capped by the clock (a jump of the
 * scrubber is a seek, not listening). A track that starts again from the top after it was counted is a new listen,
 * but the same day it is not sent twice.
 */
export class PlayTracker {
  private listen: Listen | null = null
  private readonly doneToday = new Set<string>()

  constructor(private readonly emit: (event: PlayEventOut) => void) {}

  feed(sample: Sample): void {
    const { at } = sample
    const subject = sample.recordingId ?? (sample.songNumber ? `ps:${sample.songNumber}` : null)
    if (!subject) {
      this.listen = null
      return
    }
    const current = this.listen
    if (!current || current.subject !== subject) {
      this.listen = this.begin(sample)
      return
    }
    const wallSec = Math.max(0, (at - current.lastAt) / 1000)
    const moved = sample.position - current.lastPosition
    if (moved < -2 && current.lastPosition - sample.position > 5 && sample.position < 3) {
      // played again from the top: a new listen
      this.listen = this.begin(sample)
      return
    }
    if (current.wasPlaying && moved > 0) {
      // the clock caps it: a forward jump of the scrubber adds at most the time that really passed (plus a second of slack)
      current.heard += Math.min(moved, wallSec + 1)
    }
    if (sample.duration && sample.duration > 0) current.duration = sample.duration
    current.lastPosition = sample.position
    current.lastAt = at
    current.wasPlaying = sample.playing
    this.check(current)
  }

  /** Forget the current listen (sign-out, app stop). Nothing is sent for an unfinished one. */
  reset(): void {
    this.listen = null
  }

  private begin(sample: Sample): Listen {
    return {
      subject: sample.recordingId ?? `ps:${sample.songNumber}`,
      songNumber: sample.recordingId ? null : (sample.songNumber ?? null),
      startedAt: sample.at,
      heard: 0,
      lastPosition: sample.position,
      lastAt: sample.at,
      wasPlaying: sample.playing,
      duration: sample.duration && sample.duration > 0 ? sample.duration : null,
      sent: false,
    }
  }

  private check(listen: Listen): void {
    if (listen.sent || !qualifies(Math.floor(listen.heard), listen.duration)) return
    listen.sent = true
    const key = `${listen.subject}:${isoDay(listen.startedAt)}`
    if (this.doneToday.has(key)) return
    this.doneToday.add(key)
    if (this.doneToday.size > 2000) this.doneToday.clear()
    this.emit({
      ...(listen.songNumber != null ? { song_number: listen.songNumber } : { recording_id: listen.subject }),
      played_at: new Date(listen.startedAt).toISOString(),
      listened_sec: Math.floor(listen.heard),
      duration_sec: listen.duration ? Math.round(listen.duration) : null,
    })
  }
}

// ---- the waiting line (events not yet sent: offline, or the server said try later) -----------------------------

/** Add an event; the oldest go first when the line is full. */
export function enqueue(queue: readonly PlayEventOut[], event: PlayEventOut): PlayEventOut[] {
  const next = [...queue, event]
  return next.length > MAX_QUEUED_EVENTS ? next.slice(next.length - MAX_QUEUED_EVENTS) : next
}

/** Drop events the server would refuse as stale. */
export function fresh(queue: readonly PlayEventOut[], now: number): PlayEventOut[] {
  const limit = now - MAX_EVENT_AGE_DAYS * 86_400_000 + 3_600_000
  return queue.filter((e) => Date.parse(e.played_at) >= limit)
}

/** The next batch to send and what is left. */
export function takeBatch(queue: readonly PlayEventOut[]): { batch: PlayEventOut[]; rest: PlayEventOut[] } {
  return { batch: queue.slice(0, MAX_EVENTS_PER_BATCH), rest: queue.slice(MAX_EVENTS_PER_BATCH) }
}

/** A random id for signed-out listening: made once, kept on the phone, never an advertising id. */
export function newDeviceId(random: () => number = Math.random): string {
  let id = ""
  for (let i = 0; i < 32; i += 1) id += Math.floor(random() * 16).toString(16)
  return id
}

/** The server id behind a player track, or null when the track is not a server recording. */
export function recordingIdOfTrack(
  track: { kind?: string; kiirtan?: { id: string } } | null | undefined,
  serverIdOf: (appId: string) => string | undefined,
): string | null {
  if (!track || track.kind !== "kiirtan" || !track.kiirtan) return null
  const appId = track.kiirtan.id
  if (appId.startsWith("srv-")) return appId.slice(4)
  return serverIdOf(appId) ?? null
}

/** The catalogue number behind a player track, or null when the track is a recording (or not a catalogue song). */
export function songNumberOfTrack(track: { kind?: string; number?: number } | null | undefined): number | null {
  if (!track || track.kind === "kiirtan") return null
  const n = track.number
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5018 ? n : null
}
