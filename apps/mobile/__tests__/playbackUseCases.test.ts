/**
 * End-to-end use-case matrix (policy + session). Native lock-screen behavior is manual QA.
 */
import { describe, expect, it } from "vitest"

import {
  listeningSessionFromStore,
  sessionAutoAdvanceWhileLocked,
  sessionEndsOnLeaveDrive,
} from "@/lib/playback/listeningSession"
import {
  nextQueueNumber,
  shouldAdvanceAfterTrackEnd,
  shouldAutoAdvanceTrack,
} from "@/lib/playbackQueue"

const BOUNDS = [1000, 1001, 1002]

describe("use case: casual / normal listen", () => {
  it("session is casual and does not auto-advance", () => {
    const session = listeningSessionFromStore({
      playbackMode: "default",
      playlistBounds: null,
      activePlaylist: null,
      driveAutoAdvance: false,
    })
    expect(session.kind).toBe("casual")
    expect(sessionAutoAdvanceWhileLocked(session)).toBe(false)
    expect(sessionEndsOnLeaveDrive(session)).toBe(false)
    expect(shouldAdvanceAfterTrackEnd("default", 42, [42, 43])).toBe(false)
  })
})

describe("use case: saved playlist (not drive)", () => {
  it("session is playlist and advances within bounds", () => {
    const session = listeningSessionFromStore({
      playbackMode: "playlist",
      playlistBounds: BOUNDS,
      activePlaylist: { id: "p1", name: "Favorites" },
      driveAutoAdvance: false,
    })
    expect(session.kind).toBe("playlist")
    expect(shouldAutoAdvanceTrack("playlist", 1000, BOUNDS, false, false, false)).toBe(true)
    expect(shouldAutoAdvanceTrack("playlist", 1002, BOUNDS, false, false, false)).toBe(false)
    expect(nextQueueNumber("playlist", 1002, BOUNDS)).toBeNull()
  })
})

describe("use case: drive random", () => {
  it("session is drive-random and advances while driveAutoAdvance is on", () => {
    const session = listeningSessionFromStore({
      playbackMode: "random",
      playlistBounds: null,
      activePlaylist: null,
      driveAutoAdvance: true,
    })
    expect(session.kind).toBe("drive-random")
    expect(sessionAutoAdvanceWhileLocked(session)).toBe(true)
    expect(sessionEndsOnLeaveDrive(session)).toBe(true)
    expect(shouldAutoAdvanceTrack("random", 3302, [3302], true, false, false)).toBe(true)
    expect(shouldAutoAdvanceTrack("random", 3302, [3302], false, false, false)).toBe(false)
  })
})

describe("use case: drive playlist", () => {
  it("session is drive-playlist and uses bounded advance", () => {
    const session = listeningSessionFromStore({
      playbackMode: "playlist",
      playlistBounds: BOUNDS,
      activePlaylist: { id: "p2", name: "Drive list" },
      driveAutoAdvance: true,
    })
    expect(session.kind).toBe("drive-playlist")
    expect(sessionAutoAdvanceWhileLocked(session)).toBe(true)
    expect(sessionEndsOnLeaveDrive(session)).toBe(true)
    expect(shouldAutoAdvanceTrack("playlist", 1001, BOUNDS, true, false, false)).toBe(true)
    expect(shouldAdvanceAfterTrackEnd("playlist", 1002, BOUNDS)).toBe(false)
  })
})
