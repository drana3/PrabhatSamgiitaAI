import { beforeEach, describe, expect, it, vi } from "vitest"
import { Platform } from "react-native"

const store = new Map<string, string>()

const fs = vi.hoisted(() => ({
  getInfoAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(async () => undefined),
  deleteAsync: vi.fn(async () => undefined),
  copyAsync: vi.fn(async () => undefined),
  readDirectoryAsync: vi.fn(async () => [] as string[]),
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
  cacheDirectory: "file:///cache/",
  FileSystemSessionType: { BACKGROUND: 0, FOREGROUND: 1 },
  getInfoAsync: fs.getInfoAsync,
  makeDirectoryAsync: fs.makeDirectoryAsync,
  deleteAsync: fs.deleteAsync,
  copyAsync: fs.copyAsync,
  readDirectoryAsync: fs.readDirectoryAsync,
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
  ensurePlayableLocalUri,
  offlineAudioScopeKey,
  offlineRecordingState,
  offlineSaveControls,
  reconcileOfflineProgress,
  mergeAudioRecordings,
  resolvePlaybackUri,
  toPlayableLocalUri,
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

function urlHash(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash << 5) - hash + url.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function fileUriFor(auth: typeof memberA, songNumber: number, url: string) {
  const scope = offlineAudioScopeKey(auth).replace(/[^a-zA-Z0-9._-]+/g, "_")
  return `file:///docs/offline-audio/${scope}/${songNumber}-${urlHash(url)}.mp3`
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
  beforeEach(() => {
    applyAuth(memberA)
    useOfflineAudioStore.setState({
      ready: true,
      files: {},
      progress: {},
      errors: {},
      activeBySong: {},
    })
  })

  it("hides save controls for anyone who is not signed in", () => {
    expect(
      offlineSaveControls({ mode: "guest", downloaded: true, progress: 0.4, error: "failed" }),
    ).toEqual({
      visible: false,
      badge: false,
      showError: false,
      downloading: false,
      label: "",
      bufferingLabel: "Starting stream…",
    })
  })

  it("shows save, progress, finalizing, and remove only for signed-in members", () => {
    expect(offlineSaveControls({ mode: "signed_in", downloaded: false }).visible).toBe(true)
    expect(offlineSaveControls({ mode: "signed_in", downloaded: false }).label).toBe("Save in this app")
    expect(offlineSaveControls({ mode: "signed_in", downloaded: false, progress: 0.4 }).label).toBe(
      "Saving… 40%",
    )
    expect(offlineSaveControls({ mode: "signed_in", downloaded: false, progress: 0.995 }).label).toBe(
      "Saving offline…",
    )
    expect(offlineSaveControls({ mode: "signed_in", downloaded: true }).label).toBe("Remove from this app")
    expect(offlineSaveControls({ mode: "signed_in", downloaded: true }).badge).toBe(true)
    expect(
      offlineSaveControls({ mode: "signed_in", downloaded: true, progress: 0.995 }).downloading,
    ).toBe(false)
    expect(
      offlineSaveControls({
        mode: "signed_in",
        downloaded: true,
        progress: 0.995,
        downloading: false,
      }).downloading,
    ).toBe(false)
  })

  it("tracks each recording independently for multi-recording songs", () => {
    const primary = "https://cdn.test/12.mp3"
    const alt = "https://cdn.test/12-alt.mp3"
    const third = "https://cdn.test/12-third.mp3"
    useOfflineAudioStore.setState({
      files: {
        [alt]: {
          remoteUrl: alt,
          fileUri: fileUriFor(memberA, 12, alt),
          songNumber: 12,
        },
      },
      progress: {
        [primary]: 0.5,
        [third]: 1,
      },
    })
    const snapshot = useOfflineAudioStore.getState()
    // Orphan progress (no active transfer) still surfaces as downloading until sweep.
    expect(offlineRecordingState(primary, snapshot).downloading).toBe(true)
    expect(offlineRecordingState(primary, snapshot).progress).toBe(0.5)
    expect(offlineRecordingState(alt, snapshot).downloaded).toBe(true)
    expect(offlineRecordingState(alt, snapshot).downloading).toBe(false)
    expect(offlineRecordingState(third, snapshot).downloading).toBe(true)
    reconcileOfflineProgress()
    const cleaned = useOfflineAudioStore.getState()
    expect(cleaned.progress[alt]).toBeUndefined()
    expect(cleaned.progress[third]).toBeUndefined()
  })

  it("keeps both saved recordings visible when catalog only returns one", () => {
    const primary =
      "https://prabhatasamgiita.net/1-999/_68%20I%20LOVE%20THIS%20TINY%20GREEN%20ISLAND.mp3"
    const alt =
      "https://prabhatasamgiita.net/1-999/_68%20I%20LOVE%20THIS%20TINY%20GREEN%20ISLAND%202.mp3"
    const files = {
      [primary]: {
        remoteUrl: primary,
        fileUri: fileUriFor(memberA, 68, primary),
        songNumber: 68,
      },
      [alt]: {
        remoteUrl: alt,
        fileUri: fileUriFor(memberA, 68, alt),
        songNumber: 68,
      },
    }
    const merged = mergeAudioRecordings(
      68,
      [{ title: "Island", url: primary, provider: "official" }],
      files,
    )
    expect(merged).toHaveLength(2)
    expect(merged.map((item) => item.url).sort()).toEqual([primary, alt].sort())
  })

  it("does not double catalog recordings when offline aliases exist", () => {
    const a = "https://prabhatasamgiita.net/1-999/a.mp3"
    const b = "https://prabhatasamgiita.net/1-999/b.mp3"
    const c = "https://prabhatasamgiita.net/1-999/c.mp3"
    const files = {
      [a]: { remoteUrl: a, fileUri: fileUriFor(memberA, 10, a), songNumber: 10 },
      [b]: { remoteUrl: b, fileUri: fileUriFor(memberA, 10, b), songNumber: 10 },
      [c]: { remoteUrl: c, fileUri: fileUriFor(memberA, 10, c), songNumber: 10 },
      // Alias keys for the same three files (previously produced 6 rows).
      [`${a}?x=1`]: { remoteUrl: a, fileUri: fileUriFor(memberA, 10, a), songNumber: 10 },
      [`${b}?x=1`]: { remoteUrl: b, fileUri: fileUriFor(memberA, 10, b), songNumber: 10 },
      [`${c}?x=1`]: { remoteUrl: c, fileUri: fileUriFor(memberA, 10, c), songNumber: 10 },
    }
    const merged = mergeAudioRecordings(
      10,
      [
        { title: "A", url: a, provider: "official" },
        { title: "B", url: b, provider: "official" },
        { title: "C", url: c, provider: "official" },
      ],
      files,
    )
    expect(merged).toHaveLength(3)
  })

  it("does not spin sibling recordings when one URL is saving (PS 59)", () => {
    const primary =
      "https://prabhatasamgiita.net/1-999/_59%20NANIIR%20PUTUL%20T%27UT%27UL%20T%27UT%27UL.mp3"
    const alt =
      "https://prabhatasamgiita.net/1-999/_59%20NANIIR%20PUTUL%20T%27UT%27UL%20T%27UT%27UL_I.mp3"
    useOfflineAudioStore.setState({
      files: {},
      progress: { [primary]: 0.42 },
      errors: {},
      activeBySong: { 59: primary },
    })
    const snapshot = useOfflineAudioStore.getState()
    const saving = offlineRecordingState(primary, snapshot, { songNumber: 59 })
    const idle = offlineRecordingState(alt, snapshot, { songNumber: 59 })
    expect(saving.downloading).toBe(true)
    expect(saving.progress).toBe(0.42)
    expect(idle.downloading).toBe(false)
    expect(idle.progress).toBeUndefined()
    expect(idle.downloaded).toBe(false)
  })

  it("keeps both saved recordings available after hydrate (multi-recording)", async () => {
    mockSuccessfulDownload()
    const primary =
      "https://prabhatasamgiita.net/1-999/_59%20A.mp3"
    const alt =
      "https://prabhatasamgiita.net/1-999/_59%20A_I.mp3"
    await useOfflineAudioStore.getState().download(primary, 59, { userInitiated: true })
    await useOfflineAudioStore.getState().download(alt, 59, { userInitiated: true })
    const before = useOfflineAudioStore.getState().files
    expect(before[primary]?.songNumber).toBe(59)
    expect(before[alt]?.songNumber).toBe(59)
    expect(before[primary]?.fileUri).not.toBe(before[alt]?.fileUri)

    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 96_000 })
    await useOfflineAudioStore.getState().hydrate()
    const after = useOfflineAudioStore.getState()
    expect(after.files[primary]?.fileUri).toBeTruthy()
    expect(after.files[alt]?.fileUri).toBeTruthy()
    expect(offlineRecordingState(primary, after, { songNumber: 59 }).downloaded).toBe(true)
    expect(offlineRecordingState(alt, after, { songNumber: 59 }).downloaded).toBe(true)
  })

  it("shows downloaded when playback URI is the local file (cold start offline)", () => {
    const url = "https://cdn.test/12.mp3"
    const dest = fileUriFor(memberA, 12, url)
    const snapshot = {
      files: {
        [url]: { remoteUrl: url, fileUri: dest, songNumber: 12 },
      },
      progress: {},
      errors: {},
    }
    expect(offlineRecordingState(dest, snapshot, { songNumber: 12 }).downloaded).toBe(true)
    expect(offlineRecordingState(dest, snapshot, { songNumber: 12 }).key).toBe(url)
    expect(offlineRecordingState(null, snapshot, { songNumber: 12 }).downloaded).toBe(true)
    // Different remote must not inherit another recording's save.
    expect(
      offlineRecordingState("https://cdn.test/12-alt.mp3", snapshot, { songNumber: 12 }).downloaded,
    ).toBe(false)
  })

  it("matches encoded vs decoded local file URIs after cold start", () => {
    const url = "https://cdn.test/12.mp3"
    const encoded =
      "file:///docs/offline-audio/member%3Aoid-a/12-abc.mp3"
    const decoded = "file:///docs/offline-audio/member:oid-a/12-abc.mp3"
    const snapshot = {
      files: {
        [url]: { remoteUrl: url, fileUri: encoded, songNumber: 12 },
      },
      progress: {},
      errors: {},
    }
    expect(offlineRecordingState(decoded, snapshot, { songNumber: 12 }).downloaded).toBe(true)
    expect(offlineRecordingState(encoded, snapshot, { songNumber: 12 }).key).toBe(url)
  })

  it("does not flash Save while the offline index is still loading", () => {
    const ui = offlineSaveControls({
      mode: "signed_in",
      downloaded: false,
      indexPending: true,
    })
    expect(ui.label).toBe("Checking offline…")
    expect(ui.badge).toBe(false)
    expect(ui.downloading).toBe(true)
  })

  it("shows percent even when downloading flag is false but progress exists", () => {
    expect(
      offlineSaveControls({
        mode: "signed_in",
        downloaded: false,
        downloading: false,
        progress: 0.42,
      }).label,
    ).toBe("Saving… 42%")
  })

  it("binds re-save progress when UI still has a file:// audioUrl", async () => {
    const url = "https://cdn.test/12.mp3"
    const dest = fileUriFor(memberA, 12, url)
    let report: ((progress: {
      totalBytesWritten: number
      totalBytesExpectedToWrite: number
    }) => void) | undefined
    let finish: ((value: { status: number; uri: string }) => void) | undefined
    let fileOnDisk = false
    fs.getInfoAsync.mockImplementation(async () => ({
      exists: fileOnDisk,
      isDirectory: false,
      size: fileOnDisk ? 96_000 : 0,
    }))
    fs.createDownloadResumable.mockImplementation((_u: string, d: string, _o: unknown, cb: typeof report) => {
      report = cb
      return {
        downloadAsync: () =>
          new Promise((resolve) => {
            finish = resolve
          }).then(() => {
            fileOnDisk = true
            return { status: 200, uri: d }
          }),
        cancelAsync: vi.fn(async () => undefined),
      }
    })

    const pending = useOfflineAudioStore.getState().download(url, 12, { userInitiated: true })
    await vi.waitFor(() => {
      const s = useOfflineAudioStore.getState()
      expect(s.activeBySong[12]).toBe(url)
      expect(s.progress[url]).toBe(0)
    })
    report?.({ totalBytesWritten: 40, totalBytesExpectedToWrite: 100 })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[url]).toBe(0.4))

    const snapshot = useOfflineAudioStore.getState()
    expect(snapshot.activeBySong[12]).toBe(url)
    const state = offlineRecordingState(dest, snapshot, { songNumber: 12 })
    expect(state.progress).toBe(0.4)
    expect(state.downloading).toBe(true)
    expect(
      offlineSaveControls({
        mode: "signed_in",
        downloaded: state.downloaded,
        downloading: state.downloading,
        progress: state.progress,
      }).label,
    ).toBe("Saving… 40%")

    finish?.({ status: 200, uri: dest })
    await pending
  })

  it("decodes percent-encoded local paths for Android ExoPlayer", () => {
    const encoded = "file:///docs/offline-audio/member%3Aoid-a/12.mp3"
    const prev = Platform.OS
    ;(Platform as { OS: string }).OS = "android"
    expect(toPlayableLocalUri(encoded)).toBe("file:///docs/offline-audio/member:oid-a/12.mp3")
    ;(Platform as { OS: string }).OS = "ios"
    expect(toPlayableLocalUri(encoded)).toBe(encoded)
    ;(Platform as { OS: string }).OS = prev
  })

  it("copies legacy member%3A files to a safe Android play cache for RNTP", async () => {
    const encoded = "file:///docs/offline-audio/member%3Aoid-a/12-abc.mp3"
    const prev = Platform.OS
    ;(Platform as { OS: string }).OS = "android"
    const sizes = new Map<string, number>([[encoded, 96_000]])
    fs.getInfoAsync.mockImplementation(async (uri: string) => {
      const size = sizes.get(uri) ?? 0
      return { exists: size > 0, isDirectory: false, size }
    })
    fs.copyAsync.mockImplementation(async ({ from, to }: { from: string; to: string }) => {
      expect(from).toBe(encoded)
      sizes.set(to, sizes.get(from) ?? 0)
    })
    const playable = await ensurePlayableLocalUri(encoded)
    expect(playable).toMatch(/^file:\/\/\/cache\/offline-play\/.+\.mp3$/)
    expect(fs.copyAsync).toHaveBeenCalled()
    fs.copyAsync.mockClear()
    await expect(ensurePlayableLocalUri(encoded)).resolves.toBe(playable)
    expect(fs.copyAsync).not.toHaveBeenCalled()
    ;(Platform as { OS: string }).OS = prev
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
      activeBySong: {},
    })
  })

  it("refuses download for guests", async () => {
    applyAuth({ mode: "guest" })
    await expect(
      useOfflineAudioStore.getState().download("https://cdn.test/1.mp3", 1, { userInitiated: true }),
    ).rejects.toThrow(/Sign in/)
  })

  it("does not save audio unless the user starts the download", async () => {
    await useOfflineAudioStore.getState().download("https://cdn.test/12.mp3", 12)
    expect(fs.createDownloadResumable).not.toHaveBeenCalled()
    expect(useOfflineAudioStore.getState().files["https://cdn.test/12.mp3"]).toBeUndefined()
  })

  it("does not use a saved file while signed out", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false })
    useOfflineAudioStore.setState({
      ready: true,
      files: {
        "https://cdn.test/12.mp3": {
          remoteUrl: "https://cdn.test/12.mp3",
          fileUri: fileUriFor(memberA, 12, "https://cdn.test/12.mp3"),
          songNumber: 12,
        },
      },
    })
    applyAuth({ mode: "guest" })
    const source = await resolvePlaybackUri(12, "https://cdn.test/12.mp3")
    expect(source).toEqual({ uri: "https://cdn.test/12.mp3", local: false })
  })

  it("stores a local file and prefers it for playback", async () => {
    mockSuccessfulDownload()
    const url = "https://cdn.test/12.mp3"
    await useOfflineAudioStore.getState().download(url, 12, { userInitiated: true })
    expect(useOfflineAudioStore.getState().files[url]?.fileUri).toBe(fileUriFor(memberA, 12, url))

    const source = await resolvePlaybackUri(12, url)
    expect(source).toEqual({ uri: fileUriFor(memberA, 12, url), local: true })
  })

  it("streams an alternate recording online instead of a saved different file", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 96_000 })
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    useOfflineAudioStore.setState({
      ready: true,
      files: {
        "https://cdn.test/12.mp3": {
          remoteUrl: "https://cdn.test/12.mp3",
          fileUri: fileUriFor(memberA, 12, "https://cdn.test/12.mp3"),
          songNumber: 12,
        },
      },
    })
    const source = await resolvePlaybackUri(12, "https://cdn.test/12-alt.mp3")
    expect(source).toEqual({ uri: "https://cdn.test/12-alt.mp3", local: false })
    expect(fetchMock).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("plays the saved recording offline when search/detail asks for another URL", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 96_000 })
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline")
    }))
    const saved = "https://cdn.test/12.mp3"
    const dest = fileUriFor(memberA, 12, saved)
    useOfflineAudioStore.setState({
      ready: true,
      files: {
        [saved]: { remoteUrl: saved, fileUri: dest, songNumber: 12 },
      },
    })
    const source = await resolvePlaybackUri(12, "https://cdn.test/12-preferred.mp3")
    expect(source).toEqual({ uri: dest, local: true })
    vi.unstubAllGlobals()
  })

  it("matches the same recording across proxy wrap and trailing slash", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 96_000 })
    const direct = "https://prabhatasamgiita.net/1-999/200.mp3"
    const dest = fileUriFor(memberA, 200, direct)
    useOfflineAudioStore.setState({
      ready: true,
      files: {
        [direct]: { remoteUrl: direct, fileUri: dest, songNumber: 200 },
      },
    })
    const proxy =
      "https://api.example/api/v1/media/stream?url=" +
      encodeURIComponent("https://prabhatasamgiita.net/1-999/200.mp3/")
    expect(await resolvePlaybackUri(200, proxy)).toEqual({ uri: dest, local: true })
    expect(await resolvePlaybackUri(200, `${direct}/`)).toEqual({ uri: dest, local: true })
  })

  it("matches PS 4079-style URLs when %27 vs apostrophe encoding differs", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 96_000 })
    fs.readDirectoryAsync.mockResolvedValue([])
    const encoded =
      "https://prabhatasamgiita.net/4000-5018/4079%20A%27NKHIYA%27%20HAMER%20TORE%20LEILI%20KHONJI.mp3"
    const mixed =
      "https://prabhatasamgiita.net/4000-5018/4079%20A'NKHIYA'%20HAMER%20TORE%20LEILI%20KHONJI.mp3"
    const dest = fileUriFor(memberA, 4079, encoded)
    useOfflineAudioStore.setState({
      ready: true,
      files: {
        [encoded]: { remoteUrl: encoded, fileUri: dest, songNumber: 4079 },
      },
    })
    expect(await resolvePlaybackUri(4079, mixed)).toEqual({ uri: dest, local: true })
    expect(await resolvePlaybackUri(4079, encoded)).toEqual({ uri: dest, local: true })
  })

  it("saves each recording of a song independently", async () => {
    mockSuccessfulDownload()
    const primary = "https://cdn.test/12.mp3"
    const alt = "https://cdn.test/12-alt.mp3"
    await useOfflineAudioStore.getState().download(primary, 12, { userInitiated: true })
    await useOfflineAudioStore.getState().download(alt, 12, { userInitiated: true })
    expect(useOfflineAudioStore.getState().files[primary]?.fileUri).toBe(fileUriFor(memberA, 12, primary))
    expect(useOfflineAudioStore.getState().files[alt]?.fileUri).toBe(fileUriFor(memberA, 12, alt))
    expect(fileUriFor(memberA, 12, primary)).not.toBe(fileUriFor(memberA, 12, alt))
  })

  it("falls back to the remote stream when nothing is downloaded", async () => {
    const source = await resolvePlaybackUri(3, "https://cdn.test/3.mp3")
    expect(source).toEqual({ uri: "https://cdn.test/3.mp3", local: false })
  })

  it("plays a saved copy when the song list has no remote audioUrl (offline)", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 96_000 })
    const url = "https://cdn.test/12.mp3"
    const dest = fileUriFor(memberA, 12, url)
    useOfflineAudioStore.setState({
      ready: true,
      files: {
        [url]: { remoteUrl: url, fileUri: dest, songNumber: 12 },
      },
    })
    expect(await resolvePlaybackUri(12, null)).toEqual({ uri: dest, local: true })
    expect(await resolvePlaybackUri(12, undefined)).toEqual({ uri: dest, local: true })
  })

  it("does not keep a deleted file:// URI as a stream target", async () => {
    fs.getInfoAsync.mockResolvedValue({ exists: false, isDirectory: false })
    const dest = fileUriFor(memberA, 12, "https://cdn.test/12.mp3")
    useOfflineAudioStore.setState({ ready: true, files: {} })
    expect(await resolvePlaybackUri(12, dest)).toBeNull()
  })

  it("stops resolving to local after remove", async () => {
    mockSuccessfulDownload()
    const url = "https://cdn.test/12.mp3"
    await useOfflineAudioStore.getState().download(url, 12, { userInitiated: true })
    expect(await resolvePlaybackUri(12, url)).toEqual({
      uri: fileUriFor(memberA, 12, url),
      local: true,
    })
    fs.getInfoAsync.mockResolvedValue({ exists: false, isDirectory: false })
    await useOfflineAudioStore.getState().remove(url)
    expect(useOfflineAudioStore.getState().files[url]).toBeUndefined()
    expect(await resolvePlaybackUri(12, url)).toEqual({ uri: url, local: false })
  })

  it("lets other playback keep working while a download is in flight", async () => {
    let finish: ((value: { status: number; uri: string }) => void) | undefined
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false, size: 96_000 })
    fs.createDownloadResumable.mockImplementation((_url: string, dest: string) => ({
      downloadAsync: () =>
        new Promise((resolve) => {
          finish = resolve
        }).then(() => ({ status: 200, uri: dest })),
      cancelAsync: vi.fn(async () => undefined),
    }))

    const url = "https://cdn.test/12.mp3"
    const pending = useOfflineAudioStore.getState().download(url, 12, {
      userInitiated: true,
    })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[url]).toBe(0))

    const other = await resolvePlaybackUri(3, "https://cdn.test/3.mp3")
    expect(other).toEqual({ uri: "https://cdn.test/3.mp3", local: false })
    expect(useOfflineAudioStore.getState().files[url]).toBeUndefined()

    finish?.({ status: 200, uri: fileUriFor(memberA, 12, url) })
    await pending
    expect(useOfflineAudioStore.getState().files[url]?.fileUri).toBe(fileUriFor(memberA, 12, url))
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

    const url = "https://cdn.test/12.mp3"
    const pending = useOfflineAudioStore.getState().download(url, 12, {
      userInitiated: true,
    })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[url]).toBe(0))
    await useOfflineAudioStore.getState().remove(url)
    expect(cancelAsync).toHaveBeenCalled()

    finish?.({ status: 200, uri: fileUriFor(memberA, 12, url) })
    await pending
    expect(useOfflineAudioStore.getState().files[url]).toBeUndefined()
    expect(fs.deleteAsync).toHaveBeenCalled()
  })

  it("keeps saved audio isolated per member", async () => {
    mockSuccessfulDownload()
    const url = "https://cdn.test/12.mp3"
    await useOfflineAudioStore.getState().download(url, 12, { userInitiated: true })
    expect(useOfflineAudioStore.getState().files[url]?.fileUri).toBe(fileUriFor(memberA, 12, url))

    applyAuth(memberB)
    await useOfflineAudioStore.getState().hydrate()
    expect(useOfflineAudioStore.getState().files[url]).toBeUndefined()
    expect(await resolvePlaybackUri(12, url)).toEqual({
      uri: url,
      local: false,
    })

    applyAuth(memberA)
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false })
    await useOfflineAudioStore.getState().hydrate()
    expect(useOfflineAudioStore.getState().files[url]?.fileUri).toBe(fileUriFor(memberA, 12, url))
    expect(await resolvePlaybackUri(12, url)).toEqual({
      uri: fileUriFor(memberA, 12, url),
      local: true,
    })
  })

  it("keeps both songs when two saves finish close together", async () => {
    let finish12: (() => void) | undefined
    let finish7: (() => void) | undefined
    fs.getInfoAsync.mockResolvedValue({ exists: true, isDirectory: false })
    fs.createDownloadResumable.mockImplementation((url: string, dest: string) => ({
      downloadAsync: () =>
        new Promise<void>((resolve) => {
          if (url.endsWith("/12.mp3")) finish12 = resolve
          else finish7 = resolve
        }).then(() => ({ status: 200, uri: dest })),
      cancelAsync: vi.fn(async () => undefined),
    }))

    const url12 = "https://cdn.test/12.mp3"
    const url7 = "https://cdn.test/7.mp3"
    const first = useOfflineAudioStore.getState().download(url12, 12, {
      userInitiated: true,
    })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[url12]).toBe(0))
    const second = useOfflineAudioStore.getState().download(url7, 7, {
      userInitiated: true,
    })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[url7]).toBe(0))
    finish12?.()
    finish7?.()
    await Promise.all([first, second])
    expect(useOfflineAudioStore.getState().files[url12]?.fileUri).toBe(fileUriFor(memberA, 12, url12))
    expect(useOfflineAudioStore.getState().files[url7]?.fileUri).toBe(fileUriFor(memberA, 7, url7))
  })

  it("indexes the file only after downloadAsync finishes (not on partial disk write)", async () => {
    const url = "https://cdn.test/12.mp3"
    const dest = fileUriFor(memberA, 12, url)
    let resolveDownload: ((value: { status: number; uri: string }) => void) | undefined
    fs.createDownloadResumable.mockImplementation(
      (
        _remote: string,
        fileDest: string,
        _opts: unknown,
        callback?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
      ) => ({
        downloadAsync: () =>
          new Promise((resolve) => {
            resolveDownload = resolve
            callback?.({ totalBytesWritten: 100, totalBytesExpectedToWrite: 100 })
          }),
        cancelAsync: vi.fn(async () => undefined),
      }),
    )
    fs.getInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri === dest,
      isDirectory: false,
      size: uri === dest ? 96_000 : 0,
    }))

    const pending = useOfflineAudioStore.getState().download(url, 12, { userInitiated: true })
    await vi.waitFor(() =>
      expect(offlineSaveControls({ mode: "signed_in", downloaded: false, progress: 1 }).label).toBe(
        "Saving offline…",
      ),
    )
    expect(useOfflineAudioStore.getState().files[url]).toBeUndefined()

    resolveDownload?.({ status: 200, uri: dest })
    await pending
    expect(useOfflineAudioStore.getState().files[url]?.fileUri).toBe(dest)
  })

  it("does not mark a tiny growing file as saved before downloadAsync finishes", async () => {
    const url = "https://cdn.test/12.mp3"
    const dest = fileUriFor(memberA, 12, url)
    let resolveDownload: ((value: { status: number; uri: string }) => void) | undefined
    let size = 8_000
    fs.createDownloadResumable.mockImplementation(
      (
        _remote: string,
        fileDest: string,
        _opts: unknown,
        callback?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
      ) => ({
        downloadAsync: () =>
          new Promise((resolve) => {
            resolveDownload = resolve
            callback?.({ totalBytesWritten: 8_000, totalBytesExpectedToWrite: 200_000 })
          }),
        cancelAsync: vi.fn(async () => undefined),
      }),
    )
    fs.getInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri === dest,
      isDirectory: false,
      size: uri === dest ? size : 0,
    }))

    const pending = useOfflineAudioStore.getState().download(url, 12, { userInitiated: true })
    await vi.waitFor(() => expect(useOfflineAudioStore.getState().progress[url]).toBe(0.04))
    await new Promise((r) => setTimeout(r, 500))
    expect(useOfflineAudioStore.getState().files[url]).toBeUndefined()

    size = 200_000
    resolveDownload?.({ status: 200, uri: dest })
    await pending
    expect(useOfflineAudioStore.getState().files[url]?.fileUri).toBe(dest)
  })
})
