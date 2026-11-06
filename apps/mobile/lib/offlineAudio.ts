import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system/legacy"
import { Platform } from "react-native"
import { create } from "zustand"

import { unwrapArchiveAudioUrl } from "@prabhat/core"

import { api } from "@/lib/client"
import {
  classifyDownloadError,
  contentLengthFrom,
  DownloadError,
  enoughSpace,
  isStalePart,
  keepsPartialFile,
  PART_SUFFIX,
  partUriFor,
  resumeDataFor,
  verifyFinished,
} from "@/lib/offline/downloadVerify"
import { favoritesScopeKey } from "@/lib/favoritesScope"
import { songDetailToMockSong } from "@/lib/songMap"
import { useAuthStore } from "@/stores/authStore"

export type OfflineAudioEntry = {
  remoteUrl: string
  fileUri: string
  songNumber: number
}

type OfflineAudioState = {
  ready: boolean
  /** Keyed by the recording's remote URL so every version can be saved independently. */
  files: Record<string, OfflineAudioEntry>
  progress: Record<string, number>
  errors: Record<string, string>
  /** songNumber → remote URL while a save is in flight (drives UI progress). */
  activeBySong: Record<number, string>
  hydrate: () => Promise<void>
  download: (
    remoteUrl: string | null | undefined,
    songNumber: number,
    options?: { userInitiated?: boolean },
  ) => Promise<void>
  /** True when the saved copy is gone; false when the file is still on the phone (it stays in the list). */
  remove: (remoteUrl: string) => Promise<boolean>
}

type AuthSnapshot = {
  mode: "guest" | "signed_in"
  memberId: string | null
  identityProvider: string | null
  email: string | null
}

export function offlineAudioScopeKey(auth: AuthSnapshot) {
  return favoritesScopeKey(auth)
}

const FINALIZING_RATIO = 0.99

export function offlineSaveControls(input: {
  mode: "guest" | "signed_in"
  downloaded: boolean
  downloading?: boolean
  /** True while AsyncStorage offline index is still loading after app launch. */
  indexPending?: boolean
  progress?: number
  error?: string | null
}) {
  if (input.mode !== "signed_in") {
    return {
      visible: false,
      badge: false,
      showError: false,
      downloading: false,
      label: "",
      bufferingLabel: "Starting stream…",
    }
  }
  // Cold start: don't flash "Save in this app" before the offline index loads.
  if (input.indexPending && !input.downloaded) {
    return {
      visible: true,
      badge: false,
      showError: false,
      downloading: true,
      label: "Checking offline…",
      bufferingLabel: "Opening saved audio…",
    }
  }
  // Prefer explicit downloading, but never ignore live progress (?? would keep
  // false and hide "Saving… 40%" after remove → save-again key mismatches).
  const downloading =
    !input.downloaded &&
    (Boolean(input.downloading) || input.progress != null)
  const ratio = input.progress ?? 0
  let label = "Save in this app"
  if (downloading) {
    label =
      ratio >= FINALIZING_RATIO
        ? "Saving offline…"
        : ratio > 0
          ? `Saving… ${Math.round(ratio * 100)}%`
          : "Saving…"
  } else if (input.downloaded) {
    label = "Remove from this app"
  }
  return {
    visible: true,
    badge: input.downloaded && !downloading,
    showError: Boolean(input.error),
    downloading,
    label,
    bufferingLabel: input.downloaded
      ? "Opening saved audio…"
      : "Starting stream…",
  }
}

function currentAuth(): AuthSnapshot {
  const { mode, memberId, identityProvider, email } = useAuthStore.getState()
  return { mode, memberId, identityProvider, email }
}

function indexKey(scope: string) {
  return `ps.offline.audio.v2.${scope}`
}

function normalizeUrl(url: string | null | undefined): string {
  return url?.trim() || ""
}

function isHttpAudioUrl(url: string | null | undefined): boolean {
  return /^https?:\/\//i.test(normalizeUrl(url))
}

function canonicalAudioUrl(url: string | null | undefined): string {
  const trimmed = normalizeUrl(url)
  return trimmed ? unwrapArchiveAudioUrl(trimmed) : ""
}

/** Lookup key for the offline index — prefer unwrapped archive URLs. */
function offlineIndexKeys(url: string | null | undefined): string[] {
  const raw = normalizeUrl(url)
  const canon = canonicalAudioUrl(url)
  const keys: string[] = []
  if (canon) keys.push(canon)
  if (raw && raw !== canon) keys.push(raw)
  return keys
}

function findOfflineEntry(
  files: Record<string, OfflineAudioEntry>,
  url: string | null | undefined,
): OfflineAudioEntry | null {
  for (const key of offlineIndexKeys(url)) {
    const entry = files[key]
    if (entry) return entry
  }
  return null
}

const lastProgressAt: Record<string, number> = {}
const downloadEpoch: Record<string, number> = {}
const inflight = new Map<string, { cancelAsync: () => Promise<void> }>()
const pendingMeta = new Map<
  string,
  { fileUri: string; songNumber: number; scope: string; epoch: number }
>()
const STUCK_PROGRESS_MS = 20_000
const WATCH_POLL_MS = 1000
/** No byte for this long means the connection is dead, not slow. */
const STALL_MS = 60_000

/** Canonical offline key — use for every files/progress lookup in UI and store. */
export function normalizeOfflineUrl(url: string | null | undefined) {
  return normalizeUrl(url)
}

export function isOfflineTransferActive(url: string | null | undefined) {
  const key = normalizeOfflineUrl(url)
  if (!key) return false
  if (inflight.has(key) || pendingMeta.has(key)) return true
  const canon = canonicalAudioUrl(key)
  if (canon && canon !== key && (inflight.has(canon) || pendingMeta.has(canon))) return true
  return false
}

/** Remote URL currently downloading for this song (progress / spinner binding). */
export function activeDownloadUrlForSong(
  songNumber: number,
  snapshot?: { activeBySong?: Record<number, string> },
): string | null {
  const fromStore = snapshot?.activeBySong?.[songNumber]
  if (fromStore) return fromStore
  for (const [url, meta] of pendingMeta.entries()) {
    if (meta.songNumber === songNumber) return url
  }
  return null
}

function normalizeLocalUriKey(uri: string): string {
  const trimmed = uri.trim()
  if (!trimmed.startsWith("file:")) return trimmed
  try {
    return decodeURIComponent(trimmed)
  } catch {
    return trimmed
  }
}

function sameLocalFileUri(left: string, right: string): boolean {
  if (left === right) return true
  return normalizeLocalUriKey(left) === normalizeLocalUriKey(right)
}

function findEntryByLocalUri(
  files: Record<string, OfflineAudioEntry>,
  fileUri: string,
): OfflineAudioEntry | null {
  const target = fileUri.trim()
  if (!target) return null
  for (const entry of Object.values(files)) {
    if (sameLocalFileUri(entry.fileUri, target)) return entry
  }
  return null
}

/**
 * UI status for a recording's offline copy.
 * After cold start offline, playback often uses a `file://` URI (or null remote
 * URL on Saved rows) — still resolve against the saved index so "Available
 * offline" / Remove stay visible.
 */
export function offlineRecordingState(
  url: string | null | undefined,
  snapshot: {
    files: Record<string, OfflineAudioEntry>
    progress: Record<string, number>
    errors: Record<string, string>
    activeBySong?: Record<number, string>
  },
  options?: { songNumber?: number },
) {
  const keys = offlineIndexKeys(url)
  const raw = normalizeOfflineUrl(url)
  const activeForSong =
    options?.songNumber != null
      ? activeDownloadUrlForSong(options.songNumber, snapshot)
      : null
  let entry = findOfflineEntry(snapshot.files, url)
  if (!entry && raw.startsWith("file:")) {
    entry = findEntryByLocalUri(snapshot.files, raw)
  }
  // Song-number fallback only when not mid-save (otherwise a leftover recording
  // would hide re-save progress after Remove).
  if (
    !entry &&
    !activeForSong &&
    options?.songNumber &&
    (!raw || raw.startsWith("file:"))
  ) {
    const forSong = Object.values(snapshot.files).filter(
      (file) => file.songNumber === options.songNumber,
    )
    if (raw.startsWith("file:")) {
      entry =
        forSong.find((file) => sameLocalFileUri(file.fileUri, raw)) ??
        (forSong.length === 1 ? forSong[0] : null)
    } else if (forSong.length >= 1) {
      entry = forSong[0]
    }
  }
  const key = entry?.remoteUrl || activeForSong || keys[0] || raw
  const downloaded = Boolean(entry)
  const progress =
    keys.map((k) => snapshot.progress[k]).find((value) => value != null) ??
    (activeForSong != null ? snapshot.progress[activeForSong] : undefined) ??
    (key ? snapshot.progress[key] : undefined)
  const error =
    keys.map((k) => snapshot.errors[k]).find((value) => Boolean(value)) ??
    (activeForSong != null ? snapshot.errors[activeForSong] : undefined) ??
    (key ? snapshot.errors[key] : undefined)
  const active =
    Boolean(activeForSong) ||
    keys.some((k) => isOfflineTransferActive(k)) ||
    (key ? isOfflineTransferActive(key) : false)
  const downloading = Boolean(!downloaded && (active || progress != null))
  return {
    key: entry?.remoteUrl || activeForSong || key,
    downloaded,
    downloading,
    progress,
    error,
    fileUri: entry?.fileUri,
  }
}

function sweepStaleProgress() {
  const state = useOfflineAudioStore.getState()
  const next = { ...state.progress }
  let changed = false
  const now = Date.now()
  for (const [url, ratio] of Object.entries(next)) {
    if (state.files[url]) {
      delete next[url]
      delete lastProgressAt[url]
      changed = true
      continue
    }
    if (isOfflineTransferActive(url)) continue
    const age = now - (lastProgressAt[url] ?? 0)
    if (age > STUCK_PROGRESS_MS || (ratio === 0 && age > 4_000)) {
      delete next[url]
      delete lastProgressAt[url]
      changed = true
    }
  }
  if (changed) useOfflineAudioStore.setState({ progress: next })
}

export function reconcileOfflineProgress() {
  sweepStaleProgress()
}

/** Stable short hash of a URL so different recordings of one song get distinct files. */
function urlHash(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash << 5) - hash + url.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

const OFFLINE_FOLDER = "offline-audio"

/**
 * The part of a saved file's address that survives an update or a restore: `offline-audio/<scope>/<file>.mp3`.
 * iOS can change the app container (the long UUID in the Documents path) after an update, so the index stores
 * only this relative path and the full address is built from the current document directory every time.
 * Old entries hold an absolute address from some earlier container; the part from `offline-audio/` is kept.
 */
export function relativeOfflinePath(uri: string, documentDirectory?: string | null): string | null {
  const trimmed = uri.trim()
  if (!trimmed) return null
  if (documentDirectory && trimmed.startsWith(documentDirectory)) {
    const rest = trimmed.slice(documentDirectory.length).replace(/^\/+/, "")
    return rest || null
  }
  const marker = `/${OFFLINE_FOLDER}/`
  const at = trimmed.indexOf(marker)
  if (at >= 0) return trimmed.slice(at + 1)
  if (!trimmed.startsWith("file:") && !trimmed.startsWith("/")) return trimmed
  return null
}

export function absoluteOfflineUri(path: string, documentDirectory: string): string {
  const base = documentDirectory.endsWith("/") ? documentDirectory : `${documentDirectory}/`
  return `${base}${path.replace(/^\/+/, "")}`
}

/** What goes to AsyncStorage: relative paths only (an address with no known folder is kept as it was). */
export function serializeOfflineIndex(
  files: Record<string, OfflineAudioEntry>,
  documentDirectory: string | null | undefined,
): string {
  const out: Record<string, { remoteUrl: string; path?: string; fileUri?: string; songNumber: number }> = {}
  for (const [key, entry] of Object.entries(files)) {
    const path = relativeOfflinePath(entry.fileUri, documentDirectory)
    out[key] = path
      ? { remoteUrl: entry.remoteUrl, path, songNumber: entry.songNumber }
      : { remoteUrl: entry.remoteUrl, fileUri: entry.fileUri, songNumber: entry.songNumber }
  }
  return JSON.stringify(out)
}

/** Reads both formats: `path` (new, relative) and `fileUri` (old, absolute, moved onto the current container). */
export function parseOfflineIndex(
  raw: string | null,
  documentDirectory: string | null | undefined,
): Record<string, OfflineAudioEntry> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, { remoteUrl?: string; path?: string; fileUri?: string; songNumber?: number }>
    const files: Record<string, OfflineAudioEntry> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const remoteUrl = normalizeUrl(value?.remoteUrl) || normalizeUrl(key)
      if (!remoteUrl) continue
      let fileUri: string | null = null
      const relative = value?.path
        ? value.path
        : value?.fileUri
          ? relativeOfflinePath(value.fileUri, documentDirectory)
          : null
      if (relative && documentDirectory) fileUri = absoluteOfflineUri(relative, documentDirectory)
      else if (value?.fileUri) fileUri = value.fileUri
      if (!fileUri) continue
      files[remoteUrl] = {
        remoteUrl,
        fileUri,
        songNumber: Number(value.songNumber) || 0,
      }
    }
    return files
  } catch {
    return {}
  }
}

export function offlineDir(scope: string) {
  const base = FileSystem.documentDirectory
  if (!base) throw new Error("Offline storage is not available on this device.")
  return `${base}offline-audio/${encodeURIComponent(scope)}/`
}

function destinationUri(scope: string, songNumber: number, remoteUrl: string) {
  return `${offlineDir(scope)}${songNumber}-${urlHash(remoteUrl)}.mp3`
}

/** The player registers here so that no path that deletes a saved file leaves it playing. */
let beforeFileRemoved: ((fileUri: string) => void) | null = null
export function setBeforeOfflineFileRemoved(hook: ((fileUri: string) => void) | null) {
  beforeFileRemoved = hook
}

let persistChain: Promise<void> = Promise.resolve()
/** The account whose files the store currently holds. A save that finishes for another account must not land here. */
let activeScope: string | null = null
let hydrateToken = 0

function persistCurrent(scope: string) {
  // A failed write must not poison the chain: every later save would be skipped until restart.
  persistChain = persistChain
    .catch(() => undefined)
    .then(async () => {
      if (scope !== activeScope) return
      const files = useOfflineAudioStore.getState().files
      await AsyncStorage.setItem(indexKey(scope), serializeOfflineIndex(files, FileSystem.documentDirectory))
    })
  return persistChain
}

/** A save finished after the listener switched account: it belongs to the old account's index, not to the store. */
async function addToStoredIndex(scope: string, entry: OfflineAudioEntry) {
  persistChain = persistChain
    .catch(() => undefined)
    .then(async () => {
      const stored = parseOfflineIndex(await AsyncStorage.getItem(indexKey(scope)), FileSystem.documentDirectory)
      stored[entry.remoteUrl] = entry
      await AsyncStorage.setItem(indexKey(scope), serializeOfflineIndex(stored, FileSystem.documentDirectory))
    })
  return persistChain
}

async function fileExists(uri: string) {
  try {
    const info = await FileSystem.getInfoAsync(uri)
    return Boolean(info.exists) && !info.isDirectory
  } catch {
    return false
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists || info.isDirectory) return null
    return "size" in info && typeof info.size === "number" ? info.size : null
  } catch {
    return null
  }
}

async function deleteQuietly(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true })
  } catch {
    /* nothing to delete */
  }
}

async function freeDiskBytes(): Promise<number | null> {
  try {
    if (typeof FileSystem.getFreeDiskStorageAsync !== "function") return null
    const free = await FileSystem.getFreeDiskStorageAsync()
    return typeof free === "number" && Number.isFinite(free) ? free : null
  } catch {
    return null
  }
}

function bumpEpoch(url: string) {
  downloadEpoch[url] = (downloadEpoch[url] ?? 0) + 1
  return downloadEpoch[url]
}

function setDownloadProgress(url: string, ratio: number) {
  const clamped = Math.min(1, Math.max(0, ratio))
  const now = Date.now()
  const previous = useOfflineAudioStore.getState().progress[url]
  // Always publish the first move off 0% so remove → save-again shows progress.
  const leavingZero = (previous == null || previous === 0) && clamped > 0
  if (
    !leavingZero &&
    clamped < FINALIZING_RATIO &&
    now - (lastProgressAt[url] ?? 0) < 250
  ) {
    return
  }
  lastProgressAt[url] = now
  useOfflineAudioStore.setState((state) => ({
    progress: { ...state.progress, [url]: clamped },
  }))
}

function clearProgress(url: string) {
  const progress = { ...useOfflineAudioStore.getState().progress }
  delete progress[url]
  delete lastProgressAt[url]
  useOfflineAudioStore.setState({ progress })
}

function clearActiveSong(songNumber: number, url?: string) {
  useOfflineAudioStore.setState((state) => {
    const activeBySong = { ...state.activeBySong }
    if (activeBySong[songNumber] && (!url || activeBySong[songNumber] === url)) {
      delete activeBySong[songNumber]
    }
    return { activeBySong }
  })
}

const startingLocks = new Set<string>()

type StoreSet = (
  partial: Partial<OfflineAudioState> | ((state: OfflineAudioState) => Partial<OfflineAudioState>),
) => void

/** Waits for the partial file to reach the announced size (a downloader that never reports back), or to stall. */
async function watchPartial(
  partUri: string,
  getExpected: () => number | null,
  isCancelled: () => boolean,
): Promise<{ done: true } | { done: false; stalled: true } | null> {
  let last = -1
  let stableSince = Date.now()
  let sameSizeReads = 0
  for (;;) {
    await sleep(WATCH_POLL_MS)
    if (isCancelled()) return null
    const size = await fileSize(partUri)
    const expected = getExpected()
    if (size != null && size !== last) {
      last = size
      stableSince = Date.now()
      sameSizeReads = 0
    } else {
      sameSizeReads += 1
    }
    // Whole means: exactly the announced size, and it stopped growing. A guess never counts.
    if (size != null && expected != null && expected > 0 && size === expected && sameSizeReads >= 1) {
      return { done: true }
    }
    if (Date.now() - stableSince > STALL_MS) return { done: false, stalled: true }
  }
}

async function runDownload(
  remoteUrl: string | null | undefined,
  songNumber: number,
  set: StoreSet,
  get: () => OfflineAudioState,
): Promise<void> {
  const auth = currentAuth()
  if (auth.mode !== "signed_in") {
    throw new Error("Sign in to download songs for offline listening.")
  }

  const scope = offlineAudioScopeKey(auth)

  // After offline play, UI may still pass file:// — ignore and resolve HTTP.
  let url = canonicalAudioUrl(remoteUrl)
  if (!isHttpAudioUrl(url)) {
    url = ""
  }
  if (!url) {
    const detail = await api.fetchSong(songNumber)
    url = detail ? canonicalAudioUrl(songDetailToMockSong(detail).audioUrl) : ""
  }
  if (!isHttpAudioUrl(url)) {
    throw new Error(
      url
        ? "This recording cannot be saved in the app."
        : "No in-app audio is available to download for this song yet.",
    )
  }
  const inFlightProgress = get().progress[url]
  if (inFlightProgress != null) {
    const stuckFor = Date.now() - (lastProgressAt[url] ?? 0)
    if (stuckFor < STUCK_PROGRESS_MS) return
    clearProgress(url)
  }

  const epoch = bumpEpoch(url)
  const cancelled = () => downloadEpoch[url] !== epoch
  let partUri: string | null = null

  try {
    const existing = get().files[url]
    if (existing && (await fileExists(existing.fileUri))) {
      if (cancelled()) return
      clearProgress(url)
      return
    }

    const free = await freeDiskBytes()
    if (!enoughSpace(free, 0)) throw new DownloadError("no-space")

    await FileSystem.makeDirectoryAsync(offlineDir(scope), { intermediates: true })
    const fileUri = destinationUri(scope, songNumber, url)
    partUri = partUriFor(fileUri)
    // Continue a half-written file where the platform can; otherwise start clean.
    const kept = await fileSize(partUri)
    const resumeData = resumeDataFor(Platform.OS, kept)
    if (!resumeData) await deleteQuietly(partUri)

    pendingMeta.set(url, { fileUri, songNumber, scope, epoch })
    const sessionType = FileSystem.FileSystemSessionType?.BACKGROUND
    let expected: number | null = null
    let noSpace = false
    const task = FileSystem.createDownloadResumable(
      url,
      partUri,
      sessionType != null ? { sessionType } : {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite > 0) {
          if (expected == null) {
            expected = totalBytesExpectedToWrite
            // The size is known now: stop at once if the phone cannot hold it.
            void freeDiskBytes().then((room) => {
              if (!enoughSpace(room, Math.max(0, totalBytesExpectedToWrite - totalBytesWritten))) {
                noSpace = true
                void inflight.get(url)?.cancelAsync().catch(() => undefined)
              }
            })
          }
          setDownloadProgress(url, totalBytesWritten / totalBytesExpectedToWrite)
        } else {
          setDownloadProgress(url, 0)
        }
      },
      resumeData,
    )
    inflight.set(url, task)
    lastProgressAt[url] = Date.now()
    set((state) => ({
      progress: { ...state.progress, [url]: state.progress[url] ?? 0 },
      errors: { ...state.errors, [url]: "" },
      activeBySong: { ...state.activeBySong, [songNumber]: url },
    }))

    // The downloader's own answer is the truth. The watcher only covers a downloader that never
    // reports back, and it accepts the file only at exactly the announced size.
    const finished = await Promise.race([
      (resumeData ? task.resumeAsync() : task.downloadAsync()).then(
        (response) => ({ kind: "response" as const, response }),
        (error: unknown) => ({ kind: "error" as const, error }),
      ),
      watchPartial(partUri, () => expected, cancelled).then((outcome) => ({ kind: "watch" as const, outcome })),
    ])
    inflight.delete(url)
    if (cancelled()) {
      await deleteQuietly(partUri)
      clearActiveSong(songNumber, url)
      return
    }
    if (noSpace) throw new DownloadError("no-space")
    let status: number | null = 200
    let headerBytes: number | null = null
    if (finished.kind === "error") {
      throw new DownloadError(classifyDownloadError(finished.error), finished.error instanceof Error ? finished.error.message : undefined)
    }
    if (finished.kind === "watch") {
      void task.cancelAsync().catch(() => undefined)
      if (!finished.outcome) return
      if (!finished.outcome.done) throw new DownloadError("stalled")
    } else {
      const response = finished.response as { status?: number; headers?: Record<string, string> } | undefined
      if (!response) throw new DownloadError("offline")
      status = response.status ?? 200
      headerBytes = contentLengthFrom(response.headers)
    }

    const size = await fileSize(partUri)
    const failure = verifyFinished({ status, size, expected: expected ?? headerBytes })
    if (failure) throw new DownloadError(failure)

    // Whole: move it into place in one step, so a half file never has the final name.
    await deleteQuietly(fileUri)
    await FileSystem.moveAsync({ from: partUri, to: fileUri })
    partUri = null

    // Not hydrated yet (a save finished before the index was read): this account owns the store now.
    if (activeScope == null) activeScope = scope
    if (scope === activeScope) {
      set((state) => {
        const activeBySong = { ...state.activeBySong }
        delete activeBySong[songNumber]
        return {
          files: { ...state.files, [url]: { remoteUrl: url, fileUri, songNumber } },
          activeBySong,
        }
      })
      clearProgress(url)
      pendingMeta.delete(url)
      await persistCurrent(scope)
    } else {
      // The listener switched account during the save: the file belongs to the first account.
      clearProgress(url)
      pendingMeta.delete(url)
      await addToStoredIndex(scope, { remoteUrl: url, fileUri, songNumber })
    }
  } catch (error) {
    inflight.delete(url)
    pendingMeta.delete(url)
    clearActiveSong(songNumber, url)
    const code = classifyDownloadError(error)
    // A dropped connection keeps what arrived (Android continues from it); every other failure cleans up.
    if (partUri && !keepsPartialFile(code)) await deleteQuietly(partUri)
    if (cancelled()) return
    clearProgress(url)
    const wrapped = error instanceof DownloadError ? error : new DownloadError(code, error instanceof Error ? error.message : undefined)
    set((state) => ({
      errors: { ...state.errors, [url]: wrapped.message },
    }))
    throw wrapped
  } finally {
    pendingMeta.delete(url)
    clearActiveSong(songNumber, url)
    sweepStaleProgress()
  }
}

/** Half-written files left by a killed app: dropped when old, never counted as saved. */
async function removeStalePartials(scope: string) {
  try {
    if (typeof FileSystem.readDirectoryAsync !== "function") return
    const dir = offlineDir(scope)
    const names = await FileSystem.readDirectoryAsync(dir)
    const now = Date.now()
    for (const name of names) {
      if (!name.endsWith(PART_SUFFIX)) continue
      const info = await FileSystem.getInfoAsync(`${dir}${name}`)
      const modified = info.exists && "modificationTime" in info ? info.modificationTime : null
      if (isStalePart(modified, now)) await deleteQuietly(`${dir}${name}`)
    }
  } catch {
    /* no folder yet */
  }
}

export const useOfflineAudioStore = create<OfflineAudioState>((set, get) => ({
  ready: false,
  files: {},
  progress: {},
  errors: {},
  activeBySong: {},

  hydrate: async () => {
    const scope = offlineAudioScopeKey(currentAuth())
    const token = (hydrateToken += 1)
    // Old absolute addresses are moved onto the current container here, then saved back as relative paths.
    const stored = parseOfflineIndex(await AsyncStorage.getItem(indexKey(scope)), FileSystem.documentDirectory)
    const files: Record<string, OfflineAudioEntry> = {}
    await Promise.all(
      Object.entries(stored).map(async ([key, entry]) => {
        if (await fileExists(entry.fileUri)) {
          files[key] = entry
        }
      }),
    )
    // Signed in as someone else (or signed out) while the index was loading: this answer is stale.
    if (token !== hydrateToken || scope !== offlineAudioScopeKey(currentAuth())) return
    activeScope = scope
    set({ ready: true, files, errors: {}, progress: {}, activeBySong: {} })
    await persistCurrent(scope)
    sweepStaleProgress()
    void removeStalePartials(scope)
  },

  download: async (remoteUrl, songNumber, options) => {
    if (!options?.userInitiated) return
    // Taken before the first await: a double tap must not start two saves of one file.
    const lockKey = `${songNumber}|${normalizeUrl(remoteUrl)}`
    if (startingLocks.has(lockKey)) return
    startingLocks.add(lockKey)
    try {
      await runDownload(remoteUrl, songNumber, set, get)
    } finally {
      startingLocks.delete(lockKey)
    }
  },

  remove: async (remoteUrl) => {
    const keys = offlineIndexKeys(remoteUrl)
    const url = keys[0] || normalizeUrl(remoteUrl)
    if (!url) return true
    for (const key of keys.length ? keys : [url]) {
      bumpEpoch(key)
      pendingMeta.delete(key)
      const task = inflight.get(key)
      inflight.delete(key)
      if (task) {
        try {
          await task.cancelAsync()
        } catch {
          /* ignore */
        }
      }
    }
    const entry = findOfflineEntry(get().files, remoteUrl)
    if (entry) {
      try {
        beforeFileRemoved?.(entry.fileUri)
      } catch {
        /* the player must never block a delete */
      }
      try {
        await FileSystem.deleteAsync(entry.fileUri, { idempotent: true })
      } catch {
        /* the check below decides */
      }
      await deleteQuietly(partUriFor(entry.fileUri))
      // A file that is still there was not removed: keep it in the list instead of claiming space was freed.
      if (await fileExists(entry.fileUri)) return false
    }
    const scope = offlineAudioScopeKey(currentAuth())
    set((state) => {
      const files = { ...state.files }
      const progress = { ...state.progress }
      const errors = { ...state.errors }
      for (const key of keys.length ? keys : [url]) {
        delete files[key]
        delete progress[key]
        delete errors[key]
        delete lastProgressAt[key]
      }
      if (entry?.remoteUrl) {
        delete files[entry.remoteUrl]
        delete progress[entry.remoteUrl]
        delete errors[entry.remoteUrl]
        delete lastProgressAt[entry.remoteUrl]
      }
      return { files, progress, errors }
    })
    await persistCurrent(scope)
    return true
  },
}))

let hydrateInflight: Promise<void> | null = null

export async function hydrateOfflineAudio() {
  if (hydrateInflight) return hydrateInflight
  hydrateInflight = (async () => {
    try {
      await useOfflineAudioStore.getState().hydrate()
    } finally {
      hydrateInflight = null
    }
  })()
  return hydrateInflight
}

/** Wait for the offline index (and any in-flight re-hydrate) before resolving play URIs. */
export async function ensureOfflineAudioReady() {
  if (hydrateInflight) await hydrateInflight
  if (!useOfflineAudioStore.getState().ready) {
    await hydrateOfflineAudio()
  }
}

useAuthStore.subscribe((state, previous) => {
  if (
    state.mode === previous.mode &&
    state.memberId === previous.memberId &&
    state.identityProvider === previous.identityProvider &&
    state.email === previous.email
  ) {
    return
  }
  void hydrateOfflineAudio()
})

/**
 * Android ExoPlayer often fails on percent-encoded document paths
 * (e.g. member%3A… from encodeURIComponent scope). Decode for playback only;
 * FileSystem APIs keep using the stored URI.
 */
export function toPlayableLocalUri(uri: string): string {
  const trimmed = uri.trim()
  if (!trimmed.startsWith("file:")) return trimmed
  if (Platform.OS !== "android") return trimmed
  try {
    // Decode member%3A… path segments so ExoPlayer opens the real folder.
    const playable = /%[0-9A-Fa-f]{2}/.test(trimmed) ? decodeURIComponent(trimmed) : trimmed
    if (playable.startsWith("file:///")) return playable
    if (playable.startsWith("file://")) return playable.replace(/^file:\/\//, "file:///")
    if (playable.startsWith("file:/")) return playable.replace(/^file:\//, "file:///")
    return playable
  } catch {
    return trimmed
  }
}

async function offlineFileForSong(songNumber: number) {
  const files = useOfflineAudioStore.getState().files
  for (const entry of Object.values(files)) {
    if (entry.songNumber === songNumber && (await fileExists(entry.fileUri))) {
      return toPlayableLocalUri(entry.fileUri)
    }
  }
  return null
}

export async function resolvePlaybackUri(
  songNumber: number,
  remoteUrl?: string | null,
): Promise<{ uri: string; local: boolean } | null> {
  await ensureOfflineAudioReady()
  const signedIn = useAuthStore.getState().mode === "signed_in"
  // Only http(s) counts as a stream target — never treat stale file:// as remote.
  const remoteHttp = (() => {
    const canon = canonicalAudioUrl(remoteUrl)
    return canon && isHttpAudioUrl(canon) ? canon : ""
  })()
  const legacyHttp = (() => {
    const raw = normalizeUrl(remoteUrl)
    return raw && isHttpAudioUrl(raw) ? raw : ""
  })()
  if (signedIn) {
    const files = useOfflineAudioStore.getState().files
    const entry = findOfflineEntry(files, remoteUrl)
    if (entry && (await fileExists(entry.fileUri))) {
      return { uri: toPlayableLocalUri(entry.fileUri), local: true }
    }
    const offlineEntries = Object.values(files).filter((file) => file.songNumber === songNumber)
    const askedAnotherRecording =
      Boolean(remoteHttp) &&
      offlineEntries.length > 0 &&
      !offlineEntries.some((file) => {
        const saved = canonicalAudioUrl(file.remoteUrl) || file.remoteUrl
        return (
          saved === remoteHttp ||
          file.remoteUrl === remoteHttp ||
          file.remoteUrl === legacyHttp ||
          saved === legacyHttp
        )
      })
    if (!askedAnotherRecording) {
      const byNumber = await offlineFileForSong(songNumber)
      if (byNumber) return { uri: byNumber, local: true }
    }
  }
  if (remoteHttp) return { uri: remoteHttp, local: false }
  if (signedIn) {
    const byNumber = await offlineFileForSong(songNumber)
    if (byNumber) return { uri: byNumber, local: true }
  }
  return null
}
