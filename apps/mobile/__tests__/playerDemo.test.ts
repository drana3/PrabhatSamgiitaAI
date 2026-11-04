import { describe, expect, it } from "vitest"

import {
  DEMO_CATALOG_COUNT,
  demoNumbers,
  demoRows,
  demoSong,
  demoTitle,
  demoUrl,
  demoVersionIndex,
  demoVersionSeconds,
  demoVersions,
  isDemoUrl,
} from "@/lib/fixtures/playerDemo"
import { demoDownloadKey, demoDownloadSize, useDemoDownloads } from "@/lib/playerV2/demoDownloads"

describe("demo player fixtures", () => {
  it("has the prototype's 64 songs with PS 1 to 7 first", () => {
    const rows = demoRows()
    expect(rows).toHaveLength(64)
    expect(rows.slice(0, 3).map((r) => r.title)).toEqual([
      "Bandhu He Niye Calo",
      "E Gán Ámár, Álor Jharańá Dhárá",
      "Ándhára Sheśe Álora Deshe",
    ])
    expect(demoNumbers().every((n) => n >= 1 && n <= DEMO_CATALOG_COUNT)).toBe(true)
    expect(demoTitle(3)).toBe("Ándhára Sheśe Álora Deshe")
  })

  it("round-trips the version index through the demo url", () => {
    const url = demoUrl(3, 4)
    expect(isDemoUrl(url)).toBe(true)
    expect(demoVersionIndex(url)).toBe(3)
    expect(demoVersionIndex("https://example.com/a.mp3")).toBe(-1)
  })

  it("builds six versions and a song whose length follows the chosen one", () => {
    const versions = demoVersions(3)
    expect(versions).toHaveLength(6)
    expect(versions[0]).toMatchObject({ performer: "Performer A", tag: "Best" })
    const song = demoSong(3, undefined, 3)
    expect(song.audioUrl).toBe(demoUrl(3, 4))
    expect(song.durationSeconds).toBe(demoVersionSeconds(3, 3))
    expect(song.performer).toBe("Group D")
  })
})

describe("demo downloads", () => {
  it("starts with the prototype's downloaded versions and toggles them", () => {
    const key = demoDownloadKey(1, 0)
    expect(useDemoDownloads.getState().done[key]).toBe(true)
    expect(useDemoDownloads.getState().toggle(key)).toBe("removed")
    expect(useDemoDownloads.getState().done[key]).toBeUndefined()
  })

  it("sizes a download at 0.0156 MB per second", () => {
    expect(demoDownloadSize(238)).toBe("3.7 MB")
    expect(demoDownloadSize(0)).toBe("0 MB")
  })
})
