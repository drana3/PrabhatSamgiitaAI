import { describe, expect, it } from "vitest"

import type { MockSong } from "@/data/mock"
import { songToTrack } from "@/lib/playback/catalogTrack"
import { songPlaceholder, songSummaryToMockSong } from "@/lib/songMap"
import { todayItemToMockSong } from "@/lib/today"
import { recentPlayToSong, resumeProgress } from "@/lib/todayView"
import { resumeLine } from "@/lib/todayDay"
import { knownDuration } from "@/lib/playerV2/transportState"

/** A song whose length the catalog does not know carries 0, never a made-up 5:00. */
describe("unknown song length", () => {
  const summary = { number: 7, title: "Song 7", first_line: "first line" } as never
  const item = { number: 7, title: "Song 7", first_line: "first line", reasons: [] } as never

  it("is 0 in every stub built without a length", () => {
    expect(songPlaceholder(7).durationSeconds).toBe(0)
    expect(songSummaryToMockSong(summary).durationSeconds).toBe(0)
    expect(todayItemToMockSong(item).durationSeconds).toBe(0)
    expect(recentPlayToSong({ id: "ps-7", number: 7, title: "Song 7", thumbnailUrl: "", themes: [] }).durationSeconds).toBe(0)
  })

  it("leaves the length off the lock-screen track when unknown, and keeps a real one", () => {
    const base = { number: 7, title: "Song 7", audioUrl: "https://x/a.mp3" }
    expect(songToTrack({ ...base, durationSeconds: 0 } as unknown as MockSong, "https://x/a.mp3").duration).toBeUndefined()
    expect(songToTrack({ ...base, durationSeconds: 238 } as unknown as MockSong, "https://x/a.mp3").duration).toBe(238)
  })

  it("shows no clock and no progress for it", () => {
    expect(resumeLine({ number: 7, position: 72, duration: 0 })).toBe("PS 7")
    expect(resumeProgress(72, 0)).toBe(0)
    expect(knownDuration({ duration: 0, position: 0, isBuffering: true, placeholder: 0 })).toBeNull()
  })
})
