import type { EmbedEvent } from "@/lib/kirtan/iframeApi"

/** What the screen can ask of the embedded YouTube player. */
export type EmbedHandle = {
  play: () => void
  pause: () => void
  seekTo: (seconds: number) => void
}

export type EmbedProps = {
  videoId: string
  startSeconds?: number | null
  autoplay?: boolean
  /** a state or time message from YouTube's player */
  onEvent?: (event: EmbedEvent) => void
}
