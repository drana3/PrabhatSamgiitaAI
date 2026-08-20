import { beforeEach, describe, expect, it, vi } from "vitest"

const store = new Map<string, string>()

const fs = vi.hoisted(() => ({
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(async () => undefined),
  deleteAsync: vi.fn(async () => undefined),
  createDownloadResumable: vi.fn(),
}))

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(async () => {
      store.clear()
    }),
  },
}))

vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
  FileSystemSessionType: { BACKGROUND: 0, FOREGROUND: 1 },
  getInfoAsync: fs.getInfoAsync,
  makeDirectoryAsync: fs.makeDirectoryAsync,
  deleteAsync: fs.deleteAsync,
  createDownloadResumable: fs.createDownloadResumable,
}))

vi.mock("@/lib/client", () => ({
  api: {
    fetchSong: vi.fn(async () => null),
  },
}))

vi.mock("@/lib/songMap", () => ({
  songDetailToMockSong: vi.fn(() => ({ audioUrl: null })),
}))

const authState = {
  mode: "signed_in" as "guest" | "signed_in",
  memberId: "oid-a" as string | null,
  identityProvider: "aad" as string | null,
  email: "a@example.com" as string | null,
}

vi.mock("@/stores/authStore", () => ({
  useAuthStore: {
    getState: () => authState,
    subscribe: vi.fn(() => () => undefined),
  },
}))

import {
  offlineAudioScopeKey,
  offlineSaveControls,
  resolvePlaybackUri,
  useOfflineAudioStore,
} from "@/lib/offlineAudio"

const memberA = { mode: "signed_in" as const, memberId: "oid-a", identityProvider: "aad", email: "a@example.com" }
const memberB = { mode: "signed_in" as const, memberId: "oid-b", identityProvider: "aad", email: "b@example.com" }

function applyAuth(next: typeof memberA | typeof memberB | { mode: "guest" }) {
  if (next.mode === "guest") {
    authState.mode = "guest"
    authState.memberId = null
    authState.identityProvider = null
    authState.email = null
    return
  }
  authState.mode = "signed_in"
  authState.memberId = next.memberId
  authState.identityProvider = next.identityProvider
  authState.email = next.email
}

function fileUriFor(auth: typeof memberA, songNumber: number) {
  const scope = encodeURIComponent(offlineAudioScopeKey(auth))
  return `file:///docs/offline-audio/${scope}/${songNumber}.mp3`
}

function mockSuccessfulDownload() {
  fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false })
  fs.createDownloadResumable.mockImplementation(
    (
      _url: string,
      dest: string,
      _opts: unknown,
      callback?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
    ) => ({
      downloadAsync: async () => {
        callback?.({ totalBytesWritten: 8, totalBytesExpectedToWrite: 8 })
        return { status: 200, uri: dest }
      },
      cancelAsync: vi.fn(async () => undefined),
    }),
  )
}

describe("offline save UI", () => {
  it("hides save controls for anyone who is not signed in", () => {
    expect(
      offlineSaveControls({ mode: "guest", downloaded: true, progress: 0.4, error: "failed" }),
    ).toEqual({
      visible: false,
      badge: false,
      showError: false,
      label: "",
      bufferingLabel: "Starting stream…",
    })
  })

  it("shows save, progress, and remove only for signed-in members", () => {
    expect(offlineSaveControls({ mode: "signed_in", downloaded: false }).visible).toBe(true)
    expect(offlineSaveControls({ mode: "signed_in", downloaded: false }).label).toBe("Save in this app")
    expect(offlineSaveControls({ mode: "signed_in", downloaded: false, progress: 0.4 }).label).toBe(
      "Downloading 40%",
    )
    expect(offlineSaveControls({ mode: "signed_in", downloaded: true }).label).toBe("Remove from this app")
    expect(offlineSaveControls({ mode: "signed_in", downloaded: true }).badge).toBe(true)
  })
})

describe("offline audio", () => {
  beforeEach(async () => {
    store.clear()
    applyAuth(memberA)
    fs.getInfoAsync.mockReset()
    fs.createDownloadResumable.mockReset()
    fs.deleteAsync.mockReset()
    fs.deleteAsync.mockResolvedValue(undefined)
    useOfflineAudioStore.setState({
      ready: false,
      files: {},
      progress: {},
      errors: {},
    })
  })

  it("refuses download for guests", async () => {
    applyAuth({ mode: "guest" })
    await expect(
      useOfflineAudioStore.getState().download(1, "https://cdn.test/1.mp3", { userInitiated: true }),
    ).rejects.toThrow(/Sign in/)
  })

  it("does not save audio unless the user starts the download", async () => {
    await useOfflineAudioStore.getState().download(12, "https://cdn.test/12.mp3")
    expect(fs.createDownloadResumable).not.toHaveBeenCalled()
    expect(useOfflineAudioStore.getState().files[12]).toBeUndefined()
  })

  it("does not use a saved file while signed out", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false })
    useOfflineAudioStore.setState({
      files: { 12: { remoteUrl: "https://cdn.test/12.mp3", fileUri: fileUriFor(memberA, 12) } },
    })
    applyAuth({ mode: "guest" })
    const source = await resolvePlaybackUri(12, "https://cdn.test/12.mp3")
    expect(source).toEqual({ uri: "https://cdn.test/12.mp3", local: false })
  })

  it("stores a local file and prefers it for playback", async () => {
    mockSuccessfulDownload()
    await useOfflineAudioStore.getState().download(12, "https://cdn.test/12.mp3", { userInitiated: true })
    expect(useOfflineAudioStore.getState().files[12]?.fileUri).toBe(fileUriFor(memberA, 12))

    const source = await resolvePlaybackUri(12, "https://cdn.test/12.mp3")
    expect(source).toEqual({ uri: fileUriFor(memberA, 12), local: true })
  })

  it("streams an alternate recording instead of a saved different file", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false })
    useOfflineAudioStore.setState({
      files: { 12: { remoteUrl: "https://cdn.test/12.mp3", fileUri: fileUriFor(memberA, 12) } },
    })
    const source = await resolvePlaybackUri(12, "https://cdn.test/12-alt.mp3")
    expect(source).toEqual({ uri: "https://cdn.test/12-alt.mp3", local: false })
  })

  it("falls back to the remote stream when nothing is downloaded", async () => {
    const source = await resolvePlaybackUri(3, "https://cdn.test/3.mp3")
    expect(source).toEqual({ uri: "https://cdn.test/3.mp3", local: false })
  })

  it("lets other playback keep working while a download is in flight", async () => {
    let finish: ((value: { status: number; uri: string }) => void) | undefined
    fs.createDownloadResumable.mockImplementation((_url: string, dest: string) => ({
      downloadAsync: () =>
        new Promise((resolve) => {
          finish = resolve
        }).then(() => ({ status: 200, uri: dest })),
      cancelAsync: vi.fn(async () => undefined),
    }))

    const pending = useOfflineAudioStore.getState().download(12, "https://cdn.test/12.mp3", {
      userInitiated: true,
    })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[12]).toBe(0))

    const other = await resolvePlaybackUri(3, "https://cdn.test/3.mp3")
    expect(other).toEqual({ uri: "https://cdn.test/3.mp3", local: false })
    expect(useOfflineAudioStore.getState().files[12]).toBeUndefined()

    finish?.({ status: 200, uri: fileUriFor(memberA, 12) })
    await pending
    expect(useOfflineAudioStore.getState().files[12]?.fileUri).toBe(fileUriFor(memberA, 12))
  })

  it("does not restore a file after remove during an in-flight download", async () => {
    let finish: ((value: { status: number; uri: string }) => void) | undefined
    const cancelAsync = vi.fn(async () => undefined)
    fs.createDownloadResumable.mockImplementation((_url: string, dest: string) => ({
      downloadAsync: () =>
        new Promise((resolve) => {
          finish = resolve
        }).then(() => ({ status: 200, uri: dest })),
      cancelAsync,
    }))

    const pending = useOfflineAudioStore.getState().download(12, "https://cdn.test/12.mp3", {
      userInitiated: true,
    })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[12]).toBe(0))
    await useOfflineAudioStore.getState().remove(12)
    expect(cancelAsync).toHaveBeenCalled()

    finish?.({ status: 200, uri: fileUriFor(memberA, 12) })
    await pending
    expect(useOfflineAudioStore.getState().files[12]).toBeUndefined()
    expect(fs.deleteAsync).toHaveBeenCalled()
  })

  it("keeps saved audio isolated per member", async () => {
    mockSuccessfulDownload()
    await useOfflineAudioStore.getState().download(12, "https://cdn.test/12.mp3", { userInitiated: true })
    expect(useOfflineAudioStore.getState().files[12]?.fileUri).toBe(fileUriFor(memberA, 12))

    applyAuth(memberB)
    await useOfflineAudioStore.getState().hydrate()
    expect(useOfflineAudioStore.getState().files[12]).toBeUndefined()
    expect(await resolvePlaybackUri(12, "https://cdn.test/12.mp3")).toEqual({
      uri: "https://cdn.test/12.mp3",
      local: false,
    })

    applyAuth(memberA)
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false })
    await useOfflineAudioStore.getState().hydrate()
    expect(useOfflineAudioStore.getState().files[12]?.fileUri).toBe(fileUriFor(memberA, 12))
    expect(await resolvePlaybackUri(12, "https://cdn.test/12.mp3")).toEqual({
      uri: fileUriFor(memberA, 12),
      local: true,
    })
  })

  it("keeps both songs when two saves finish close together", async () => {
    let finish12: (() => void) | undefined
    let finish7: (() => void) | undefined
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false })
    fs.createDownloadResumable.mockImplementation((_url: string, dest: string) => ({
      downloadAsync: () =>
        new Promise<void>((resolve) => {
          if (dest.endsWith("/12.mp3")) finish12 = resolve
          else finish7 = resolve
        }).then(() => ({ status: 200, uri: dest })),
      cancelAsync: vi.fn(async () => undefined),
    }))

    const first = useOfflineAudioStore.getState().download(12, "https://cdn.test/12.mp3", {
      userInitiated: true,
    })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[12]).toBe(0))
    const second = useOfflineAudioStore.getState().download(7, "https://cdn.test/7.mp3", {
      userInitiated: true,
    })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[7]).toBe(0))
    finish12?.()
    finish7?.()
    await Promise.all([first, second])
    expect(useOfflineAudioStore.getState().files[12]?.fileUri).toBe(fileUriFor(memberA, 12))
    expect(useOfflineAudioStore.getState().files[7]?.fileUri).toBe(fileUriFor(memberA, 7))
  })
})
