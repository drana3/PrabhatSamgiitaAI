/**
 * Playback behavior matrix (queue logic) — see also playerStore "playback behavior matrix".
 *
 * | Context | Auto-advance on track end | Last track |
 * |---------|---------------------------|------------|
 * | Saved playlist (bounds) | Next in bounds | Stop; no wrap to first |
 * | Drive random | While random mode | Keeps random until exit drive |
 * | Drive playlist | Next in bounds | Stop at end; exit drive clears advance |
 * | Related / row queue (default) | No | Stop (manual Next only) |
 * | Single song (default) | No | Stop or repeat one track |
 */
import { describe, expect, it } from "vitest"

import {
  listenQueueForSong,
  nextQueueNumber,
  playbackAdvanceQueue,
  playlistStep,
  shouldAdvanceAfterTrackEnd,
  shouldAdvanceAfterTrackEndInDrive,
  shouldAutoAdvanceTrack,
} from "@/lib/playbackQueue"

const BOUNDS = [1000, 1001, 1002]

describe("member playlist (Saved / playlist detail)", () => {
  it("auto-advances after a track ends even when Drive is not focused", () => {
    expect(
      shouldAutoAdvanceTrack("playlist", 1000, BOUNDS, false, false, false),
    ).toBe(true)
    expect(
      shouldAutoAdvanceTrack("playlist", 1002, BOUNDS, false, false, false),
    ).toBe(false)
  })

  it("advances within bounds and stops after the last song", () => {
    const q = playbackAdvanceQueue("playlist", BOUNDS, [1002, 99, 100])
    expect(q).toEqual(BOUNDS)
    expect(shouldAdvanceAfterTrackEnd("playlist", 1000, q)).toBe(true)
    expect(shouldAdvanceAfterTrackEnd("playlist", 1001, q)).toBe(true)
    expect(shouldAdvanceAfterTrackEnd("playlist", 1002, q)).toBe(false)
    expect(nextQueueNumber("playlist", 1002, q)).toBeNull()
    expect(nextQueueNumber("playlist", 1000, [1000, 10, 1001])).toBe(1001)
    expect(playlistStep(1002, BOUNDS, 1)).toBeNull()
  })

  it("does not restart from the first song after the last", () => {
    expect(nextQueueNumber("playlist", 1002, BOUNDS)).toBeNull()
    expect(playlistStep(1002, BOUNDS, 1)).toBeNull()
  })

  it("song page listen queue prefers bounds over related songs", () => {
    expect(listenQueueForSong(1002, [1, 2, 3], "playlist", [1002, 1, 2], BOUNDS)).toEqual(BOUNDS)
  })
})

describe("drive mode — while active", () => {
  it("random mode always auto-advances", () => {
    expect(shouldAdvanceAfterTrackEnd("random", 42, [42])).toBe(true)
  })

  it("playlist mode on drive uses the same bounded rules", () => {
    expect(shouldAdvanceAfterTrackEnd("playlist", 1000, BOUNDS)).toBe(true)
    expect(shouldAdvanceAfterTrackEnd("playlist", 1002, BOUNDS)).toBe(false)
  })

  it("still auto-advances when the phone is locked (drive session on, UI unfocused)", () => {
    expect(
      shouldAdvanceAfterTrackEndInDrive("random", 42, [42], true, false, false),
    ).toBe(true)
    expect(
      shouldAdvanceAfterTrackEndInDrive("playlist", 1000, BOUNDS, true, false, false),
    ).toBe(true)
    expect(shouldAutoAdvanceTrack("random", 42, [42], true, false, false)).toBe(true)
  })

  it("random mode does not advance after drive session ends (stale random flag)", () => {
    expect(shouldAutoAdvanceTrack("random", 42, [42], false, false, false)).toBe(false)
  })

  it("drive repeat loops the current song instead of advancing", () => {
    expect(
      shouldAdvanceAfterTrackEndInDrive("random", 42, [42], true, true),
    ).toBe(false)
    expect(
      shouldAdvanceAfterTrackEndInDrive("playlist", 1000, BOUNDS, true, true),
    ).toBe(false)
    expect(
      shouldAdvanceAfterTrackEndInDrive("random", 42, [42], true, false),
    ).toBe(true)
    expect(
      shouldAdvanceAfterTrackEndInDrive("playlist", 1002, BOUNDS, true, false),
    ).toBe(false)
  })
})

describe("normal listening (default / related queue)", () => {
  it("single song does not auto-advance", () => {
    expect(shouldAdvanceAfterTrackEnd("default", 5, [5])).toBe(false)
  })

  it("multi-song related queue does not auto-advance in default mode", () => {
    const related = [5, 9, 11]
    expect(shouldAdvanceAfterTrackEnd("default", 5, related)).toBe(false)
    expect(shouldAdvanceAfterTrackEnd("default", 11, related)).toBe(false)
  })
})

describe("bounded playlist end vs repeat", () => {
  it("detects last song in bounds for repeat suppression", () => {
    expect(playlistStep(1002, BOUNDS, 1)).toBeNull()
    expect(playlistStep(1001, BOUNDS, 1)).toBe(1002)
  })
})
