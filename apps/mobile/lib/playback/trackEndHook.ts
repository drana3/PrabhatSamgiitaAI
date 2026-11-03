/**
 * Optional hook for the redesigned player: lets "Play all versions" and
 * "repeat the list" decide what follows a finished track. With no hook set,
 * playback behaves exactly as before.
 */
export type TrackEndHook = {
  /** True while the native player must not pre-load the next song. */
  shouldHoldUpcoming: () => boolean
  /** Return true when the hook started something and the engine should do nothing. */
  onTrackEnded: () => boolean
}

let hook: TrackEndHook | null = null

export function setTrackEndHook(next: TrackEndHook | null): void {
  hook = next
}

export function holdUpcomingTrack(): boolean {
  try {
    return hook?.shouldHoldUpcoming() ?? false
  } catch {
    return false
  }
}

export function runTrackEndHook(): boolean {
  try {
    return hook?.onTrackEnded() ?? false
  } catch {
    return false
  }
}
