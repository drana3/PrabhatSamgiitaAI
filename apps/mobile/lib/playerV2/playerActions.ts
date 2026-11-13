import { nextRepeatMode, type RepeatMode } from "@/lib/playerV2/controller"
import { t } from "@/lib/i18n"

/**
 * The Player's "More" actions sheet, the queue footer and the "About this song" card as plain data
 * (no React), so what each one lists is unit tested. The components in components/player-v2 draw them.
 */

export type ActionId =
  | "share"
  | "save"
  | "playlist"
  | "queue"
  | "goQueue"
  | "songPage"
  | "collection"
  | "source"
  | "playback"
  | "drive"
  | "report"
  /** only on a recording (lib/recordingExtras/playerRows.ts), never in `buildActionRows` */
  | "recordingChords"
  | "recordingPage"

export type ActionIcon =
  | "share"
  | "save"
  | "playlistAdd"
  | "queueAdd"
  | "queue"
  | "music"
  | "library"
  | "timer"
  | "drive"
  | "layers"
  | "flag"

export type ActionRow = {
  id: ActionId
  label: string
  /** Small grey line under the label. */
  meta?: string
  icon: ActionIcon
  /** Drawn in the brand orange (Saved). */
  active?: boolean
}

export type ActionInput = {
  saved: boolean
  /** The song is already in the list that plays. */
  inQueue: boolean
  /** Name of the collection the song belongs to, or null (the row then opens the list of all collections). */
  collectionName: string | null
  /** "All songs", "Mine", a playlist name */
  sourceName: string
  /** "1×" */
  speedText: string
  /** "Off", "15:00", "End of song" */
  sleepText: string
}

/** The rows of the More sheet, in the order they are drawn. */
export function buildActionRows(input: ActionInput): ActionRow[] {
  return [
    { id: "share", label: t("songs.menu.share"), icon: "share" },
    {
      id: "save",
      label: input.saved ? t("songs.menu.saved") : t("songs.menu.saveTo"),
      meta: input.saved ? t("player.act.savedMeta") : undefined,
      icon: "save",
      active: input.saved,
    },
    { id: "playlist", label: t("songs.menu.addTo"), icon: "playlistAdd" },
    {
      id: "queue",
      label: t("songs.menu.addQueue"),
      meta: input.inQueue ? t("player.act.inQueue") : undefined,
      icon: "queueAdd",
    },
    { id: "goQueue", label: t("player.act.goQueue"), icon: "queue" },
    { id: "source", label: t("player.act.source"), meta: input.sourceName, icon: "layers" },
    { id: "songPage", label: t("songs.menu.openSong"), meta: t("player.act.songPageMeta"), icon: "music" },
    {
      id: "collection",
      label: t("player.act.collection"),
      meta: input.collectionName ?? t("player.act.allCollections"),
      icon: "library",
    },
    {
      id: "playback",
      label: t("player.act.playback"),
      meta: t("player.act.playbackMeta", { speed: input.speedText, sleep: input.sleepText }),
      icon: "timer",
    },
    { id: "drive", label: t("player.act.drive"), meta: t("player.act.driveMeta"), icon: "drive" },
    { id: "report", label: t("player.act.report"), icon: "flag" },
  ]
}

/** Toast after "Report a mistake". TODO(api): send the report to the catalog team; nothing leaves the phone yet. */
export const REPORT_THANKS = "Thanks, we will check it"

/** The same toast in the screen language. */
export function reportThanks(): string {
  return t("player.toast.reportThanks")
}

/** Toast after "Add to queue". */
export function queueAddMessage(alreadyThere: boolean): string {
  return alreadyThere ? t("player.toast.queueAlready") : t("player.toast.queueAdded")
}

/** The collection a song belongs to; with several, the smallest (the most specific). */
export function collectionForSong<T extends { label: string; count: number; songNumbers: readonly number[] }>(
  number: number,
  collections: readonly T[],
): T | null {
  let best: T | null = null
  for (const c of collections) {
    if (!c.songNumbers.includes(number)) continue
    if (!best || c.count < best.count) best = c
  }
  return best
}

/* ---------- queue footer ---------- */

export type FooterButton = {
  id: "shuffle" | "repeat" | "timer"
  label: string
  active: boolean
}

/** "Repeat", and "Repeat One" when one song repeats. */
export function repeatLabel(mode: RepeatMode): string {
  return mode === "one" ? t("player.repeat.one") : t("player.repeat")
}

/** Toast and screen-reader text for a repeat mode. */
export function repeatMessage(mode: RepeatMode, source: string): string {
  return mode === "off" ? t("player.repeat.off") : mode === "all" ? t("player.repeat.all", { source }) : t("player.repeat.thisSong")
}

/** Off, all, one, off (the same cycle as the transport button). */
export function cycleRepeat(mode: RepeatMode): RepeatMode {
  return nextRepeatMode(mode)
}

/** The three buttons under the queue: Shuffle, Repeat, Timer. Orange when on. */
export function buildQueueFooter(input: { shuffleOn: boolean; repeat: RepeatMode; timerOn: boolean }): FooterButton[] {
  return [
    { id: "shuffle", label: t("player.shuffle"), active: input.shuffleOn },
    { id: "repeat", label: repeatLabel(input.repeat), active: input.repeat !== "off" },
    { id: "timer", label: t("player.timer"), active: input.timerOn },
  ]
}

/** The line under the playing song while shuffle is on, or null. */
export function shufflingFromLine(shuffleOn: boolean, source: string): string | null {
  return shuffleOn ? t("player.shufflingFrom", { source }) : null
}

/* ---------- About this song ---------- */

export type AboutContent = {
  /** First lines, for the peek card. */
  preview: string
  /** Everything, one block per entry, for the sheet. */
  sections: Array<{ heading: string; text: string }>
}

type AboutSource = {
  centralIdea?: string | null
  meaning?: string | null
  shortDescription?: string | null
}

const PREVIEW_CHARS = 120

function clean(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim()
}

/** First characters of a text, cut at a word, with an ellipsis when something was left out. */
export function previewOf(text: string, limit = PREVIEW_CHARS): string {
  const t = clean(text)
  if (t.length <= limit) return t
  const cut = t.slice(0, limit)
  const space = cut.lastIndexOf(" ")
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`
}

/**
 * What "About this song" shows: the central idea (the song's story), then the English meaning.
 * Returns null when the song has neither, and the card is then not drawn.
 */
export function aboutContent(song: AboutSource, fallbackCentral?: string | null): AboutContent | null {
  const central = clean(song.centralIdea) || clean(fallbackCentral)
  const meaning = clean(song.meaning) || clean(song.shortDescription)
  const sections: AboutContent["sections"] = []
  if (central) sections.push({ heading: t("player.about.central"), text: central })
  if (meaning && meaning !== central) sections.push({ heading: t("player.about.meaning"), text: meaning })
  if (!sections.length) return null
  return { preview: previewOf(sections[0]!.text), sections }
}
