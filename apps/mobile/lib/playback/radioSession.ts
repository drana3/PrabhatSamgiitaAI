import type { ListeningSession } from "@/lib/playback/listeningSession"

export type RadioSessionSnapshot = {
  kind: ListeningSession["kind"]
  currentNumber: number | null
  playlistBounds: number[] | null
  driveRepeat: boolean
  repeat: boolean
}

const snapshot: RadioSessionSnapshot = {
  kind: "casual",
  currentNumber: null,
  playlistBounds: null,
  driveRepeat: false,
  repeat: false,
}

export function setRadioSession(next: RadioSessionSnapshot): void {
  snapshot.kind = next.kind
  snapshot.currentNumber = next.currentNumber
  snapshot.playlistBounds = next.playlistBounds
  snapshot.driveRepeat = next.driveRepeat
  snapshot.repeat = next.repeat
}

export function getRadioSession(): RadioSessionSnapshot {
  return { ...snapshot }
}

export function resetRadioSession(): void {
  snapshot.kind = "casual"
  snapshot.currentNumber = null
  snapshot.playlistBounds = null
  snapshot.driveRepeat = false
  snapshot.repeat = false
}
