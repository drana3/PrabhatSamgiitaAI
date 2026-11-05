import { describe, expect, it } from "vitest"

import {
  DEMO_CATALOG_COUNT,
  demoNumbers,
  demoRow,
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
  it("opens on a queue of the first 64 real songs, titled from the catalog", () => {
    const rows = demoRows()
    expect(rows).toHaveLength(64)
    expect(rows.map((r) => r.number)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1))
    expect(rows.slice(0, 3).map((r) => r.title.normalize("NFC"))).toEqual([
      "Bandhu He Niye Calo",
      "E Gán Ámár, Álor Jharańá Dhárá",
      "Ándhára Sheśe Álora Deshe",
    ])
    // not loaded yet: a plain number, never an invented name
    expect(rows[40]?.title).toBe("Prabhat Samgiita 41")
    expect(demoNumbers().every((n) => n >= 1 && n <= DEMO_CATALOG_COUNT)).toBe(true)
    expect(demoTitle(3)?.normalize("NFC")).toBe("Ándhára Sheśe Álora Deshe")
    expect(demoRow(0)).toBeUndefined()
    expect(demoRow(5019)).toBeUndefined()
    expect(demoRow(4999)?.number).toBe(4999)
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
