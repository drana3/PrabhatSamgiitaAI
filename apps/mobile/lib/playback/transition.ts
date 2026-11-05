/**
 * A window in which the native player is expected to report Paused / Stopped
 * on its own because the app itself is swapping tracks (reset + add + play,
 * or a skip). Native "paused" events inside the window are noise; outside it
 * they are real (lock screen, headphones, a call) and the UI must follow.
 */
const DEFAULT_WINDOW_MS = 4000

let until = 0

export function markTransition(ms: number = DEFAULT_WINDOW_MS, now: number = Date.now()): void {
  until = now + ms
}

export function clearTransition(): void {
  until = 0
}

export function inTransition(now: number = Date.now()): boolean {
  return now < until
}
