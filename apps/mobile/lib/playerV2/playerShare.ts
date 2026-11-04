import { songShareMessage, songShareUrl } from "@/lib/webLinks"
import { mixHex } from "@/lib/playerV2/coverTint"

/**
 * Share sheet logic (no React): the four card backgrounds, the message and link a share carries,
 * and the button row. The card is drawn by components/player-v2/ShareSheet.
 */

export type ShareBackground = "forest" | "sand" | "ink" | "cover"

export const SHARE_BACKGROUNDS: ReadonlyArray<{ id: ShareBackground; label: string }> = [
  { id: "forest", label: "Forest" },
  { id: "sand", label: "Sand and orange" },
  { id: "ink", label: "Ink" },
  { id: "cover", label: "Cover colour" },
]

export type SharePalette = {
  /** gradient, top to bottom */
  from: string
  to: string
  /** title */
  text: string
  /** performer, "PS 3" */
  sub: string
  /** thin rule and wordmark */
  accent: string
}

/** Colours of one background; the `cover` one takes the tone of the song's cover. */
export function sharePalette(id: ShareBackground, tint: string): SharePalette {
  switch (id) {
    case "forest":
      return { from: "#2C3A27", to: "#20281A", text: "#FFFFFF", sub: "#DDE3CF", accent: "#F5C253" }
    case "sand":
      return { from: "#F8F6F3", to: "#FFDCC5", text: "#333333", sub: "#4F4A46", accent: "#933B06" }
    case "ink":
      return { from: "#2A2A2A", to: "#161616", text: "#FFFFFF", sub: "#D4D4D4", accent: "#F5C253" }
    case "cover":
      return { from: mixHex(tint, "#000000", 0.15), to: mixHex(tint, "#000000", 0.5), text: "#FFFFFF", sub: "#F1EBE4", accent: "#F5C253" }
  }
}

export type SharePayload = {
  /** "PS 3 · Title", used as the share subject */
  title: string
  /** The text a friend reads, with the link at the end. */
  message: string
  /** The link alone (copied by "Copy link"). */
  url: string
}

/**
 * What a share carries. The link is the app's existing public song link (lib/webLinks songShareUrl).
 * TODO(api): the web site has no short links yet; swap songShareUrl for one when it does.
 */
export function buildSharePayload(song: { number: number; title: string; performer?: string | null }): SharePayload {
  const title = song.title.trim() || `Prabhat Samgiita ${song.number}`
  return {
    title: `PS ${song.number} · ${title}`,
    message: songShareMessage(song.number, title, { performer: song.performer }),
    url: songShareUrl(song.number),
  }
}

export type ShareTargetId = "copy" | "whatsapp" | "instagram" | "messages" | "more"

export const SHARE_TARGETS: ReadonlyArray<{ id: ShareTargetId; label: string }> = [
  { id: "copy", label: "Copy link" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram Stories" },
  { id: "messages", label: "Messages" },
  { id: "more", label: "More" },
]

export type SharePlatform = "ios" | "android" | "web"

/**
 * A direct link for the channels that have one. null means "use the system share sheet" (which
 * falls back to copying the link when the platform has none). Instagram Stories needs an image
 * and the card is not rendered to a picture yet, so it uses the system sheet as well.
 */
export function shareTargetUrl(target: ShareTargetId, payload: SharePayload, platform: SharePlatform): string | null {
  if (target === "whatsapp") return `https://wa.me/?text=${encodeURIComponent(payload.message)}`
  if (target === "messages") {
    if (platform === "ios") return `sms:&body=${encodeURIComponent(payload.message)}`
    if (platform === "android") return `sms:?body=${encodeURIComponent(payload.message)}`
  }
  return null
}

export type ShareOutcome = "copied" | "copy-failed" | "opened" | "shared" | "dismissed"

/** Toast text for an outcome, or null when the other app or the system sheet already said it all. */
export function shareToast(outcome: ShareOutcome): string | null {
  if (outcome === "copied") return "Link copied"
  if (outcome === "copy-failed") return "Could not copy the link"
  return null
}
