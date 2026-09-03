import AsyncStorage from "@react-native-async-storage/async-storage"
import * as FileSystem from "expo-file-system/legacy"
import { create } from "zustand"

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

export function offlineSaveControls(input: {
  mode: "guest" | "signed_in"
  downloaded: boolean
  progress?: number
  error?: string | null
}) {
  if (input.mode !== "signed_in") {
    return {
      visible: false,
      badge: false,
      showError: false,
      label: "",
      bufferingLabel: "Starting stream…",
    }
  }
  const downloading = input.progress != null
  return {
    visible: true,
    badge: input.downloaded && !downloading,
    showError: Boolean(input.error),
    label: downloading
      ? `Downloading ${Math.round((input.progress ?? 0) * 100)}%`
      : input.downloaded
        ? "Remove from this app"
        : "Save in this app",
    bufferingLabel: input.downloaded ? "Opening downloaded audio…" : "Starting stream…",
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

const lastProgressAt: Record<string, number> = {}
const downloadEpoch: Record<string, number> = {}
const inflight = new Map<string, { cancelAsync: () => Promise<void> }>()

function bumpEpoch(url: string) {
  downloadEpoch[url] = (downloadEpoch[url] ?? 0) + 1
  return downloadEpoch[url]
}

function setDownloadProgress(url: string, ratio: number) {
  const now = Date.now()
  if (ratio < 1 && now - (lastProgressAt[url] ?? 0) < 250) return
  lastProgressAt[url] = now
  useOfflineAudioStore.setState((state) => ({
    progress: { ...state.progress, [url]: Math.min(1, Math.max(0, ratio)) },
  }))
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
  },

  download: async (remoteUrl, songNumber, options) => {
    if (!options?.userInitiated) return
    const auth = currentAuth()
    if (auth.mode !== "signed_in") {
      throw new Error("Sign in to download songs for offline listening.")
    }

    const scope = offlineAudioScopeKey(auth)

    let url = normalizeUrl(remoteUrl)
    if (!url) {
      const detail = await api.fetchSong(songNumber)
      url = detail ? normalizeUrl(songDetailToMockSong(detail).audioUrl) : ""
    }
    if (!url) {
      throw new Error("No in-app audio is available to download for this song yet.")
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("This recording cannot be saved in the app.")
    }
    if (get().progress[url] != null) return

    const epoch = bumpEpoch(url)
    set((state) => ({
      progress: { ...state.progress, [url]: 0 },
      errors: { ...state.errors, [url]: "" },
    }))

    try {
      const existing = get().files[url]
      if (existing && (await fileExists(existing.fileUri))) {
        if (downloadEpoch[url] !== epoch) return
        clearProgress(url)
        return
      }

      await FileSystem.makeDirectoryAsync(offlineDir(scope), { intermediates: true })
      const fileUri = destinationUri(scope, songNumber, url)
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
      const result = await task.downloadAsync()
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
        throw new Error("Download failed. Try again on a stronger connection.")
      }
      set((state) => ({
        files: {
          ...state.files,
          [url]: { remoteUrl: url, fileUri: result.uri || fileUri, songNumber },
        },
      }))
      clearProgress(url)
      await persistCurrent(scope)
    } catch (error) {
      inflight.delete(url)
      if (downloadEpoch[url] !== epoch) return
      clearProgress(url)
      const message = error instanceof Error ? error.message : "Download failed."
      set((state) => ({
        errors: { ...state.errors, [url]: message },
      }))
      throw error
    }
  },

  remove: async (remoteUrl) => {
    const url = normalizeUrl(remoteUrl)
    if (!url) return
    bumpEpoch(url)
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
  const remote = normalizeUrl(remoteUrl)
  if (signedIn && remote) {
    const entry = useOfflineAudioStore.getState().files[remote]
    if (entry && (await fileExists(entry.fileUri))) {
      return { uri: entry.fileUri, local: true }
    }
  }
  if (remote) return { uri: remote, local: false }
  return null
}
