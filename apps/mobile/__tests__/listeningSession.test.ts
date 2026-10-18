import { describe, expect, it } from "vitest"

import {
  isStaleRandomWithoutDrive,
  listeningSessionFromStore,
  sessionAutoAdvanceWhileLocked,
  sessionPrefetchesNextMetadata,
  sessionShouldAdvanceAfterTrackEnd,
} from "@/lib/playback/listeningSession"

describe("listeningSession", () => {
  it("maps drive random from store flags", () => {
    expect(
      listeningSessionFromStore({
        playbackMode: "random",
        playlistBounds: null,
        activePlaylist: null,
        driveAutoAdvance: true,
      }).kind,
    ).toBe("drive-random")
    expect(
      sessionAutoAdvanceWhileLocked(
        listeningSessionFromStore({
          playbackMode: "random",
          playlistBounds: null,
          activePlaylist: null,
          driveAutoAdvance: true,
        }),
      ),
    ).toBe(true)
  })

  it("detects stale random after drive exit", () => {
    expect(
      isStaleRandomWithoutDrive({
        playbackMode: "random",
        playlistBounds: null,
        activePlaylist: null,
        driveAutoAdvance: false,
        driveScreenFocused: false,
      }),
    ).toBe(true)
  })

  it("drive-random session advances on track end", () => {
    expect(
      sessionShouldAdvanceAfterTrackEnd(
        { kind: "drive-random" },
        false,
        42,
        [42],
      ),
    ).toBe(true)
    expect(
      sessionShouldAdvanceAfterTrackEnd({ kind: "casual" }, false, 42, [42, 43]),
    ).toBe(false)
  })

  it("drive radio prefetches next metadata so overnight skip is not a silent network gap", () => {
    expect(sessionPrefetchesNextMetadata({ kind: "drive-random" })).toBe(true)
    expect(sessionPrefetchesNextMetadata({ kind: "casual" })).toBe(false)
  })

  it("maps casual listen when not in playlist or drive", () => {
    expect(
      listeningSessionFromStore({
        playbackMode: "default",
        playlistBounds: null,
        activePlaylist: null,
        driveAutoAdvance: false,
      }).kind,
    ).toBe("casual")
  })
})
