import { create } from "zustand"

import { kiirtanSongForNumber, isKiirtanNumber } from "@/lib/kirtan/track"
import {
  ensureOfflineAudioReady,
  offlineRecordingState,
  useOfflineAudioStore,
  type OfflineAudioEntry,
} from "@/lib/offlineAudio"
import { classifyDownloadError, type DownloadFailure } from "@/lib/offline/downloadVerify"
import { demoDownloadBytes, downloadErrorToast, downloadFailureToast, downloadRemovedToast, downloadRetryLabel, listRemoveConfirmCopy, listStoppedToast, nextToStart, removeConfirmCopy, type DownloadItem, type DownloadStatus } from "@/lib/offline/downloadModel"
import { demoDownloadFails, demoSignedOut } from "@/lib/offline/demoSwitches"
import { t } from "@/lib/i18n"
import { MOCKUP_DATA } from "@/lib/mockupMode"
import { hasPlayableAudio } from "@/lib/playableAudio"
import { demoDownloadKey, useDemoDownloads } from "@/lib/playerV2/demoDownloads"
import { scanOfflineStorage } from "@/lib/storageScan"
import { useAuthStore } from "@/stores/authStore"
import { useDownloadUiStore } from "@/stores/downloadUiStore"
import { usePlayerStore } from "@/stores/playerStore"

/**
 * What a tap on any download control does, in ONE place: the song page, the full player (songs and
 * Kiirtans), the row menus, the Versions pill and the list toggles all call these functions.
 * Everything goes through the existing offline audio service (lib/offlineAudio.ts); the preview
 * (EXPO_PUBLIC_MOCKUP_DATA=1) goes through the demo downloads so the flow can be clicked.
 *
 *   signed out   -> the sign-in prompt, never a silent failure
 *   failure      -> one quiet toast "Could not download. Try again." with Try again
 *   cancel       -> a tap on the ring
 *   remove       -> a confirm sheet that shows the size
 */

export function isSignedIn(): boolean {
  if (MOCKUP_DATA) return !demoSignedOut()
  return useAuthStore.getState().mode === "signed_in"
}

/** Shows the sign-in prompt when the listener is signed out. True when the download may go on. */
export function requireSignIn(): boolean {
  if (isSignedIn()) return true
  useDownloadUiStore.getState().openPrompt({ kind: "signin" })
  return false
}

/** The remote audio link a download starts from; empty means "ask the catalog for the default recording". */
export function itemAudioUrl(item: DownloadItem): string {
  const given = item.url?.trim()
  if (given) return given
  if (item.kind === "kiirtan" || isKiirtanNumber(item.number)) return kiirtanSongForNumber(item.number)?.audioUrl?.trim() ?? ""
  return ""
}

/** Does the item have audio that can be saved? No: the control is not drawn at all. */
export function itemHasAudio(item: DownloadItem): boolean {
  if (item.url?.trim()) return true
  return hasPlayableAudio(item.number)
}

/* ------------------------------------------------------------------ queue */

/** Songs of a list that wait for their turn or run now; they count as "downloading". */
export const useDownloadQueue = create<{ pending: DownloadItem[] }>(() => ({ pending: [] }))

const running = new Set<number>()
let failed: DownloadItem[] = []

/** Why the last failed save failed; the toast words it (no connection, phone full, anything else). */
const failureReason = new Map<number, DownloadFailure>()

function toastFailure(retry: () => void, code?: DownloadFailure | null) {
  useDownloadUiStore.getState().showToast(downloadFailureToast(code), { label: downloadRetryLabel(), onPress: retry })
}

/** The reason to show for a group of failed items: the first one that is not a plain "unknown". */
function reasonOf(items: readonly DownloadItem[]): DownloadFailure | null {
  let found: DownloadFailure | null = null
  for (const item of items) {
    const code = failureReason.get(item.number)
    failureReason.delete(item.number)
    if (code && (found == null || found === "unknown")) found = code
  }
  return found
}

/** One download to the end. True when it went well or was cancelled, false when it failed. */
async function runOne(item: DownloadItem): Promise<boolean> {
  if (MOCKUP_DATA) {
    const key = demoDownloadKey(item.number, item.versionIndex ?? 0)
    const demo = useDemoDownloads.getState()
    if (demo.done[key] || demo.progress[key] !== undefined) return true
    demo.toggle(key)
    if (demoDownloadFails()) {
      // the preview of a lost connection: the ring runs a little, then stops and the toast comes
      await new Promise((resolve) => setTimeout(resolve, 900))
      if (useDemoDownloads.getState().progress[key] === undefined) return true
      useDemoDownloads.getState().cancel(key)
      return false
    }
    return true
  }
  try {
    await ensureOfflineAudioReady()
    await useOfflineAudioStore.getState().download(itemAudioUrl(item), item.number, { userInitiated: true })
    return true
  } catch (error) {
    failureReason.set(item.number, classifyDownloadError(error))
    return false
  }
}

function pump() {
  const { pending } = useDownloadQueue.getState()
  const idle = pending.filter((item) => !running.has(item.number))
  for (const item of nextToStart(idle, running.size)) {
    running.add(item.number)
    void runOne(item).then((ok) => {
      running.delete(item.number)
      if (!ok) failed.push(item)
      useDownloadQueue.setState((s) => ({ pending: s.pending.filter((p) => p.number !== item.number) }))
      pump()
    })
  }
  if (useDownloadQueue.getState().pending.length === 0 && running.size === 0 && failed.length > 0) {
    const again = failed
    failed = []
    toastFailure(() => startMany(again), reasonOf(again))
  }
}

/* ----------------------------------------------------------------- single */

/** Start one download. Signed out: the prompt. Failure: the quiet toast with Try again. */
export function startDownload(item: DownloadItem): void {
  if (!requireSignIn()) return
  if (!itemHasAudio(item)) return
  void runOne(item).then((ok) => {
    if (!ok) toastFailure(() => startDownload(item), reasonOf([item]))
  })
}

/** Files of the item that are on the phone (one recording when the item names one, else every recording of the song). */
function entriesOf(item: DownloadItem): OfflineAudioEntry[] {
  const state = useOfflineAudioStore.getState()
  const files = Object.values(state.files)
  const url = item.url?.trim()
  if (url) {
    const found = offlineRecordingState(url, state, { songNumber: item.number })
    return found.fileUri ? files.filter((f) => f.fileUri === found.fileUri) : []
  }
  return files.filter((f) => f.songNumber === item.number)
}

function demoKeysOf(item: DownloadItem, record: Readonly<Record<string, unknown>>): string[] {
  return Object.keys(record).filter((key) => (item.versionIndex == null ? Number(key.split("-")[0]) === item.number : key === demoDownloadKey(item.number, item.versionIndex)))
}

/** A tap on the ring: stop, drop the half file. */
export function cancelDownload(item: DownloadItem): void {
  useDownloadQueue.setState((s) => ({ pending: s.pending.filter((p) => p.number !== item.number) }))
  if (MOCKUP_DATA) {
    const demo = useDemoDownloads.getState()
    demoKeysOf(item, demo.progress).forEach((key) => demo.cancel(key))
    return
  }
  const store = useOfflineAudioStore.getState()
  const found = offlineRecordingState(item.url?.trim() || null, store, { songNumber: item.number })
  if (found.downloading && found.key) void store.remove(found.key)
}

/** Remove the copy from the phone, no questions (the confirm comes first, see confirmRemove). */
export async function removeDownload(item: DownloadItem): Promise<boolean> {
  if (MOCKUP_DATA) {
    const demo = useDemoDownloads.getState()
    demoKeysOf(item, demo.done).forEach((key) => demo.toggle(key))
    return true
  }
  const store = useOfflineAudioStore.getState()
  let allGone = true
  for (const entry of entriesOf(item)) {
    // Stop first: a song must not keep playing from a file we are deleting.
    usePlayerStore.getState().stopIfPlayingLocalUri(entry.fileUri)
    if (!(await store.remove(entry.remoteUrl))) allGone = false
  }
  return allGone
}

async function bytesOf(entries: OfflineAudioEntry[]): Promise<number | null> {
  if (!entries.length) return null
  const map: Record<string, OfflineAudioEntry> = {}
  entries.forEach((entry) => {
    map[entry.remoteUrl] = entry
  })
  try {
    const items = await scanOfflineStorage(map)
    return items.length ? items.reduce((sum, i) => sum + i.bytes, 0) : null
  } catch {
    return null
  }
}

/** The confirm sheet of "Remove download", with the size of the file. */
export async function confirmRemove(item: DownloadItem): Promise<void> {
  const bytes = MOCKUP_DATA ? demoDownloadBytes(item.seconds ?? 240) : await bytesOf(entriesOf(item))
  const copy = removeConfirmCopy({ title: item.title ?? (item.kind === "song" ? `PS ${item.number}` : t("dl.thisRecording")), bytes })
  useDownloadUiStore.getState().openPrompt({
    kind: "remove",
    copy,
    onConfirm: () => {
      void removeDownload(item).then((gone) => {
        const ui = useDownloadUiStore.getState()
        // Only say "Removed" when the file is really gone.
        ui.showToast(gone ? downloadRemovedToast() : downloadErrorToast())
      })
    },
  })
}

/** What a tap on the control does in each state. */
export function pressDownload(item: DownloadItem, status: DownloadStatus): void {
  if (status === "downloading") return cancelDownload(item)
  if (status === "done") return void confirmRemove(item)
  startDownload(item)
}

/* ------------------------------------------------------------------- list */

/** Start every item of a list that is not on the phone yet. Waiting items count as downloading. */
export function startMany(items: readonly DownloadItem[]): void {
  if (!requireSignIn()) return
  const audible = items.filter(itemHasAudio)
  if (!audible.length) return
  if (MOCKUP_DATA) {
    // the preview runs them all at once, like its single downloads
    void Promise.all(audible.map(runOne)).then((results) => {
      if (results.some((ok) => !ok)) toastFailure(() => startMany(audible), reasonOf(audible))
    })
    return
  }
  useDownloadQueue.setState((s) => {
    const known = new Set(s.pending.map((p) => p.number))
    return { pending: [...s.pending, ...audible.filter((item) => !known.has(item.number))] }
  })
  pump()
}

/** Stop the rest of a list; what is already on the phone stays. */
export function stopMany(items: readonly DownloadItem[], doneCount: number, total: number): void {
  failed = []
  items.forEach(cancelDownload)
  useDownloadUiStore.getState().showToast(listStoppedToast(doneCount, total))
}

/** The confirm sheet of "Remove downloads" for a whole list. */
export async function confirmRemoveMany(name: string, items: readonly DownloadItem[]): Promise<void> {
  const mine = items.filter((item) => (MOCKUP_DATA ? demoKeysOf(item, useDemoDownloads.getState().done).length > 0 : entriesOf(item).length > 0))
  if (!mine.length) return
  const bytes = MOCKUP_DATA
    ? mine.reduce((sum, item) => sum + demoDownloadBytes(item.seconds ?? 240), 0)
    : await bytesOf(mine.flatMap(entriesOf))
  const copy = listRemoveConfirmCopy({ name, count: mine.length, bytes })
  useDownloadUiStore.getState().openPrompt({
    kind: "remove",
    copy,
    onConfirm: () => {
      void Promise.all(mine.map(removeDownload)).then((results) =>
        useDownloadUiStore.getState().showToast(results.every(Boolean) ? downloadRemovedToast() : downloadErrorToast()),
      )
    },
  })
}
