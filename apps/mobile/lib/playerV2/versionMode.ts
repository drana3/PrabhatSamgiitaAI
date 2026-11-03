/** "Play: This version | All N versions" (spec SCR-40, option A). */
export type PlayMode = "this" | "all"

export type EndAction =
  | { kind: "repeat-version" }
  | { kind: "next-version"; index: number }
  | { kind: "next-song"; wrap: boolean }
  | { kind: "stop" }

export type EndInput = {
  mode: PlayMode
  versionIndex: number
  versionCount: number
  /** Repeat one song: repeats the current version, never moves on. */
  repeatOne: boolean
  /** Repeat the whole list. */
  repeatAll: boolean
  hasNextSong: boolean
}

/** What happens when a version finishes. */
export function afterVersionEnd(input: EndInput): EndAction {
  if (input.repeatOne) return { kind: "repeat-version" }
  if (input.mode === "all" && input.versionIndex + 1 < input.versionCount) {
    return { kind: "next-version", index: input.versionIndex + 1 }
  }
  if (input.hasNextSong) return { kind: "next-song", wrap: false }
  if (input.repeatAll) return { kind: "next-song", wrap: true }
  return { kind: "stop" }
}

/** The switch is shown whenever there is more than one version. */
export function playModeAvailable(versionCount: number): boolean {
  return versionCount > 1
}

/** Effective mode: "all" means nothing for a song with one version. */
export function effectivePlayMode(mode: PlayMode, versionCount: number): PlayMode {
  return playModeAvailable(versionCount) ? mode : "this"
}

export function playModeLabel(mode: PlayMode, versionCount: number): string {
  return mode === "all" ? `All ${versionCount} versions` : "This version"
}

/** `2/6` on the version chip while "all" is on, otherwise null. */
export function versionPositionLabel(
  mode: PlayMode,
  versionIndex: number,
  versionCount: number,
): string | null {
  if (mode !== "all" || versionCount < 2 || versionIndex < 0) return null
  return `${versionIndex + 1}/${versionCount}`
}

/**
 * While "all" is on and more versions remain, the native player must not
 * pre-load the next song, or it would skip the remaining versions.
 */
export function shouldHoldUpcoming(
  mode: PlayMode,
  versionIndex: number,
  versionCount: number,
): boolean {
  return mode === "all" && versionIndex + 1 < versionCount
}
