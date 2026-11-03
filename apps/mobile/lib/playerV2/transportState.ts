/** What the play button shows, and the numbers beside the seek bar. */
export type PlayButtonState = "play" | "pause" | "spinner" | "error"

export function playButtonState(input: {
  isPlaying: boolean
  isBuffering: boolean
  audioError: string | null
}): PlayButtonState {
  if (input.audioError) return "error"
  // Spec: spinner in loading and buffering, never a pause icon.
  if (input.isBuffering) return "spinner"
  return input.isPlaying ? "pause" : "play"
}

/**
 * Duration only when known from the file or API. The store seeds `duration`
 * with the catalog placeholder while the file loads; hide it until then.
 */
export function knownDuration(input: {
  duration: number
  position: number
  isBuffering: boolean
  placeholder: number | null | undefined
}): number | null {
  if (!(input.duration > 1)) return null
  if (input.isBuffering && input.position === 0 && input.placeholder === input.duration) return null
  return input.duration
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const ss = String(sec).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`
}

export function formatRemaining(position: number, duration: number): string {
  return `-${formatClock(Math.max(0, duration - position))}`
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
