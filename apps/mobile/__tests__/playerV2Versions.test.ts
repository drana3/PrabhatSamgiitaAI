import { describe, expect, it } from "vitest"

import {
  inferInstrument,
  selectedVersionIndex,
  versionRowMeta,
  versionsFromSong,
  versionSummary,
} from "@/lib/playerV2/versions"
import {
  afterVersionEnd,
  effectivePlayMode,
  playModeLabel,
  shouldHoldUpcoming,
  versionChipText,
  PLAY_SCOPE_OPTIONS,
  versionPositionLabel,
} from "@/lib/playerV2/versionMode"

const song = {
  number: 1,
  audioUrl: "https://a/2.mp3",
  audioRecordings: [
    { title: "Original rendition", url: "https://a/1.mp3", provider: "official" },
    { title: "Guitar, Performer B", url: "https://a/2.mp3", provider: "direct_audio" },
    { title: "Harmonium", url: "https://a/3.mp3", provider: "direct_audio" },
    { title: "Kiirtan group", url: "https://a/4.mp3", provider: "direct_audio" },
    { title: "Recording", url: "https://a/5.mp3", provider: "direct_audio" },
    { title: "Recording", url: "https://a/1.mp3", provider: "direct_audio" },
  ],
}

describe("versions", () => {
  it("infers the instrument from the recording title", () => {
    expect(inferInstrument("Guitar, Performer B")).toBe("guitar")
    expect(inferInstrument("Harmonium")).toBe("harmonium")
    expect(inferInstrument("Kiirtan group")).toBe("group")
    expect(inferInstrument("Flute instrumental")).toBe("instrumental")
    expect(inferInstrument("Sadhaka")).toBe("voice")
    expect(inferInstrument(undefined)).toBe("voice")
  })

  it("builds one version per distinct url with stable ids and no invented lengths", () => {
    const versions = versionsFromSong(song)
    expect(versions).toHaveLength(5)
    expect(versions.map((v) => v.id)).toEqual([
      "ps-1-v1",
      "ps-1-v2",
      "ps-1-v3",
      "ps-1-v4",
      "ps-1-v5",
    ])
    expect(versions[1]).toMatchObject({ instrument: "guitar", performer: "Guitar, Performer B" })
    expect(versions[4]?.performer).toBe("Recording 5")
    expect(versions.every((v) => v.lengthSeconds === null)).toBe(true)
  })

  it("falls back to the playing url when the catalog lists no recordings", () => {
    const versions = versionsFromSong({ number: 7, audioUrl: "https://x/7.mp3", audioRecordings: [] })
    expect(versions).toHaveLength(1)
    expect(versions[0]?.performer).toBe("Original recording")
    expect(versionsFromSong({ number: 8, audioUrl: null })).toEqual([])
  })

  it("finds the selected version by remembered id first, then by url, then the first", () => {
    const versions = versionsFromSong(song)
    expect(selectedVersionIndex(versions, "file:///offline.mp3", "ps-1-v3")).toBe(2)
    expect(selectedVersionIndex(versions, "https://a/2.mp3")).toBe(1)
    expect(selectedVersionIndex(versions, "file:///offline.mp3")).toBe(0)
    expect(selectedVersionIndex([], "x")).toBe(-1)
  })

  it("writes the chip text and the sheet row meta", () => {
    const [first, second] = versionsFromSong(song)
    expect(versionSummary(second!)).toBe("Guitar · Guitar, Performer B")
    expect(versionRowMeta(first!, (s) => `${s}s`)).toBe("Voice")
    expect(versionRowMeta({ ...first!, lengthSeconds: 238, tag: "Best" }, (s) => `${s}s`)).toBe(
      "Voice · 238s · Best",
    )
  })
})

describe("play every version or just one", () => {
  const base = { repeatOne: false, repeatAll: false, hasNextSong: true }

  it("moves to the next version while the mode is all", () => {
    expect(afterVersionEnd({ ...base, mode: "all", versionIndex: 1, versionCount: 6 })).toEqual({
      kind: "next-version",
      index: 2,
    })
  })

  it("moves to the next song after the last version", () => {
    expect(afterVersionEnd({ ...base, mode: "all", versionIndex: 5, versionCount: 6 })).toEqual({
      kind: "next-song",
      wrap: false,
    })
  })

  it("this-version mode goes straight to the next song", () => {
    expect(afterVersionEnd({ ...base, mode: "this", versionIndex: 0, versionCount: 6 })).toEqual({
      kind: "next-song",
      wrap: false,
    })
  })

  it("repeat one repeats the current version in either mode", () => {
    for (const mode of ["this", "all"] as const) {
      expect(
        afterVersionEnd({ ...base, mode, versionIndex: 2, versionCount: 6, repeatOne: true }),
      ).toEqual({ kind: "repeat-version" })
    }
  })

  it("stops at the end of the list, or wraps with repeat all", () => {
    const end = { mode: "this" as const, versionIndex: 0, versionCount: 1, repeatOne: false }
    expect(afterVersionEnd({ ...end, repeatAll: false, hasNextSong: false })).toEqual({ kind: "stop" })
    expect(afterVersionEnd({ ...end, repeatAll: true, hasNextSong: false })).toEqual({
      kind: "next-song",
      wrap: true,
    })
  })

  it("labels the switch and the chip position", () => {
    expect(playModeLabel("this", 6)).toBe("This version")
    expect(playModeLabel("all", 6)).toBe("All 6 versions")
    expect(versionPositionLabel("all", 1, 6)).toBe("2/6")
    expect(versionPositionLabel("this", 1, 6)).toBeNull()
    expect(versionPositionLabel("all", 0, 1)).toBeNull()
  })

  it("all means nothing for a one-version song", () => {
    expect(effectivePlayMode("all", 1)).toBe("this")
    expect(effectivePlayMode("all", 2)).toBe("all")
  })

  it("holds the next song only while more versions remain", () => {
    expect(shouldHoldUpcoming("all", 0, 3)).toBe(true)
    expect(shouldHoldUpcoming("all", 2, 3)).toBe(false)
    expect(shouldHoldUpcoming("this", 0, 3)).toBe(false)
  })

  it("builds the one-line version chip", () => {
    expect(versionChipText("Voice · Performer A", 6, "this", 0)).toEqual({ text: "Voice · Performer A · 6 versions", position: null, pickable: true })
    expect(versionChipText("Voice · Performer A", 6, "all", 1)).toEqual({ text: "Voice · Performer A", position: "2/6", pickable: true })
    expect(versionChipText("Voice · Performer A", 1, "this", 0)).toEqual({ text: "Voice · Performer A", position: null, pickable: false })
    expect(PLAY_SCOPE_OPTIONS.map((o) => o.mode)).toEqual(["this", "all"])
  })
})
