/**
 * Single source of truth for "is it playing": what the native player reports.
 * The store never guesses; it only ignores the pauses the app causes itself
 * while it swaps tracks (see transition.ts).
 */

export type NativeSignal =
  | "playing"
  | "buffering"
  | "paused"
  | "stopped"
  | "ended"
  | "wants-play"
  | "wants-pause"
  | "other"

export type SignalContext = {
  /** The app is swapping tracks right now and expects a transient pause. */
  inTransition: boolean
}

export type SignalPatch = {
  isPlaying?: boolean
  isBuffering?: boolean
  wantPlaying: boolean
  clearError?: boolean
  /** The transition is over: the native player is really playing. */
  endTransition?: boolean
}

/** The state names RNTP reports (State enum values). */
export function signalFromState(state: string | undefined | null): NativeSignal {
  switch (state) {
    case "playing":
      return "playing"
    case "buffering":
    case "loading":
      return "buffering"
    case "paused":
      return "paused"
    case "stopped":
    case "none":
      return "stopped"
    case "ended":
      return "ended"
    default:
      return "other"
  }
}

/**
 * What the player store should change for a native signal, or null for none.
 * `wantPlaying` is the store's mirror of the intent and always follows the
 * native player outside a transition, so the button and the sound agree.
 */
export function patchForSignal(
  signal: NativeSignal,
  ctx: SignalContext,
  current: { wantPlaying: boolean },
): SignalPatch | null {
  switch (signal) {
    case "playing":
      return { isPlaying: true, isBuffering: false, wantPlaying: true, clearError: true, endTransition: true }
    case "wants-play":
      return { isPlaying: true, wantPlaying: true }
    case "buffering":
      return { isBuffering: true, isPlaying: current.wantPlaying, wantPlaying: current.wantPlaying }
    case "paused":
    case "stopped":
    case "wants-pause":
      if (ctx.inTransition) return null
      return { isPlaying: false, isBuffering: false, wantPlaying: false }
    default:
      return null
  }
}
