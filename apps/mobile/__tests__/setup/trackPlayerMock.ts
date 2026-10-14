import { beforeEach, vi } from "vitest"

vi.mock("react-native-track-player", async () => import("./fakeTrackPlayer"))

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
