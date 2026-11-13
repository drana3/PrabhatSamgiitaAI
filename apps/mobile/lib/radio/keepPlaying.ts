/**
 * Does the Radio keep playing when the person leaves the Radio screen? Yes (Dada's decision): it plays until they stop it
 * from the mini-player or on the Radio screen, whatever screen they go to (Top Played, Search, a song page). The earlier
 * behaviour (leaving the screen stopped it) is kept only for a drive playlist. Flip the flag to bring the old behaviour back.
 */
export const RADIO_KEEPS_PLAYING_ON_LEAVE = true

type SessionSlice = { playbackMode: string; driveAutoAdvance: boolean }

/** A running Radio: random mode with drive advance on. */
export function isRadioRunning(state: SessionSlice): boolean {
  return state.playbackMode === "random" && state.driveAutoAdvance
}

/**
 * What to do when the Radio screen loses focus (called after the short grace delay):
 * - "keep": the Radio runs on; leave everything as it is.
 * - "forget": drive advance is still on but another song replaced the Radio (mode no longer random); only clear the flag,
 *   never stop the song that is playing.
 * - "exit": the old behaviour (a drive playlist, or the flag off): end the drive session and stop.
 */
export function driveBlurDecision(state: SessionSlice): "keep" | "forget" | "exit" {
  if (!RADIO_KEEPS_PLAYING_ON_LEAVE) return "exit"
  if (isRadioRunning(state)) return "keep"
  if (state.driveAutoAdvance && state.playbackMode === "default") return "forget"
  return "exit"
}
