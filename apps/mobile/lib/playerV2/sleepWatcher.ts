import { sleepVerdict, type SleepSnapshot, type SleepTimer } from "@/lib/playerV2/sleepTimer"

export type SleepWatcherDeps = {
  getTimer: () => SleepTimer
  snapshot: () => SleepSnapshot
  pause: () => void
  rewind: () => void
  cancel: () => void
}

/** Call once a second. Stops playback when the timer is due, then turns itself off. */
export function tickSleep(deps: SleepWatcherDeps): void {
  const timer = deps.getTimer()
  if (timer.kind === "off") return
  const verdict = sleepVerdict(timer, deps.snapshot())
  if (verdict === "keep-going") return
  deps.pause()
  if (verdict === "pause-and-rewind") deps.rewind()
  deps.cancel()
}
