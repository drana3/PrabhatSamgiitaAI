import { sleepFade, sleepVerdict, type SleepSnapshot, type SleepTimer } from "@/lib/playerV2/sleepTimer"

export type SleepWatcherDeps = {
  getTimer: () => SleepTimer
  snapshot: () => SleepSnapshot
  pause: () => void
  rewind: () => void
  cancel: () => void
  /** The volume factor of the fade-out; 1 is full. Called every tick while a timer runs. */
  setFade?: (factor: number) => void
}

/** Call once a second. Stops playback when the timer is due, then turns itself off. */
export function tickSleep(deps: SleepWatcherDeps): void {
  const timer = deps.getTimer()
  if (timer.kind === "off") return
  const snap = deps.snapshot()
  const verdict = sleepVerdict(timer, snap)
  if (verdict === "keep-going") {
    deps.setFade?.(sleepFade(timer, snap))
    return
  }
  deps.pause()
  if (verdict === "pause-and-rewind") deps.rewind()
  deps.cancel()
}
