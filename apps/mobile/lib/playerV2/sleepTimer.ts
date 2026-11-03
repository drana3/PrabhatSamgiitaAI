/** Sleep timer (PLR-09): 5, 15, 30, 60 minutes, or the end of the song. */
export const SLEEP_PRESET_MINUTES = [5, 15, 30, 60] as const

export type SleepTimer =
  | { kind: "off" }
  | { kind: "minutes"; minutes: number; endsAt: number }
  | { kind: "endOfSong"; songNumber: number }

export const SLEEP_OFF: SleepTimer = { kind: "off" }

export function startSleepMinutes(minutes: number, now: number): SleepTimer {
  return { kind: "minutes", minutes, endsAt: now + minutes * 60_000 }
}

export function startSleepEndOfSong(songNumber: number): SleepTimer {
  return { kind: "endOfSong", songNumber }
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

/**
 * Should playback stop now? "End of song" pauses in the last second, or
 * (if the engine already moved on) pauses the next song and rewinds it.
 */
export function sleepVerdict(timer: SleepTimer, snap: SleepSnapshot): SleepVerdict {
  if (timer.kind === "minutes") return snap.now >= timer.endsAt ? "pause" : "keep-going"
  if (timer.kind === "endOfSong") {
    if (snap.songNumber != null && snap.songNumber !== timer.songNumber) return "pause-and-rewind"
    const remaining = snap.duration - snap.position
    if (snap.duration > 1 && snap.position > 0 && remaining <= 1) return "pause"
  }
  return "keep-going"
}

export function formatSleepRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function sleepLabel(timer: SleepTimer, now: number): string {
  if (timer.kind === "off") return "Off"
  if (timer.kind === "endOfSong") return "End of song"
  return formatSleepRemaining(sleepRemainingMs(timer, now) ?? 0)
}
