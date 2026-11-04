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

/**
 * The one chip line under the title: `Voice · Performer A · 6 versions`. While "all" is on the count
 * gives way to the position (`2/6`, drawn in gold). `pickable` is false for a single version: nothing to choose.
 */
export function versionChipText(
  summary: string,
  versionCount: number,
  mode: PlayMode,
  versionIndex: number,
): { text: string; position: string | null; pickable: boolean } {
  const position = versionPositionLabel(mode, versionIndex, versionCount)
  const pickable = versionCount > 1
  const text = pickable && !position ? `${summary} · ${versionCount} versions` : summary
  return { text, position, pickable }
}

/** The two choices of the scope toggle at the top of the Versions sheet. */
export const PLAY_SCOPE_OPTIONS: ReadonlyArray<{ mode: PlayMode; label: string }> = [
  { mode: "this", label: "Play only this version" },
  { mode: "all", label: "Play all versions" },
]
