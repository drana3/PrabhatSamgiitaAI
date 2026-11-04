/**
 * Talking to YouTube's official IFrame player by postMessage (enablejsapi=1). The screen sends
 * "listening" once the frame has loaded, then YouTube posts its state and the playing time.
 * Only the player's own controls and state are used; no stream is read. Pure, unit tested.
 */

/** YouTube's numbers for `playerState`. */
export type EmbedState = "unstarted" | "ended" | "playing" | "paused" | "buffering" | "cued"

const STATES: Record<number, EmbedState> = { [-1]: "unstarted", 0: "ended", 1: "playing", 2: "paused", 3: "buffering", 5: "cued" }

export function embedStateFromNumber(n: unknown): EmbedState | null {
  return typeof n === "number" && n in STATES ? STATES[n] : null
}

export type EmbedEvent =
  | { type: "ready" }
  | { type: "state"; state: EmbedState }
  | { type: "time"; current: number; duration: number | null; state: EmbedState | null }
  | { type: "error"; code: number }

/** Reads one message from the frame (a JSON string or an already parsed object). Unknown shapes give null. */
export function parseEmbedMessage(data: unknown): EmbedEvent | null {
  let message: unknown = data
  if (typeof data === "string") {
    try {
      message = JSON.parse(data)
    } catch {
      return null
    }
  }
  if (!message || typeof message !== "object") return null
  const m = message as { event?: unknown; info?: unknown }
  switch (m.event) {
    case "onReady":
      return { type: "ready" }
    case "onStateChange": {
      const state = embedStateFromNumber(m.info)
      return state ? { type: "state", state } : null
    }
    case "onError":
      return typeof m.info === "number" ? { type: "error", code: m.info } : null
    case "initialDelivery":
    case "infoDelivery": {
      const info = m.info as { currentTime?: unknown; duration?: unknown; playerState?: unknown } | null
      if (!info || typeof info !== "object") return null
      const state = embedStateFromNumber(info.playerState)
      if (typeof info.currentTime === "number") {
        return {
          type: "time",
          current: Math.max(0, info.currentTime),
          duration: typeof info.duration === "number" && info.duration > 0 ? info.duration : null,
          state,
        }
      }
      return state ? { type: "state", state } : null
    }
    default:
      return null
  }
}

/** The message that makes the frame start posting its state. */
export const LISTEN_MESSAGE = JSON.stringify({ event: "listening", id: 1, channel: "widget" })

export type EmbedCommand = { func: "playVideo" | "pauseVideo" } | { func: "seekTo"; seconds: number }

/** A command for the frame. */
export function commandMessage(command: EmbedCommand): string {
  const args = command.func === "seekTo" ? [Math.max(0, command.seconds), true] : []
  return JSON.stringify({ event: "command", func: command.func, args })
}

/** Plain-words reason for an embed error code, from the IFrame player documentation. */
export function embedErrorText(code: number): string {
  if (code === 101 || code === 150) return "The owner does not allow this video to play outside YouTube."
  if (code === 100) return "This video was removed or is private."
  if (code === 2 || code === 5) return "YouTube could not play this link."
  return "YouTube could not play this video."
}
