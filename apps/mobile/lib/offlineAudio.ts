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
}

type OfflineAudioState = {
  ready: boolean
  files: Record<number, OfflineAudioEntry>
  progress: Record<number, number>
  errors: Record<number, string>
  hydrate: () => Promise<void>
  download: (songNumber: number, remoteUrl?: string | null, options?: { userInitiated?: boolean }) => Promise<void>
  remove: (songNumber: number) => Promise<void>
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
  return `ps.offline.audio.v1.${scope}`
}

function parseIndex(raw: string | null): Record<number, OfflineAudioEntry> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, OfflineAudioEntry>
    const files: Record<number, OfflineAudioEntry> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const number = Number(key)
      if (!Number.isFinite(number) || !value?.fileUri || !value.remoteUrl) continue
      files[number] = value
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

function destinationUri(scope: string, songNumber: number) {
  return `${offlineDir(scope)}${songNumber}.mp3`
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

const lastProgressAt: Record<number, number> = {}
const downloadEpoch: Record<number, number> = {}
const inflight = new Map<number, { cancelAsync: () => Promise<void> }>()

function bumpEpoch(songNumber: number) {
  downloadEpoch[songNumber] = (downloadEpoch[songNumber] ?? 0) + 1
  return downloadEpoch[songNumber]
}

function setDownloadProgress(songNumber: number, ratio: number) {
  const now = Date.now()
  if (ratio < 1 && now - (lastProgressAt[songNumber] ?? 0) < 250) return
  lastProgressAt[songNumber] = now
  useOfflineAudioStore.setState((state) => ({
    progress: { ...state.progress, [songNumber]: Math.min(1, Math.max(0, ratio)) },
  }))
}

function clearSongProgress(songNumber: number) {
  const progress = { ...useOfflineAudioStore.getState().progress }
  delete progress[songNumber]
  delete lastProgressAt[songNumber]
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
    const files: Record<number, OfflineAudioEntry> = {}
    await Promise.all(
      Object.entries(stored).map(async ([key, entry]) => {
        if (await fileExists(entry.fileUri)) {
          files[Number(key)] = entry
        }
      }),
    )
    set({ ready: true, files, errors: {}, progress: {} })
    await persistCurrent(scope)
  },

  download: async (songNumber, remoteUrl, options) => {
    if (!options?.userInitiated) return
    const auth = currentAuth()
    if (auth.mode !== "signed_in") {
      throw new Error("Sign in to download songs for offline listening.")
    }
    if (get().progress[songNumber] != null) return

    const scope = offlineAudioScopeKey(auth)
    const epoch = bumpEpoch(songNumber)
    set((state) => ({
      progress: { ...state.progress, [songNumber]: 0 },
      errors: { ...state.errors, [songNumber]: "" },
    }))

    try {
      let url = remoteUrl?.trim() || ""
      if (!url) {
        const detail = await api.fetchSong(songNumber)
        url = detail ? songDetailToMockSong(detail).audioUrl?.trim() || "" : ""
      }
      if (downloadEpoch[songNumber] !== epoch) return
      if (!url) {
        throw new Error("No in-app audio is available to download for this song yet.")
      }
      if (!/^https?:\/\//i.test(url)) {
        throw new Error("This recording cannot be saved in the app.")
      }

      const existing = get().files[songNumber]
      if (existing?.remoteUrl === url && (await fileExists(existing.fileUri))) {
        if (downloadEpoch[songNumber] !== epoch) return
        clearSongProgress(songNumber)
        return
      }

      await FileSystem.makeDirectoryAsync(offlineDir(scope), { intermediates: true })
      const fileUri = destinationUri(scope, songNumber)
      const sessionType = FileSystem.FileSystemSessionType?.BACKGROUND
      const task = FileSystem.createDownloadResumable(
        url,
        fileUri,
        sessionType != null ? { sessionType } : {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          const ratio =
            totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0
          setDownloadProgress(songNumber, ratio)
        },
      )
      inflight.set(songNumber, task)
      const result = await task.downloadAsync()
      inflight.delete(songNumber)
      if (downloadEpoch[songNumber] !== epoch) {
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
          [songNumber]: { remoteUrl: url, fileUri: result.uri || fileUri },
        },
      }))
      clearSongProgress(songNumber)
      await persistCurrent(scope)
    } catch (error) {
      inflight.delete(songNumber)
      if (downloadEpoch[songNumber] !== epoch) return
      clearSongProgress(songNumber)
      const message = error instanceof Error ? error.message : "Download failed."
      set((state) => ({
        errors: { ...state.errors, [songNumber]: message },
      }))
      throw error
    }
  },

  remove: async (songNumber) => {
    bumpEpoch(songNumber)
    const task = inflight.get(songNumber)
    inflight.delete(songNumber)
    if (task) {
      try {
        await task.cancelAsync()
      } catch {
        /* ignore */
      }
    }
    const entry = get().files[songNumber]
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
      delete files[songNumber]
      const progress = { ...state.progress }
      delete progress[songNumber]
      const errors = { ...state.errors }
      delete errors[songNumber]
      return { files, progress, errors }
    })
    delete lastProgressAt[songNumber]
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
  if (signedIn) {
    const entry = useOfflineAudioStore.getState().files[songNumber]
    if (entry && (await fileExists(entry.fileUri))) {
      return { uri: entry.fileUri, local: true }
    }
  }
  const remote = remoteUrl?.trim()
  if (remote) return { uri: remote, local: false }
  return null
}
