import { t } from "@/lib/i18n"
import { songShareMessage, songShareUrl } from "@/lib/webLinks"
import { contrastRatio, mixHex } from "@/lib/playerV2/coverTint"

/**
 * Share sheet logic (no React): the card grounds, the Song/Words modes, the message and link a share
 * carries, the target row and how each target is sent. The sheet is drawn by components/player-v2/ShareSheet.
 */

// ---- card grounds (the colour dots under the carousel) ----

/**
 * One card per ground, in dot order: the song's cover colour, forest green, a warm near-black, a stock
 * photo under a dark scrim.
 */
export type ShareBackground = "cover" | "forest" | "ink" | "photo"

export const SHARE_BACKGROUNDS: ReadonlyArray<{ id: ShareBackground; label: string }> = [
  { id: "cover", get label() { return t("shareSheet.bg.cover") } },
  { id: "forest", get label() { return t("shareSheet.bg.forest") } },
  { id: "ink", get label() { return t("shareSheet.bg.ink") } },
  { id: "photo", get label() { return t("shareSheet.bg.photo") } },
]

/** Black laid over a stock photo so white text on it keeps 4.5:1 even on a pure-white pixel. */
export const PHOTO_SCRIM_ALPHA = 0.6

/** The grounds on offer: every one, minus the photo when the stock-photo list is empty. */
export function shareBackgrounds(hasPhoto: boolean): ReadonlyArray<{ id: ShareBackground; label: string }> {
  return hasPhoto ? SHARE_BACKGROUNDS : SHARE_BACKGROUNDS.filter((b) => b.id !== "photo")
}

export type SharePalette = {
  /** gradient, top to bottom (for the photo: the worst-case colour under the scrim) */
  from: string
  to: string
  /** title, lyrics */
  text: string
  /** performer, "PS 3" */
  sub: string
  /** wordmark */
  accent: string
}

const SUB = "#F1EBE4"
const GOLD = "#F5C253"

/**
 * A tone darkened, if needed, until the card's white text, sub text and gold wordmark pass 4.5:1 on its lighter
 * gradient stop. The song cover tones already pass and come back unchanged; a Kiirtan's brighter tone does not.
 */
export function legibleTint(tint: string): string {
  let t = tint
  for (let i = 0; i < 12; i++) {
    const top = mixHex(t, "#000000", 0.15)
    if (contrastRatio(SUB, top) >= 4.5 && contrastRatio(GOLD, top) >= 4.5) return t
    t = mixHex(t, "#000000", 0.1)
  }
  return t
}

/** Colours of one ground; `cover` takes the tone of the song's cover. */
export function sharePalette(id: ShareBackground, tint: string): SharePalette {
  switch (id) {
    case "forest":
      // amColors.sage800 to sage900
      return { from: "#2C3A27", to: "#20281A", text: "#FFFFFF", sub: "#DDE3CF", accent: "#F5C253" }
    case "ink":
      return { from: "#2B2622", to: "#161210", text: "#FFFFFF", sub: "#D8D2CC", accent: "#F5C253" }
    case "photo": {
      const worst = mixHex("#FFFFFF", "#000000", PHOTO_SCRIM_ALPHA)
      return { from: worst, to: worst, text: "#FFFFFF", sub: SUB, accent: "#FFFFFF" }
    }
    case "cover":
      return { from: mixHex(legibleTint(tint), "#000000", 0.15), to: mixHex(legibleTint(tint), "#000000", 0.5), text: "#FFFFFF", sub: SUB, accent: GOLD }
  }
}

// ---- Song / Words ----

export type ShareMode = "song" | "words"

export const SHARE_MODES: ReadonlyArray<{ id: ShareMode; label: string }> = [
  { id: "song", get label() { return t("shareSheet.mode.song") } },
  { id: "words", get label() { return t("shareSheet.mode.words") } },
]

/** Kiirtan items have no lyrics, so they only offer "Song". So does a song whose lyrics are missing. */
export function shareModes(opts: { kiirtan: boolean; lyricLines: number }): ReadonlyArray<{ id: ShareMode; label: string }> {
  return opts.kiirtan || opts.lyricLines <= 0 ? SHARE_MODES.filter((m) => m.id === "song") : SHARE_MODES
}

const WORDS_MAX_LINES = 4
const WORDS_MAX_CHARS = 150

/** The lines on the Words card: the first three or four, as many as fit in about 150 characters (at least two). */
export function pickWordsLines(lines: readonly string[], max = WORDS_MAX_LINES): string[] {
  const clean = lines.map((l) => l.trim()).filter(Boolean)
  const out: string[] = []
  let chars = 0
  for (const line of clean) {
    if (out.length >= max) break
    if (out.length >= 2 && chars + line.length > WORDS_MAX_CHARS) break
    out.push(line)
    chars += line.length
  }
  return out
}

// ---- what a share carries ----

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

/**
 * The "Words" card travels as text while the card cannot be sent as a picture: the chosen lyric lines
 * go in front of the usual message, so a friend reads exactly what the card shows.
 */
export function withWordsPayload(payload: SharePayload, lines: readonly string[]): SharePayload {
  if (lines.length === 0) return payload
  return { ...payload, message: `${lines.join("\n")}\n\n${payload.message}` }
}

// ---- targets ----

export type ShareTargetId = "copy" | "whatsapp" | "telegram" | "instagramStories" | "instagram" | "facebook" | "more"

/**
 * The target row, in order. No LinkedIn, Snapchat, X, TikTok, Threads or SMS.
 * `needsImage` marks the ones that are really about a card picture (Instagram Stories); a sheet
 * that has no picture to send (the Kiirtan share sheet) leaves them out.
 */
export const SHARE_TARGETS: ReadonlyArray<{ id: ShareTargetId; label: string; needsImage?: boolean }> = [
  { id: "copy", get label() { return t("shareSheet.target.copy") } },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "telegram", label: "Telegram" },
  { id: "instagramStories", label: "Instagram Stories", needsImage: true },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "more", get label() { return t("shareSheet.target.more") } },
]

export type SharePlatform = "ios" | "android" | "web"

/**
 * A direct https link for the channels that have one. On iOS and Android these open the app when it is
 * installed (universal link / app link) and the website otherwise; on the web they open the website.
 * null means "use the system share sheet" (which falls back to copying the link when the platform has none).
 */
export function shareTargetUrl(target: ShareTargetId, payload: SharePayload, _platform: SharePlatform): string | null {
  if (target === "whatsapp") return whatsappShareUrl(payload)
  if (target === "telegram") return telegramShareUrl(payload)
  if (target === "facebook") return facebookShareUrl(payload)
  return null
}

export function whatsappShareUrl(payload: SharePayload): string {
  return `https://wa.me/?text=${encodeURIComponent(payload.message)}`
}

/**
 * Telegram personal share (not a channel post). The link goes in `url`, the rest of the message in
 * `text`; the message already ends with the link, so it is cut off the text to avoid showing it twice.
 * The https link opens the Telegram app as a universal link on iOS and Android, and Telegram Web on the web.
 */
export function telegramShareUrl(payload: SharePayload): string {
  const text = payload.message.endsWith(payload.url) ? payload.message.slice(0, -payload.url.length).trimEnd() : payload.message
  return `https://t.me/share/url?url=${encodeURIComponent(payload.url)}&text=${encodeURIComponent(text)}`
}

/** Facebook's share dialog takes the link only (Facebook ignores any prefilled text). */
export function facebookShareUrl(payload: SharePayload): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(payload.url)}`
}

/**
 * How a target is really sent today:
 * - clipboard: copies the link.
 * - link: opens the app's own share link (see shareTargetUrl).
 * - system-sheet: the platform share sheet (navigator.share on the web, the link is copied when there is none).
 *   Instagram has no public way to prefill a message or a story from plain JavaScript, so both Instagram
 *   targets go through the system sheet, where Instagram is listed when installed.
 */
export type ShareRoute = "clipboard" | "link" | "system-sheet"

export function shareRoute(target: ShareTargetId): ShareRoute {
  if (target === "copy") return "clipboard"
  if (target === "whatsapp" || target === "telegram" || target === "facebook") return "link"
  return "system-sheet"
}

export type ShareOutcome = "copied" | "copy-failed" | "opened" | "shared" | "dismissed"

/** Toast text for an outcome, or null when the other app or the system sheet already said it all. */
export function shareToast(outcome: ShareOutcome): string | null {
  if (outcome === "copied") return t("shareSheet.copied")
  if (outcome === "copy-failed") return t("shareSheet.copyFailed")
  return null
}
