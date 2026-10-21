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
  const downloading = input.downloading ?? (input.progress != null && !input.downloaded)
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
    bufferingLabel: input.downloaded ? "Opening saved audio…" : "Starting stream…",
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
const FINALIZE_POLL_MS = 400

/** Canonical offline key — use for every files/progress lookup in UI and store. */
export function normalizeOfflineUrl(url: string | null | undefined) {
  return normalizeUrl(url)
}

export function isOfflineTransferActive(url: string | null | undefined) {
  const key = normalizeOfflineUrl(url)
  if (!key) return false
  return inflight.has(key) || pendingMeta.has(key)
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
  },
  options?: { songNumber?: number },
) {
  const keys = offlineIndexKeys(url)
  const raw = normalizeOfflineUrl(url)
  let entry = findOfflineEntry(snapshot.files, url)
  if (!entry && raw.startsWith("file:")) {
    entry = findEntryByLocalUri(snapshot.files, raw)
  }
  // Only fall back by song number when we don't have a distinct remote URL
  // (keeps multi-recording rows from claiming each other's saves).
  if (!entry && options?.songNumber && (!raw || raw.startsWith("file:"))) {
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
  const key = entry?.remoteUrl || keys[0] || raw
  const downloaded = Boolean(entry)
  const progress =
    keys.map((k) => snapshot.progress[k]).find((value) => value != null) ??
    (key ? snapshot.progress[key] : undefined)
  const error =
    keys.map((k) => snapshot.errors[k]).find((value) => Boolean(value)) ??
    (key ? snapshot.errors[key] : undefined)
  const active = keys.some((k) => isOfflineTransferActive(k)) || (key ? isOfflineTransferActive(key) : false)
  const downloading = Boolean(key && !downloaded && active)
  return {
    key: entry?.remoteUrl || key,
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

function offlineDir(scope: string) {
  const base = FileSystem.documentDirectory
  if (!base) throw new Error("Offline storage is not available on this device.")
  return `${base}offline-audio/${encodeURIComponent(scope)}/`
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

async function waitForFileReady(fileUri: string, url: string, epoch: number, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (downloadEpoch[url] !== epoch) return null
    if (await fileReady(fileUri)) {
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
  if (clamped < FINALIZING_RATIO && now - (lastProgressAt[url] ?? 0) < 250) return
  lastProgressAt[url] = now
  useOfflineAudioStore.setState((state) => ({
    progress: { ...state.progress, [url]: clamped },
  }))
  if (clamped >= FINALIZING_RATIO) {
    void attemptEarlyComplete(url)
  }
}

async function attemptEarlyComplete(url: string) {
  const meta = pendingMeta.get(url)
  if (!meta || downloadEpoch[url] !== meta.epoch) return
  if (!(await fileReady(meta.fileUri, true))) return
  if (downloadEpoch[url] !== meta.epoch) return
  useOfflineAudioStore.setState((state) => ({
    files: {
      ...state.files,
      [url]: { remoteUrl: url, fileUri: meta.fileUri, songNumber: meta.songNumber },
    },
  }))
  clearProgress(url)
  pendingMeta.delete(url)
  inflight.delete(url)
  await persistCurrent(meta.scope)
}

function clearProgress(url: string) {
  const progress = { ...useOfflineAudioStore.getState().progress }
  delete progress[url]
  delete lastProgressAt[url]
  useOfflineAudioStore.setState({ progress })
}

export const useOfflineAudioStore = create<OfflineAudioState>((set, get) => ({
  ready: false,
  files: {},
  progress: {},
  errors: {},

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
    set({ ready: true, files, errors: {}, progress: {} })
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

    let url = canonicalAudioUrl(remoteUrl)
    if (!url) {
      const detail = await api.fetchSong(songNumber)
      url = detail ? canonicalAudioUrl(songDetailToMockSong(detail).audioUrl) : ""
    }
    if (!url) {
      throw new Error("No in-app audio is available to download for this song yet.")
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("This recording cannot be saved in the app.")
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
      const task = FileSystem.createDownloadResumable(
        url,
        fileUri,
        sessionType != null ? { sessionType } : {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
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
      }))
      let result = await Promise.race([
        task.downloadAsync().catch(() => null),
        waitForFileReady(fileUri, url, epoch),
      ])
      if (!result) {
        result = await waitForFileReady(fileUri, url, epoch, 15_000)
      }
      inflight.delete(url)
      if (downloadEpoch[url] !== epoch) {
        try {
          await FileSystem.deleteAsync(fileUri, { idempotent: true })
        } catch {
          /* ignore */
        }
        return
      }
      if (!result || result.status >= 400) {
        throw new Error("Save failed. Try again on a stronger connection.")
      }
      set((state) => ({
        files: {
          ...state.files,
          [url]: { remoteUrl: url, fileUri: result.uri || fileUri, songNumber },
        },
      }))
      clearProgress(url)
      pendingMeta.delete(url)
      await persistCurrent(scope)
    } catch (error) {
      inflight.delete(url)
      pendingMeta.delete(url)
      if (downloadEpoch[url] !== epoch) return
      clearProgress(url)
      const message = error instanceof Error ? error.message : "Save failed."
      set((state) => ({
        errors: { ...state.errors, [url]: message },
      }))
      throw error
    } finally {
      pendingMeta.delete(url)
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
