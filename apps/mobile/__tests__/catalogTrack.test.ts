import { describe, expect, it } from "vitest"

import { lockScreenArtist, lockScreenTitle, songToTrack } from "@/lib/playback/catalogTrack"
import type { MockSong } from "@/data/mock"

const song = {
  number: 1,
  title: "BANDHU HE NIYE CALO",
  audioUrl: "https://x/a.mp3",
  audioRecordings: [{ title: "Performer A", url: "https://x/a.mp3" }],
  durationSeconds: 238,
} as unknown as MockSong

describe("lock screen metadata", () => {
  it("shows a shouting title in title case and leaves mixed case alone", () => {
    expect(lockScreenTitle("BANDHU HE NIYE CALO")).toBe("Bandhu He Niye Calo")
    expect(lockScreenTitle("Bandhu he niye calo")).toBe("Bandhu he niye calo")
  })

  it("puts PS number, instrument and performer under the title", () => {
    expect(lockScreenArtist(song, "https://x/a.mp3")).toBe("PS 1 · Voice · Performer A")
  })

  it("builds the track the native player shows", () => {
    expect(songToTrack(song, "https://x/a.mp3")).toMatchObject({
      id: "ps-1",
      title: "Bandhu He Niye Calo",
      artist: "PS 1 · Voice · Performer A",
      duration: 238,
    })
  })
})
