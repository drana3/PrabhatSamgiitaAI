import type { PlaybackMode } from "@/lib/playbackQueue"

type DriveFocusState = {
  driveAutoAdvance: boolean
  playbackMode: PlaybackMode
  playlistBounds: number[] | null
}

/** Whether opening Drive should auto-start random play (default Drive entry). */
export function shouldAutoStartRandomOnDriveFocus(state: DriveFocusState): boolean {
  if (state.driveAutoAdvance && state.playbackMode === "playlist") return false
  if (state.driveAutoAdvance && state.playbackMode === "random") return false
  if (
    state.playbackMode === "playlist" &&
    state.playlistBounds?.length &&
    !state.driveAutoAdvance
  ) {
    return false
  }
  return true
}
