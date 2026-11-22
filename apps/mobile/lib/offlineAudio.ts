import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system/legacy"
import { Platform } from "react-native"
import { create } from "zustand"

import { unwrapArchiveAudioUrl } from "@prabhat/core"

import { api } from "@/lib/client"
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
  remove: (remoteUrl: string) => Promise<void>
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

function addUrlKeyVariants(keys: Set<string>, value: string) {
  const trimmed = value.trim()
  if (!trimmed) return
  keys.add(trimmed)
  try {
    keys.add(decodeURIComponent(trimmed))
  } catch {
    /* malformed % sequences */
  }
  try {
    keys.add(new URL(trimmed).href)
  } catch {
    /* not absolute */
  }
}

/** Lookup key for the offline index — prefer unwrapped archive URLs. */
function offlineIndexKeys(url: string | null | undefined): string[] {
  const raw = normalizeUrl(url)
  const canon = canonicalAudioUrl(url)
  const keys = new Set<string>()
  if (canon) addUrlKeyVariants(keys, canon)
  if (raw) addUrlKeyVariants(keys, raw)
  return [...keys]
}

/**
 * Host + decoded path — `%27` vs `'` (common on PS 4079-style titles) must match.
 * Search/detail often disagree on query, proxy wrap, trailing slash, and encoding.
 */
function audioUrlFingerprint(url: string | null | undefined): string {
  const raw = canonicalAudioUrl(url) || normalizeUrl(url)
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    let path = parsed.pathname.replace(/\/+$/, "") || "/"
    try {
      path = decodeURIComponent(path)
    } catch {
      /* keep encoded path */
    }
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${path}`
  } catch {
    try {
      return decodeURIComponent(raw.replace(/\/+$/, "")).toLowerCase()
    } catch {
      return raw.replace(/\/+$/, "").toLowerCase()
    }
  }
}

function urlsReferToSameRecording(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = offlineIndexKeys(left)
  const b = offlineIndexKeys(right)
  if (a.some((key) => b.includes(key))) return true
  const fa = audioUrlFingerprint(left)
  const fb = audioUrlFingerprint(right)
  return Boolean(fa && fb && fa === fb)
}

/**
 * Catalog recordings first (deduped). Only pull extra rows from the offline
 * index when the catalog list is missing/empty — otherwise alias keys doubled
 * 3 recordings into 6 rows.
 */
export function mergeAudioRecordings(
  songNumber: number,
  recordings: Array<{ title: string; url: string; provider: string }>,
  files: Record<string, OfflineAudioEntry>,
): Array<{ title: string; url: string; provider: string }> {
  const byFingerprint = new Map<string, { title: string; url: string; provider: string }>()
  for (const item of recordings) {
    if (!isHttpAudioUrl(item.url)) continue
    const url = normalizeUrl(item.url)
    const fp = audioUrlFingerprint(url) || url
    if (byFingerprint.has(fp)) continue
    byFingerprint.set(fp, {
      title: item.title?.trim() || "Recording",
      url,
      provider: item.provider || "official",
    })
  }
  const merged = [...byFingerprint.values()]
  // Catalog already has the full list — do not append offline aliases again.
  if (merged.length > 1) return merged

  const seenFiles = new Set<string>()
  for (const entry of Object.values(files)) {
    if (entry.songNumber !== songNumber || !isHttpAudioUrl(entry.remoteUrl)) continue
    if (seenFiles.has(entry.fileUri)) continue
    seenFiles.add(entry.fileUri)
    const fp = audioUrlFingerprint(entry.remoteUrl) || entry.remoteUrl
    if (byFingerprint.has(fp)) continue
    byFingerprint.set(fp, {
      title: `Recording ${byFingerprint.size + 1}`,
      url: entry.remoteUrl,
      provider: "official",
    })
  }
  return [...byFingerprint.values()]
}

function findOfflineEntry(
  files: Record<string, OfflineAudioEntry>,
  url: string | null | undefined,
): OfflineAudioEntry | null {
  for (const key of offlineIndexKeys(url)) {
    const entry = files[key]
    if (entry) return entry
  }
  if (!normalizeUrl(url)) return null
  for (const entry of Object.values(files)) {
    if (urlsReferToSameRecording(entry.remoteUrl, url)) return entry
  }
  return null
}

/** True when the device can reach the stream (online alternate recording). */
async function remoteStreamReachable(url: string): Promise<boolean> {
  const tryOnce = async (init: RequestInit) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2_000)
    try {
      await fetch(url, { ...init, signal: controller.signal })
      return true
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    return await tryOnce({ method: "HEAD" })
  } catch {
    try {
      return await tryOnce({ method: "GET", headers: { Range: "bytes=0-0" } })
    } catch {
      return false
    }
  }
}

const lastProgressAt: Record<string, number> = {}
const downloadEpoch: Record<string, number> = {}
const inflight = new Map<string, { cancelAsync: () => Promise<void> }>()
const pendingMeta = new Map<
  string,
  { fileUri: string; songNumber: number; scope: string; epoch: number }
>()
const STUCK_PROGRESS_MS = 20_000
const FINALIZE_POLL_MS = 400

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
 * Song-level "active download" applies only when this row is not a concrete
 * https recording — otherwise one save makes every recording on PS 59 spin.
 */
function songLevelActiveApplies(
  activeUrl: string | null,
  recordingUrl: string | null | undefined,
): boolean {
  if (!activeUrl) return false
  const raw = normalizeOfflineUrl(recordingUrl)
  if (!raw || raw.startsWith("file:")) return true
  return urlsReferToSameRecording(activeUrl, recordingUrl)
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
  const songActiveApplies = songLevelActiveApplies(activeForSong, url)
  let entry = findOfflineEntry(snapshot.files, url)
  if (!entry && raw.startsWith("file:")) {
    entry = findEntryByLocalUri(snapshot.files, raw)
  }
  // Song-number fallback only when not mid-save (otherwise a leftover recording
  // would hide re-save progress after Remove). Never borrow another recording's
  // file when this row already has its own https URL.
  if (
    !entry &&
    !songActiveApplies &&
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
    } else if (forSong.length === 1) {
      entry = forSong[0]
    }
  }
  const boundActive = songActiveApplies ? activeForSong : null
  const key = entry?.remoteUrl || boundActive || keys[0] || raw
  const downloaded = Boolean(entry)
  const progress =
    keys.map((k) => snapshot.progress[k]).find((value) => value != null) ??
    (boundActive != null ? snapshot.progress[boundActive] : undefined) ??
    (key ? snapshot.progress[key] : undefined)
  const error =
    keys.map((k) => snapshot.errors[k]).find((value) => Boolean(value)) ??
    (boundActive != null ? snapshot.errors[boundActive] : undefined) ??
    (key ? snapshot.errors[key] : undefined)
  const active =
    keys.some((k) => isOfflineTransferActive(k)) ||
    (boundActive != null &&
      (isOfflineTransferActive(boundActive) || Boolean(boundActive))) ||
    (key ? isOfflineTransferActive(key) : false)
  const downloading = Boolean(!downloaded && (active || progress != null))
  return {
    key: entry?.remoteUrl || boundActive || key,
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

function parseIndex(raw: string | null): Record<string, OfflineAudioEntry> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<OfflineAudioEntry>>
    const files: Record<string, OfflineAudioEntry> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const remoteUrl = normalizeUrl(value?.remoteUrl) || normalizeUrl(key)
      if (!remoteUrl || !value?.fileUri) continue
      files[remoteUrl] = {
        remoteUrl,
        fileUri: value.fileUri,
        songNumber: Number(value.songNumber) || 0,
      }
    }
    return files
  } catch {
    return {}
  }
}

/** Folder segment without `:` / `%` — ExoPlayer Uri.parse fails on both forms. */
function safeScopeDirName(scope: string) {
  return scope.replace(/[^a-zA-Z0-9._-]+/g, "_")
}

function offlineDir(scope: string) {
  const base = FileSystem.documentDirectory
  if (!base) throw new Error("Offline storage is not available on this device.")
  return `${base}offline-audio/${safeScopeDirName(scope)}/`
}

function destinationUri(scope: string, songNumber: number, remoteUrl: string) {
  return `${offlineDir(scope)}${songNumber}-${urlHash(remoteUrl)}.mp3`
}

let persistChain = Promise.resolve()

function persistCurrent(scope: string) {
  persistChain = persistChain.then(async () => {
    const files = useOfflineAudioStore.getState().files
    await AsyncStorage.setItem(indexKey(scope), JSON.stringify(files))
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

async function fileReady(uri: string, allowEmpty = false) {
  try {
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists || info.isDirectory) return false
    if (!("size" in info)) return allowEmpty
    return allowEmpty ? info.size >= 0 : info.size > 0
  } catch {
    return false
  }
}

async function fileSizeBytes(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri)
    if (!info.exists || info.isDirectory || !("size" in info)) return 0
    return Number(info.size) || 0
  } catch {
    return 0
  }
}

/** Reject tiny / still-growing files — a few KB is only seconds of MP3. */
async function assertCompleteOfflineFile(
  fileUri: string,
  expectedBytes: number,
): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(fileUri)
    if (!info.exists || info.isDirectory) return false
    if (!("size" in info) || info.size == null) return true
    const size1 = Number(info.size) || 0
    if (size1 < 32_768) return false
    if (expectedBytes > 0 && size1 < expectedBytes * 0.9) return false
    await sleep(FINALIZE_POLL_MS)
    const size2 = await fileSizeBytes(fileUri)
    if (size2 !== size1 || size2 < 32_768) return false
    if (expectedBytes > 0 && size2 < expectedBytes * 0.9) return false
    return true
  } catch {
    return false
  }
}

/**
 * Fallback when downloadAsync hangs: only accept after progress is essentially
 * done AND size stops growing. Never treat "any bytes written" as done.
 */
async function waitForSettledDownload(
  fileUri: string,
  url: string,
  epoch: number,
  expectedBytes: number,
  timeoutMs = 90_000,
) {
  const deadline = Date.now() + timeoutMs
  let lastSize = -1
  let stableHits = 0
  while (Date.now() < deadline) {
    if (downloadEpoch[url] !== epoch) return null
    const progress = useOfflineAudioStore.getState().progress[url] ?? 0
    const size = await fileSizeBytes(fileUri)
    if (size > 0 && size === lastSize) stableHits += 1
    else {
      stableHits = 0
      lastSize = size
    }
    const progressDone = progress >= FINALIZING_RATIO
    const sizeMatches =
      expectedBytes > 0 ? size >= expectedBytes * 0.9 : size >= 32_768
    if (progressDone && sizeMatches && stableHits >= 2) {
      return { status: 200, uri: fileUri }
    }
    await sleep(FINALIZE_POLL_MS)
  }
  return null
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
  if (clamped >= FINALIZING_RATIO) {
    void attemptEarlyComplete(url)
  }
}

async function attemptEarlyComplete(_url: string) {
  // Do not index early. Indexing on "file exists" raced with in-place Android
  // writes and left Available offline pointing at truncated stubs (~5s play).
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

export const useOfflineAudioStore = create<OfflineAudioState>((set, get) => ({
  ready: false,
  files: {},
  progress: {},
  errors: {},
  activeBySong: {},

  hydrate: async () => {
    const scope = offlineAudioScopeKey(currentAuth())
    const stored = parseIndex(await AsyncStorage.getItem(indexKey(scope)))
    const files: Record<string, OfflineAudioEntry> = {}
    await Promise.all(
      Object.entries(stored).map(async ([key, entry]) => {
        if (await fileExists(entry.fileUri)) {
          files[key] = entry
        }
      }),
    )
    set({ ready: true, files, errors: {}, progress: {}, activeBySong: {} })
    await persistCurrent(scope)
    sweepStaleProgress()
  },

  download: async (remoteUrl, songNumber, options) => {
    if (!options?.userInitiated) return
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

    try {
      const existing = get().files[url]
      if (existing && (await fileExists(existing.fileUri))) {
        if (downloadEpoch[url] !== epoch) return
        clearProgress(url)
        return
      }

      await FileSystem.makeDirectoryAsync(offlineDir(scope), { intermediates: true })
      const fileUri = destinationUri(scope, songNumber, url)
      pendingMeta.set(url, { fileUri, songNumber, scope, epoch })
      const sessionType = FileSystem.FileSystemSessionType?.BACKGROUND
      let expectedBytes = 0
      const task = FileSystem.createDownloadResumable(
        url,
        fileUri,
        sessionType != null ? { sessionType } : {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) expectedBytes = totalBytesExpectedToWrite
          const ratio =
            totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0
          setDownloadProgress(url, ratio)
        },
      )
      inflight.set(url, task)
      lastProgressAt[url] = Date.now()
      set((state) => ({
        progress: { ...state.progress, [url]: state.progress[url] ?? 0 },
        errors: { ...state.errors, [url]: "" },
        activeBySong: { ...state.activeBySong, [songNumber]: url },
      }))
      // Await the real download — racing "any bytes on disk" saved ~5s stubs on Android.
      const downloaded = await task.downloadAsync().catch(() => null)
      let result =
        downloaded && typeof downloaded.status === "number" && downloaded.status < 400
          ? downloaded
          : null
      if (!result) {
        result = await waitForSettledDownload(fileUri, url, epoch, expectedBytes, 30_000)
      }
      inflight.delete(url)
      if (downloadEpoch[url] !== epoch) {
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true })
        } catch {
          /* ignore */
        }
        clearActiveSong(songNumber, url)
        return
      }
      if (!result || result.status >= 400) {
        throw new Error("Save failed. Try again on a stronger connection.")
      }
      const savedUri = result.uri || fileUri
      if (!(await assertCompleteOfflineFile(savedUri, expectedBytes))) {
        try {
          await FileSystem.deleteAsync(savedUri, { idempotent: true })
        } catch {
          /* ignore */
        }
        set((state) => {
          const files = { ...state.files }
          delete files[url]
          return { files }
        })
        await persistCurrent(scope)
        throw new Error("Save finished incompletely. Try again on a stronger connection.")
      }
      set((state) => {
        const activeBySong = { ...state.activeBySong }
        delete activeBySong[songNumber]
        const entry: OfflineAudioEntry = { remoteUrl: url, fileUri: savedUri, songNumber }
        const files = { ...state.files, [url]: entry }
        // Alias raw + unwrapped keys so search URL and detail URL both resolve.
        for (const key of [...offlineIndexKeys(url), ...offlineIndexKeys(remoteUrl)]) {
          if (key) files[key] = entry
        }
        return { files, activeBySong }
      })
      clearProgress(url)
      pendingMeta.delete(url)
      await persistCurrent(scope)
    } catch (error) {
      inflight.delete(url)
      pendingMeta.delete(url)
      clearActiveSong(songNumber, url)
      if (downloadEpoch[url] !== epoch) return
      clearProgress(url)
      const message = error instanceof Error ? error.message : "Save failed."
      set((state) => {
        const files = { ...state.files }
        delete files[url]
        return {
          files,
          errors: { ...state.errors, [url]: message },
        }
      })
      try {
        await persistCurrent(scope)
      } catch {
        /* ignore */
      }
      throw error
    } finally {
      pendingMeta.delete(url)
      clearActiveSong(songNumber, url)
      sweepStaleProgress()
    }
  },

  remove: async (remoteUrl) => {
    const keys = offlineIndexKeys(remoteUrl)
    const url = keys[0] || normalizeUrl(remoteUrl)
    if (!url) return
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
        await FileSystem.deleteAsync(entry.fileUri, { idempotent: true })
      } catch {
        /* ignore missing file */
      }
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
 * Soften percent-encoded path segments (sync helpers / tests).
 * Prefer {@link ensurePlayableLocalUri} before handing a URI to Android RNTP.
 */
export function toPlayableLocalUri(uri: string): string {
  const trimmed = uri.trim()
  if (!trimmed.startsWith("file:")) return trimmed
  if (Platform.OS !== "android") return trimmed
  try {
    const playable = /%[0-9A-Fa-f]{2}/.test(trimmed) ? decodeURIComponent(trimmed) : trimmed
    if (playable.startsWith("file:///")) return playable
    if (playable.startsWith("file://")) return playable.replace(/^file:\/\//, "file:///")
    if (playable.startsWith("file:/")) return playable.replace(/^file:\//, "file:///")
    return playable
  } catch {
    return trimmed
  }
}

/**
 * Android: copy the saved file to a plain cache path for RNTP/ExoPlayer.
 * Index / FileSystem keep the stored document URI (incl. legacy member%3A folders).
 */
async function androidPlayerUri(fileUri: string): Promise<string> {
  const playable = toPlayableLocalUri(fileUri)
  try {
    const getContentUri = (
      FileSystem as { getContentUriAsync?: (uri: string) => Promise<string> }
    ).getContentUriAsync
    if (typeof getContentUri === "function") {
      const content = await getContentUri(playable)
      if (content?.trim()) return content.trim()
    }
  } catch {
    /* fall through to file:// */
  }
  return playable
}

export async function ensurePlayableLocalUri(uri: string): Promise<string> {
  const trimmed = uri.trim()
  if (!trimmed.startsWith("file:")) return trimmed
  if (Platform.OS !== "android") return trimmed

  const cacheBase = FileSystem.cacheDirectory
  if (!cacheBase) return androidPlayerUri(trimmed)

  const source =
    ((await fileExists(trimmed)) && trimmed) ||
    ((await fileExists(toPlayableLocalUri(trimmed))) && toPlayableLocalUri(trimmed)) ||
    ((await fileExists(normalizeLocalUriKey(trimmed))) && normalizeLocalUriKey(trimmed)) ||
    null
  if (!source) return androidPlayerUri(trimmed)

  const dest = `${cacheBase}offline-play/${urlHash(trimmed)}.mp3`
  const sourceSize = await fileSizeBytes(source)
  try {
    const destSize = await fileSizeBytes(dest)
    if (destSize > 0 && sourceSize > 0 && destSize === sourceSize) {
      return androidPlayerUri(dest)
    }
  } catch {
    /* recreate below */
  }

  try {
    await FileSystem.makeDirectoryAsync(`${cacheBase}offline-play/`, { intermediates: true })
    try {
      await FileSystem.deleteAsync(dest, { idempotent: true })
    } catch {
      /* ignore */
    }
    await FileSystem.copyAsync({ from: source, to: dest })
    if (await fileReady(dest)) return androidPlayerUri(dest)
  } catch {
    /* fall through */
  }
  return androidPlayerUri(source)
}

async function existingLocalUri(storedUri: string): Promise<string | null> {
  const trimmed = storedUri.trim()
  if (!trimmed.startsWith("file:")) return null
  const candidates = Array.from(
    new Set(
      [trimmed, toPlayableLocalUri(trimmed), normalizeLocalUriKey(trimmed)].filter(Boolean),
    ),
  )
  for (const uri of candidates) {
    if (await fileExists(uri)) return uri
  }
  return null
}

async function offlineFileForSong(songNumber: number) {
  const files = useOfflineAudioStore.getState().files
  const seen = new Set<string>()
  for (const entry of Object.values(files)) {
    if (entry.songNumber !== songNumber) continue
    if (seen.has(entry.fileUri)) continue
    seen.add(entry.fileUri)
    const uri = await existingLocalUri(entry.fileUri)
    if (uri) return uri
  }
  // Recover when the index URI is stale but `{songNumber}-*.mp3` still exists.
  try {
    const dir = offlineDir(offlineAudioScopeKey(currentAuth()))
    const names = await FileSystem.readDirectoryAsync(dir)
    const match = names.find(
      (name) => name.startsWith(`${songNumber}-`) && /\.mp3$/i.test(name),
    )
    if (!match) return null
    const recovered = `${dir}${match}`
    if (await fileExists(recovered)) return recovered
  } catch {
    /* directory missing / not signed in */
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
    if (entry) {
      const uri = await existingLocalUri(entry.fileUri)
      if (uri) return { uri, local: true }
    }
    const offlineEntries = Object.values(files).filter((file) => file.songNumber === songNumber)
    const byNumber = await offlineFileForSong(songNumber)
    const askedAnotherRecording =
      Boolean(remoteHttp) &&
      offlineEntries.length > 0 &&
      !offlineEntries.some(
        (file) =>
          urlsReferToSameRecording(file.remoteUrl, remoteHttp) ||
          urlsReferToSameRecording(file.remoteUrl, legacyHttp) ||
          urlsReferToSameRecording(file.remoteUrl, remoteUrl),
      )
    // Explore/search often pass a different https than the saved recording.
    // Prefer any local copy first; only stream an unsaved alternate when reachable.
    if (byNumber) {
      if (askedAnotherRecording && remoteHttp && (await remoteStreamReachable(remoteHttp))) {
        return { uri: remoteHttp, local: false }
      }
      return { uri: byNumber, local: true }
    }
    if (offlineEntries.length > 0) {
      const nextFiles = { ...files }
      let removed = false
      for (const stale of offlineEntries) {
        if (await existingLocalUri(stale.fileUri)) continue
        for (const [key, value] of Object.entries(nextFiles)) {
          if (value.fileUri === stale.fileUri) {
            delete nextFiles[key]
            removed = true
          }
        }
      }
      if (removed) {
        useOfflineAudioStore.setState({ files: nextFiles })
        void persistCurrent(offlineAudioScopeKey(currentAuth()))
      }
    }
  }
  if (remoteHttp) return { uri: remoteHttp, local: false }
  if (signedIn) {
    const byNumber = await offlineFileForSong(songNumber)
    if (byNumber) return { uri: byNumber, local: true }
  }
  return null
}
