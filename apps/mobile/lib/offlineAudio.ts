import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system/legacy"
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

function canonicalAudioUrl(url: string | null | undefined): string {
  const trimmed = normalizeUrl(url)
  return trimmed ? unwrapArchiveAudioUrl(trimmed) : ""
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

export function offlineRecordingState(
  url: string | null | undefined,
  snapshot: {
    files: Record<string, OfflineAudioEntry>
    progress: Record<string, number>
    errors: Record<string, string>
  },
) {
  const key = normalizeOfflineUrl(url)
  const downloaded = Boolean(key && snapshot.files[key])
  const progress = key ? snapshot.progress[key] : undefined
  const error = key ? snapshot.errors[key] : undefined
  const active = key ? isOfflineTransferActive(key) : false
  const downloading = Boolean(key && !downloaded && active)
  return { key, downloaded, downloading, progress, error, fileUri: key ? snapshot.files[key]?.fileUri : undefined }
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
    const url = normalizeUrl(remoteUrl)
    if (!url) return
    bumpEpoch(url)
    pendingMeta.delete(url)
    const task = inflight.get(url)
    inflight.delete(url)
    if (task) {
      try {
        await task.cancelAsync()
      } catch {
        /* ignore */
      }
    }
    const entry = get().files[url]
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
      delete files[url]
      const progress = { ...state.progress }
      delete progress[url]
      const errors = { ...state.errors }
      delete errors[url]
      return { files, progress, errors }
    })
    delete lastProgressAt[url]
    await persistCurrent(scope)
  },
}))

export async function hydrateOfflineAudio() {
  await useOfflineAudioStore.getState().hydrate()
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

export async function resolvePlaybackUri(
  songNumber: number,
  remoteUrl?: string | null,
): Promise<{ uri: string; local: boolean } | null> {
  const signedIn = useAuthStore.getState().mode === "signed_in"
  const remote = canonicalAudioUrl(remoteUrl)
  const legacyKey = normalizeUrl(remoteUrl)
  if (signedIn && (remote || legacyKey)) {
    const files = useOfflineAudioStore.getState().files
    const entry = (remote && files[remote]) || (legacyKey && files[legacyKey])
    if (entry && (await fileExists(entry.fileUri))) {
      return { uri: entry.fileUri, local: true }
    }
  }
  if (remote) return { uri: remote, local: false }
  return null
}
