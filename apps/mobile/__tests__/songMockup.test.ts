import { describe, expect, it } from "vitest"

import {
  MOCKUP_CONTENT_NUMBERS,
  MOCKUP_LANGUAGES,
  mockupFixtureKey,
  mockupRow,
  mockupSizeText,
  mockupSong,
  mockupTranslation,
  mockupVariantFor,
  mockupVersions,
} from "@/lib/fixtures/songMockup"
import { layoutChart, type ChordChart } from "@/lib/songPage/chordChart"
import { versionDetail, type SongVersion } from "@/lib/songPage/versions"

describe("prototype sample songs", () => {
  it("draws the sample page for PS 1 and PS 3 only, with the catalog's titles", () => {
    expect(MOCKUP_CONTENT_NUMBERS).toEqual([1, 3])
    expect(mockupRow(1)).toMatchObject({ n: 1, secs: 238, index: 0 })
    expect(mockupRow(1)?.title.normalize("NFC")).toBe("Bandhu He Niye Calo")
    expect(mockupRow(3)?.title.normalize("NFC")).toBe("Ándhára Sheśe Álora Deshe")
    // every other number, real or not, opens the real song page: the sample words are not its lyrics
    expect(mockupRow(2)).toBeNull()
    expect(mockupRow(4000)).toBeNull()
    expect(mockupRow(99999)).toBeNull()
  })

  it("picks the first sample for index 0 and the second for index 2, the rest by parity", () => {
    expect(mockupVariantFor(0)).toBe("a")
    expect(mockupVariantFor(2)).toBe("b")
    expect(mockupVariantFor(5)).toBe("b")
    expect(mockupVariantFor(6)).toBe("a")
    expect(mockupFixtureKey(1)).toBe(1)
    expect(mockupFixtureKey(3)).toBe(3)
  })

  it("builds the song with Roman and Devanagari lines of equal length", () => {
    const song = mockupSong(1)!
    expect(song.title.normalize("NFC")).toBe("Bandhu He Niye Calo")
    expect(song.themes).toEqual(["hopeful"])
    expect(song.performer).toBe("Performer A")
    const roman = song.lyrics.split("\n")
    const deva = (song.lyricsDevanagari ?? "").split("\n")
    expect(roman).toHaveLength(4)
    expect(deva).toHaveLength(roman.length)
    expect(roman[0]).toBe("Bandhu he niye calo")
    expect(mockupSong(424242)).toBeNull()
    expect(mockupSong(4)).toBeNull()
  })

  it("gives one translation line per lyric line and null for unknown languages", () => {
    const lines = mockupSong(1)!.lyrics.split("\n")
    for (const code of ["en", "ru", "hi", "fr", "es"]) {
      expect(mockupTranslation(1, code)).toHaveLength(lines.length)
    }
    expect(mockupTranslation(1, "de")).toBeNull()
    expect(mockupTranslation(1, "words")).toBeNull()
    expect(mockupTranslation(3, "en")).toHaveLength(3)
  })

  it("makes six versions whose lengths are the song length plus the prototype offsets", () => {
    const versions = mockupVersions(1)
    expect(versions).toHaveLength(6)
    expect(versions.map((v) => v.length)).toEqual([238, 260, 220, 280, 247, 208])
    expect(versions[0]).toMatchObject({ performer: "Performer A", instrument: "voice", tag: "Best" })
    expect(new Set(versions.map((v) => v.url)).size).toBe(6)
  })

  it("formats the download size like the prototype", () => {
    expect(mockupSizeText(238)).toBe("3.7 MB")
    expect(mockupSizeText(0)).toBe("0 MB")
    expect(mockupSizeText(null)).toBe("0 MB")
    expect(mockupSizeText(80000)).toBe("1.22 GB")
  })

  it("lists 14 languages, five with translations", () => {
    expect(MOCKUP_LANGUAGES).toHaveLength(14)
    expect(MOCKUP_LANGUAGES.filter((l) => l.coverage !== "none").map((l) => l.code)).toEqual([
      "en",
      "ru",
      "fr",
      "hi",
      "es",
    ])
  })
})

describe("version detail in the versions sheet", () => {
  const base: SongVersion = {
    id: "a",
    url: "u",
    instrument: "guitar",
    label: "Guitar",
    performer: "Performer B",
    length: 260,
    tag: "Verified",
  }

  it("names only the Best and Community tags", () => {
    expect(versionDetail(base)).toBe("Guitar · 4:20")
    expect(versionDetail({ ...base, tag: "Community" })).toBe("Guitar · 4:20 · Community")
    expect(versionDetail({ ...base, tag: "Best" })).toBe("Guitar · 4:20 · Best")
    expect(versionDetail({ ...base, tag: "Instrumental" })).toBe("Guitar · 4:20")
  })

  it("prefers the prototype's own label over the instrument name", () => {
    expect(versionDetail({ ...base, instrument: "harmonium", label: "Harmonium, solo" })).toBe(
      "Harmonium, solo · 4:20",
    )
  })
})

describe("chord chart layout", () => {
  const chart = {
    lines: [
      { placements: [{ word: 0, chord: "C" }, { word: 2, chord: "Am" }] },
      { placements: [{ word: 0, chord: "Am" }] },
    ],
  } as unknown as ChordChart
  const show = (chord: string) => chord

  it("leaves out a chord that has not changed from the end of the line before", () => {
    const columns = layoutChart(["Bandhu he niye calo", "Alor jharana"], chart, show)
    expect(columns[1]![0]!.chord).toBeNull()
  })

  it("writes the chord at the start of every line when asked", () => {
    const columns = layoutChart(["Bandhu he niye calo", "Alor jharana"], chart, show, true)
    expect(columns[1]![0]!.chord).toBe("Am")
  })
})
