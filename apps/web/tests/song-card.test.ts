import { existsSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { scriptMeta } from "@/components/song-card"
import { AUTHOR_CARD_PHOTOS } from "@/lib/author-card"
import { songCardElement, songTitleSize } from "@/lib/song-card-image"
import {
  clip,
  isDrawableText,
  isSongNumber,
  songCardLine,
  songCardPath,
  songCardPhoto,
  songCardTitle,
  songEyebrow,
  songPageDescription,
  songPageTitle,
} from "@/lib/song-card"

const song = { number: 1234, title: "MADHUR HASI", first_line: "madhur hásí tava cittá", language: "Bengali", theme: "Devotion" }

describe("song card text", () => {
  it("shows the number, a Title Cased title and the first line", () => {
    expect(songEyebrow(song)).toBe("Prabhat Samgiita · Song 1234")
    expect(songCardTitle(song)).toBe("Madhur Hasi")
    expect(songCardLine(song)).toBe("Madhur Hásí Tava Cittá")
  })

  it("never draws a script the fonts do not have", () => {
    expect(isDrawableText("Madhur Hásí")).toBe(true)
    expect(isDrawableText("मधुर हासि")).toBe(false)
    expect(songCardTitle({ number: 7, title: "मधुर हासि", first_line: "Madhur hasi" })).toBe("Madhur Hasi")
    expect(songCardTitle({ number: 7, title: "মধুর", first_line: "मधुर" })).toBe("Song 7")
    expect(songCardLine({ number: 7, title: "x", first_line: "মধুর" })).toBe("")
  })

  it("leaves out a first line that only repeats the title", () => {
    expect(songCardLine({ number: 1, title: "Same line", first_line: "same line" })).toBe("")
  })

  it("clips long text on a word, with an ellipsis", () => {
    const long = "word ".repeat(60)
    const out = clip(long, 40)
    expect(out.length).toBeLessThanOrEqual(40)
    expect(out.endsWith("…")).toBe(true)
    expect(clip("short", 40)).toBe("short")
  })

  it("page title and description are plain text, no lyrics beyond the first line, no address", () => {
    expect(songPageTitle(song)).toBe("Madhur Hasi · Prabhat Samgiita 1234")
    const text = songPageDescription(song)
    expect(text).toContain("Madhur Hásí Tava Cittá")
    expect(text).toContain("Devotion · Bengali")
    expect(text).not.toMatch(/https?:|www\./)
    expect(songPageDescription({ number: 5, title: "T" })).toBe("Lyrics, meaning and recordings on Prabhat Samgiita AI.")
  })
})

describe("song card picture", () => {
  it("each song has one stable photo from the shared list, and the file exists", () => {
    for (const n of [1, 2, 99, 1234, 5018]) {
      const photo = songCardPhoto(n)
      expect(AUTHOR_CARD_PHOTOS).toContain(photo)
      expect(songCardPhoto(n)).toBe(photo)
      expect(existsSync(path.join(process.cwd(), "public", "share", "bg", `${photo}.jpg`))).toBe(true)
    }
  })

  it("address of the picture, with an optional version", () => {
    expect(songCardPath(12)).toBe("/share/song/12")
    expect(songCardPath(12, "a b")).toBe("/share/song/12?v=a%20b")
  })

  it("only real song numbers have a picture", () => {
    expect(isSongNumber("1")).toBe(true)
    expect(isSongNumber("5018")).toBe(true)
    for (const bad of ["0", "-1", "1.5", "abc", "", "123456", "1e3"]) expect(isSongNumber(bad), bad).toBe(false)
  })

  it("long titles get a smaller size, never below the floor", () => {
    expect(songTitleSize("Short", "link")).toBeGreaterThan(songTitleSize("x".repeat(40), "link"))
    expect(songTitleSize("x".repeat(200), "link")).toBeGreaterThanOrEqual(44)
  })

  it("draws without the site address or any number but the song's own", () => {
    const element = songCardElement({ song, format: "link", background: "data:image/jpeg;base64,AA==" })
    const json = JSON.stringify(element)
    expect(json).toContain("Song 1234")
    expect(json).not.toMatch(/prabhatasamgiita\.org|https?:\/\/(?!www\.w3)/)
  })
})

describe("scriptMeta", () => {
  it("does not advertise Devanagari for English songs", () => {
    expect(scriptMeta({ number: 68, language: "English" })).toBe("English")
    expect(scriptMeta({ number: 5008, language: null })).toBe("English")
    expect(scriptMeta({ number: 5009, language: "en" })).toBe("English")
  })

  it("keeps Roman · Devanagari for Roman catalog songs", () => {
    expect(scriptMeta({ number: 1, language: "Roman" })).toBe("Roman · Devanagari")
    expect(scriptMeta({ number: 1, language: null })).toBe("Roman · Devanagari")
  })

  it("keeps language plus scripts for other tagged languages", () => {
    expect(scriptMeta({ number: 42, language: "Bengali dialect" })).toBe(
      "Bengali dialect · Roman · Devanagari",
    )
  })
})
