import { expect, vi } from "vitest"

export async function catalogPlayer() {
  return (await import("react-native-track-player")).default
}

export async function catalogPlayerEvents() {
  return import("react-native-track-player") as Promise<{
    Event: { PlaybackQueueEnded: string; PlaybackActiveTrackChanged: string }
    __emitTrackPlayer: (event: string, payload: unknown) => void
  }>
}

export async function waitForCatalogAdd(times = 1) {
  const TrackPlayer = await catalogPlayer()
  await vi.waitFor(() => expect(TrackPlayer.add.mock.calls.length).toBeGreaterThanOrEqual(times))
  return TrackPlayer
}
