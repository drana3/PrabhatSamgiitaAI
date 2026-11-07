/**
 * Why a song did not play, as a code the screens turn into words (checkup P7, P13, P14).
 * The store keeps the code in `audioError`; the player shows the message and the play button retries.
 */

export type PlayerErrorCode =
  | "no-stream" // this song has no audio to stream
  | "offline" // no connection, and no saved copy
  | "failed" // the player could not play it
  | "timeout" // it did not start in time
  | "removed" // the saved copy was deleted while it played

export type PlayerErrorKey =
  | "player.error.noStream"
  | "player.error.offline"
  | "player.error.failed"
  | "player.error.timeout"
  | "player.error.removed"

/** The translation key of each reason. */
export function playerErrorKey(code: string | null | undefined): PlayerErrorKey | null {
  switch (code) {
    case "no-stream":
      return "player.error.noStream"
    case "offline":
      return "player.error.offline"
    case "failed":
      return "player.error.failed"
    case "timeout":
      return "player.error.timeout"
    case "removed":
      return "player.error.removed"
    default:
      return code ? "player.error.failed" : null
  }
}

/** A song that never starts is given up on after this long (the spinner must end). */
export const LOAD_TIMEOUT_MS = 25_000

/** In a list or in Drive, this many failures in a row stop the playlist instead of skipping on forever. */
export const MAX_ERRORS_IN_A_ROW = 3

/** What the list does after a failure: skip to the next song, or stop (the streak reached the limit). */
export function afterPlaybackError(streak: number): { next: number; stop: boolean } {
  const next = streak + 1
  return { next, stop: next >= MAX_ERRORS_IN_A_ROW }
}

/** Why a song with no stream could not be found: no connection, or it simply has no audio. */
export function noStreamReason(fetchFailed: boolean): PlayerErrorCode {
  return fetchFailed ? "offline" : "no-stream"
}
