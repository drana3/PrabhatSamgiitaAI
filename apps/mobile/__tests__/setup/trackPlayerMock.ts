import { beforeEach, vi } from "vitest"

vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: (spec: { ios?: unknown; android?: unknown; default?: unknown }) =>
      spec.ios ?? spec.default,
  },
  InteractionManager: {
    runAfterInteractions: (fn: () => void) => {
      fn()
      return { cancel: () => undefined }
    },
  },
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}))

vi.mock("react-native-track-player", async () => import("./fakeTrackPlayer"))

vi.mock("@/lib/playback/trackPlayerBridge", async () => {
  const fake = await import("./fakeTrackPlayer")
  return {
    isTrackPlayerLinked: () => true,
    ensurePlaybackServiceRegistered: vi.fn(),
    loadTrackPlayerModule: () => fake,
    getTrackPlayer: () => fake.default,
  }
})

beforeEach(async () => {
  const TrackPlayer = (await import("./fakeTrackPlayer")).default
  TrackPlayer.add.mockClear()
  TrackPlayer.reset.mockClear()
  TrackPlayer.play.mockClear()
  TrackPlayer.pause.mockClear()
  TrackPlayer.stop.mockClear()
  TrackPlayer.skipToNext.mockClear()
  const { resetRadioSession } = await import("../../lib/playback/radioSession")
  resetRadioSession()
  const { clearCatalogSongCache } = await import("../../lib/playback/catalogSongCache")
  clearCatalogSongCache()
})
