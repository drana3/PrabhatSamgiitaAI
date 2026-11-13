import { t } from "@/lib/i18n"
/** Sleep timer: 5, 10, 15, 30, 45, 60 minutes, the end of this track, or the end of the playlist. */
export const SLEEP_PRESET_MINUTES = [5, 10, 15, 30, 45, 60] as const

export type SleepTimer =
  | { kind: "off" }
  | { kind: "minutes"; minutes: number; endsAt: number }
  | { kind: "endOfSong"; songNumber: number }
  /** Stops after the last track of the list that plays now (`lastNumber`); earlier tracks play on. */
  | { kind: "endOfList"; lastNumber: number }

export const SLEEP_OFF: SleepTimer = { kind: "off" }

export function startSleepMinutes(minutes: number, now: number): SleepTimer {
  return { kind: "minutes", minutes, endsAt: now + minutes * 60_000 }
}

export function startSleepEndOfSong(songNumber: number): SleepTimer {
  return { kind: "endOfSong", songNumber }
}

export function startSleepEndOfList(lastNumber: number): SleepTimer {
  return { kind: "endOfList", lastNumber }
}

/** The track whose end this timer waits for, or null (a minutes timer, no timer, a list not yet at its last track). */
export function sleepWaitsForTrack(timer: SleepTimer, songNumber: number | null): boolean {
  if (songNumber == null) return false
  if (timer.kind === "endOfSong") return timer.songNumber === songNumber
  if (timer.kind === "endOfList") return timer.lastNumber === songNumber
  return false
}

export function sleepRemainingMs(timer: SleepTimer, now: number): number | null {
  return timer.kind === "minutes" ? Math.max(0, timer.endsAt - now) : null
}

export type SleepSnapshot = {
  now: number
  songNumber: number | null
  position: number
  duration: number
}

export type SleepVerdict = "keep-going" | "pause" | "pause-and-rewind"

/** The sound fades out over this long before a minutes timer fires, and before the end of the song. */
export const SLEEP_FADE_SECONDS = 15
export const SLEEP_FADE_SONG_SECONDS = 10
/** Safety net only: the end of the song itself is caught by the player's track-end event, not by the clock. */
const END_MARGIN_SECONDS = 0.25

/**
 * Should playback stop now? "End of song" pauses in the last second, or
 * (if the engine already moved on) pauses the next song and rewinds it.
 */
export function sleepVerdict(timer: SleepTimer, snap: SleepSnapshot): SleepVerdict {
  if (timer.kind === "minutes") return snap.now >= timer.endsAt ? "pause" : "keep-going"
  if (timer.kind === "endOfSong") {
    if (snap.songNumber != null && snap.songNumber !== timer.songNumber) return "pause-and-rewind"
    const remaining = snap.duration - snap.position
    if (snap.duration > 1 && snap.position > 0 && remaining <= END_MARGIN_SECONDS) return "pause"
  }
  if (timer.kind === "endOfList" && snap.songNumber === timer.lastNumber) {
    const remaining = snap.duration - snap.position
    if (snap.duration > 1 && snap.position > 0 && remaining <= END_MARGIN_SECONDS) return "pause"
  }
  return "keep-going"
}

/**
 * Volume factor 0..1 for the fade before the timer fires: 1 far from the end, falling to 0 at the end.
 * A timer that is off, or a song of unknown length, never fades.
 */
export function sleepFade(timer: SleepTimer, snap: SleepSnapshot): number {
  let remainingSeconds: number | null = null
  let window = SLEEP_FADE_SECONDS
  if (timer.kind === "minutes") {
    remainingSeconds = (timer.endsAt - snap.now) / 1000
  } else if (timer.kind === "endOfSong" || timer.kind === "endOfList") {
    if (!sleepWaitsForTrack(timer, snap.songNumber) || !(snap.duration > 1) || !(snap.position > 0)) return 1
    remainingSeconds = snap.duration - snap.position
    window = SLEEP_FADE_SONG_SECONDS
  }
  if (remainingSeconds == null || remainingSeconds >= window) return 1
  return Math.min(1, Math.max(0, remainingSeconds / window))
}

export function formatSleepRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function sleepLabel(timer: SleepTimer, now: number): string {
  if (timer.kind === "off") return t("common.off")
  if (timer.kind === "endOfSong") return t("player.sleep.endOfSong")
  if (timer.kind === "endOfList") return t("player.sleep.endOfList")
  return formatSleepRemaining(sleepRemainingMs(timer, now) ?? 0)
}

/** The More sheet row steps Off, 15 min, 30 min, End of song, then Off again (prototype: Off, 15, 30). */
export function nextSleepStep(timer: SleepTimer, songNumber: number, now: number): SleepTimer {
  if (timer.kind === "off") return startSleepMinutes(15, now)
  if (timer.kind === "minutes") return timer.minutes < 30 ? startSleepMinutes(30, now) : startSleepEndOfSong(songNumber)
  return SLEEP_OFF
}

/** Toast text after a step of {@link nextSleepStep}. */
export function sleepToast(timer: SleepTimer): string {
  if (timer.kind === "off") return t("player.sleep.toastOff")
  if (timer.kind === "endOfSong") return t("player.sleep.toastEnd")
  if (timer.kind === "endOfList") return t("player.sleep.toastEndList")
  return t("player.sleep.toastMin", { minutes: timer.minutes })
}
