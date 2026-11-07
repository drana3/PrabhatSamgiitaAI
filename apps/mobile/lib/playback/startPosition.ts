import type { MockSong } from "@/data/mock"

/**
 * Where a song should start, asked at the moment it is handed to the native player. The resume feature
 * answers (lib/playerV2/services.ts): a song that was stopped at 1:23 is loaded already at 1:23, so there
 * is no moment of the beginning before the jump. Without an answer a song starts at 0.
 */
export type StartPositionResolver = (song: MockSong) => number

let resolver: StartPositionResolver | null = null

export function setStartPositionResolver(next: StartPositionResolver | null): void {
  resolver = next
}

/** Seconds to start at; 0 when there is no resolver, no saved position or the resolver fails. */
export function resolveStartPosition(song: MockSong): number {
  try {
    const seconds = resolver ? resolver(song) : 0
    return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0
  } catch {
    return 0
  }
}
