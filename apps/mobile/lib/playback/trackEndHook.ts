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
  /**
   * The song to line up natively behind the current one in a plain list, or null. With it queued, the
   * list keeps going on a locked phone without the app having to wake up and fetch the next song.
   */
  upcomingSong?: () => number | null
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

export function upcomingNativeSong(): number | null {
  try {
    return hook?.upcomingSong?.() ?? null
  } catch {
    return null
  }
}
