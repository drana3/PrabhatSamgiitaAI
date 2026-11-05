/**
 * The one DOWNLOAD control of the app (save the audio on the phone so it plays without internet):
 * its three states, its words and its rules. Pure: no React, no stores, no file system. The same
 * model feeds the song page, the full player (songs and Kiirtans), the row menus, the Versions
 * sheet and the list toggles, so they can not drift apart.
 *
 *   idle         arrow-down
 *   downloading  progress ring with the percent inside; a tap cancels
 *   done         green disc with an arrow-down-to-tray (not a check: a check is Save); a tap removes, after a confirm that shows the size
 *
 * A song or Kiirtan WITHOUT playable audio shows no control at all (not disabled, not hidden under
 * a menu with an error).
 */

import { formatBytes } from "@/lib/storageCache"

export type DownloadStatus = "idle" | "downloading" | "done"

/** What a control needs to know about the thing it downloads. */
export type DownloadItem = {
  kind: "song" | "kiirtan"
  /** catalog number of a song, or the synthetic queue number of a Kiirtan (lib/kirtan/track.ts) */
  number: number
  /** remote audio URL of the chosen recording; empty means "the default recording of the song" */
  url?: string | null
  /** which version (preview downloads are kept per version, like the design) */
  versionIndex?: number
  /** words for the confirm sheet and the toasts */
  title?: string
  /** length of the recording; the preview estimates the size from it */
  seconds?: number
}

export type DownloadView = {
  /** false: draw nothing (no playable audio, and nothing on the phone to remove) */
  visible: boolean
  status: DownloadStatus
  /** 0 to 1 while downloading */
  progress: number
  /** 0 to 100, whole numbers */
  percent: number
}

export function clampRatio(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function downloadView(input: {
  hasAudio: boolean
  downloaded: boolean
  downloading: boolean
  progress?: number | null
}): DownloadView {
  const status: DownloadStatus = input.downloaded ? "done" : input.downloading ? "downloading" : "idle"
  const progress = status === "downloading" ? clampRatio(input.progress) : status === "done" ? 1 : 0
  return {
    // a copy that is already on the phone can always be removed, even if the song lost its audio link
    visible: input.hasAudio || input.downloaded,
    status,
    progress,
    percent: Math.round(progress * 100),
  }
}

/* ------------------------------------------------------------------ words */

/** Screen-reader label of the icon control. */
export function downloadLabel(view: Pick<DownloadView, "status" | "percent">): string {
  if (view.status === "downloading") return `Downloading ${view.percent} percent, tap to cancel`
  if (view.status === "done") return "Downloaded to this phone, tap to remove"
  return "Download to this phone"
}

/** The row of a menu: Download, Cancel download, Remove download. */
export function downloadMenuLabel(status: DownloadStatus): string {
  return status === "done" ? "Remove download" : status === "downloading" ? "Cancel download" : "Download"
}

/** The wide pill of the Versions sheet. `sizeText` is the estimate on the idle pill. */
export function downloadPillLabel(
  view: Pick<DownloadView, "status" | "percent">,
  options: { signedIn: boolean; sizeText?: string },
): string {
  if (!options.signedIn) return "Sign in to download"
  if (view.status === "done") return "Downloaded · tap to remove"
  if (view.status === "downloading") return `Downloading ${view.percent}% · tap to cancel`
  return options.sizeText ? `Download · ${options.sizeText}` : "Download"
}

export const DOWNLOAD_ERROR_TOAST = "Could not download. Try again."
export const DOWNLOAD_RETRY_LABEL = "Retry"
export const DOWNLOAD_REMOVED_TOAST = "Removed from this phone"
export const SIGN_IN_TITLE = "Sign in to download"
export const SIGN_IN_BODY = "Downloads follow your account. Sign in to keep songs on this phone and play them without internet."

export type ConfirmCopy = {
  /** the small caps line of the sheet */
  heading: string
  /** the name of what is removed */
  name: string
  body: string
  confirm: string
  keep: string
}

function freeing(sizeText: string | null): string {
  return sizeText ? `Frees ${sizeText} on this phone. You can download it again any time.` : "Removes the audio from this phone. You can download it again any time."
}

/** The confirm sheet of one song or Kiirtan; `bytes` is the real (or estimated) size, null when unknown. */
export function removeConfirmCopy(input: { title: string; bytes: number | null }): ConfirmCopy {
  const sizeText = input.bytes != null && input.bytes > 0 ? formatBytes(input.bytes) : null
  return {
    heading: "Remove download",
    name: input.title,
    body: freeing(sizeText),
    confirm: "Remove",
    keep: "Keep",
  }
}

/** The confirm sheet of a whole list. */
export function listRemoveConfirmCopy(input: { name: string; count: number; bytes: number | null }): ConfirmCopy {
  const sizeText = input.bytes != null && input.bytes > 0 ? formatBytes(input.bytes) : null
  const songs = `${input.count} ${input.count === 1 ? "song" : "songs"}`
  return {
    heading: "Remove downloads",
    name: input.name,
    body: sizeText
      ? `Removes ${songs} from this phone and frees ${sizeText}. You can download them again any time.`
      : `Removes ${songs} from this phone. You can download them again any time.`,
    confirm: "Remove",
    keep: "Keep",
  }
}

/* ------------------------------------------------------------- list level */

export type ListDownloadView = {
  /** false: the list has no song with playable audio and nothing on the phone, so no toggle */
  visible: boolean
  status: DownloadStatus
  /** songs of the list with playable audio */
  total: number
  /** of those, on the phone */
  done: number
  /** of those, running or waiting */
  active: number
  /** songs still to fetch (playable, not on the phone, not running) */
  pending: number
  /** 0 to 1 over the whole list (a running song counts with its own progress) */
  progress: number
  percent: number
}

/**
 * The state of a list (a playlist, Mine, a collection). Songs without playable audio are not part
 * of it: they are never counted and never block "Downloaded". `running` maps a running song to its
 * own 0..1 progress (waiting songs count as 0).
 */
export function listDownloadView(
  numbers: readonly number[],
  downloaded: ReadonlySet<number>,
  running: ReadonlyMap<number, number>,
  hasAudio: (n: number) => boolean,
): ListDownloadView {
  const unique = Array.from(new Set(numbers))
  const playable = unique.filter((n) => hasAudio(n) || downloaded.has(n))
  const done = playable.filter((n) => downloaded.has(n)).length
  const active = playable.filter((n) => !downloaded.has(n) && running.has(n)).length
  const pending = playable.filter((n) => hasAudio(n) && !downloaded.has(n) && !running.has(n)).length
  const status: DownloadStatus = active > 0 ? "downloading" : playable.length > 0 && done === playable.length ? "done" : "idle"
  const partial = playable.reduce((sum, n) => (downloaded.has(n) ? sum + 1 : running.has(n) ? sum + clampRatio(running.get(n)) : sum), 0)
  const progress = playable.length ? partial / playable.length : 0
  return {
    visible: playable.length > 0,
    status,
    total: playable.length,
    done,
    active,
    pending,
    progress,
    percent: Math.round(progress * 100),
  }
}

/** The big line of the list toggle. */
export function listDownloadTitle(view: Pick<ListDownloadView, "status" | "done" | "total">): string {
  if (view.status === "downloading") return `Downloading ${view.done} of ${view.total}`
  if (view.status === "done") return "Downloaded"
  return "Download"
}

/** The small line under it. */
export function listDownloadSub(view: Pick<ListDownloadView, "status" | "done" | "total" | "pending">, bytesText?: string): string {
  const songs = `${view.total} ${view.total === 1 ? "song" : "songs"}`
  if (view.status === "downloading") return "Tap to stop"
  if (view.status === "done") return bytesText ? `${songs} on this phone · ${bytesText}` : `${songs} on this phone`
  if (view.done > 0) return `${view.done} of ${view.total} on this phone`
  return `Plays without internet · ${songs}`
}

/** Screen-reader label of the list control (the icon or the whole toggle row). */
export function listDownloadLabel(view: Pick<ListDownloadView, "status" | "done" | "total">): string {
  if (view.status === "downloading") return `Downloading ${view.done} of ${view.total}, tap to stop`
  if (view.status === "done") return `Downloaded, ${view.total} ${view.total === 1 ? "song" : "songs"}, tap to remove`
  return `Download ${view.total} ${view.total === 1 ? "song" : "songs"}`
}

/** Toast after a list is stopped half way. */
export function listStoppedToast(done: number, total: number): string {
  return done > 0 ? `Stopped. ${done} of ${total} stay on this phone` : "Download stopped"
}

/* ----------------------------------------------------------------- preview */

/**
 * The preview keeps downloads per version ("3-1"). A control with a version looks at that one key;
 * a control without one (a row, a list) looks at every version of the number.
 */
export function demoDownloadState(
  number: number,
  versionIndex: number | undefined,
  done: Readonly<Record<string, true>>,
  progress: Readonly<Record<string, number>>,
): { downloaded: boolean; downloading: boolean; progress: number | undefined } {
  const keys = (record: Readonly<Record<string, unknown>>) =>
    Object.keys(record).filter((key) => (versionIndex == null ? Number(key.split("-")[0]) === number : key === `${number}-${versionIndex}`))
  const doneKeys = keys(done)
  const runKeys = keys(progress)
  const first = runKeys.length ? progress[runKeys[0]] : undefined
  return { downloaded: doneKeys.length > 0, downloading: runKeys.length > 0, progress: first }
}

/** The preview's size estimate: 0.0156 MB per second. */
export function demoDownloadBytes(seconds: number): number {
  return Math.round(Math.max(0, seconds) * 0.0156 * 1024 * 1024)
}

/* ---------------------------------------------------------------- batching */

/** How many files a list downloads at the same time; the rest wait their turn. */
export const LIST_DOWNLOAD_PARALLEL = 3

/** Items to start now, given how many already run. */
export function nextToStart<T>(waiting: readonly T[], running: number, limit = LIST_DOWNLOAD_PARALLEL): T[] {
  return waiting.slice(0, Math.max(0, limit - running))
}
