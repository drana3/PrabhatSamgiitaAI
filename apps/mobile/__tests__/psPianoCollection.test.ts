import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import { pianoCollectionEn, pianoCollectionEs, pianoCollectionRu } from "@/locales/pianoCollection"
import { pianoEn, pianoEs, pianoRu } from "@/locales/pianoNotes"
import { COLLECTION_PIANO_SONGS, collectionPianoSheet, hasCollectionPiano } from "@/lib/pianoNotes/collection"
import { isLocalSheetId, localPianoSheet } from "@/lib/pianoNotes/local"
import { MAX_ROWS, MAX_STEPS, MAX_STEPS_PER_ROW, momentsOf, validateDraft } from "@/lib/pianoNotes/rules"

/** The result of scripts/ps_piano_from_pdf.py as the curated folder keeps it (one file per song). */
const CURATED = path.resolve(__dirname, "../../../data/curated/ps_piano_from_pdf")
type CuratedSong = {
  number: number
  title: string
  capo: number | null
  sa: { sounding: string; uncertain: boolean }
  rows: Array<{ label: string | null; repeat: number; steps: Array<{ k: number[]; b: number }> }>
  stepsCount: number
  bars: Array<{ time: string; quarters: number; notes: Array<{ b: number; rest: boolean; k: number | null }> }>
  doubts: string[]
}
const curated: CuratedSong[] = readdirSync(CURATED)
  .filter((f) => /^ps_\d+\.json$/.test(f))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(CURATED, f), "utf8")) as CuratedSong)

describe("the curated notes read from the PDF", () => {
  it("has the 50 songs of the collection, each with a capo and a Sa", () => {
    expect(curated).toHaveLength(50)
    for (const song of curated) {
      expect(song.capo, `PS ${song.number} capo`).not.toBeNull()
      expect(song.sa.sounding, `PS ${song.number} Sa`).toMatch(/^[A-G]#?$/)
      expect(Array.isArray(song.doubts)).toBe(true)
    }
  })

  it("counts the steps it says and keeps them inside the limits of a sheet", () => {
    for (const song of curated) {
      const total = song.rows.reduce((n, r) => n + r.steps.length, 0)
      expect(total, `PS ${song.number}`).toBe(song.stepsCount)
      expect(song.rows.length).toBeLessThanOrEqual(MAX_ROWS)
      expect(total).toBeLessThanOrEqual(MAX_STEPS)
      for (const row of song.rows) expect(row.steps.length).toBeLessThanOrEqual(MAX_STEPS_PER_ROW)
    }
  })

  it("reads PS 1 as the booklet does: Pa held, Ma, Ga held, then a rest", () => {
    const first = curated.find((s) => s.number === 1)!.rows[0]!.steps.slice(0, 4)
    expect(first.map((s) => s.k)).toEqual([[7], [5], [4], []])
    expect(first.map((s) => s.b)).toEqual([1.5, 0.5, 1, 1])
  })

  it("has full bars: most of the bars of a song add up to the time signature", () => {
    for (const song of curated) {
      const bars = song.bars.filter((b) => b.notes.length > 0)
      const full = bars.filter((b) => Math.abs(b.notes.reduce((n, x) => n + x.b, 0) - b.quarters) < 1e-6)
      expect(full.length / bars.length, `PS ${song.number}`).toBeGreaterThan(0.8)
    }
  })

  it("names every place it was not sure of in the doubts", () => {
    const songsWithDoubts = curated.filter((s) => s.doubts.length > 0)
    expect(songsWithDoubts.length).toBeGreaterThan(0)
    for (const song of curated.filter((s) => s.sa.uncertain)) expect(song.doubts.some((d) => /^Sa /.test(d) || /Sa [A-G]#? comes from/.test(d)), `PS ${song.number}`).toBe(true)
  })
})

describe("the collection in the app", () => {
  it("bundles exactly what the curated folder holds", () => {
    expect(COLLECTION_PIANO_SONGS).toEqual(curated.map((s) => s.number))
    for (const song of curated) {
      const sheet = collectionPianoSheet(song.number)!
      expect(sheet.rows.map((r) => r.steps)).toEqual(song.rows.map((r) => r.steps.map(({ k, b }) => ({ k, b }))))
      expect(sheet.saKey).toBe(song.sa.sounding)
      expect(sheet.fromCollection).toEqual({ doubts: song.doubts.length, saUncertain: song.sa.uncertain })
    }
  })

  it("makes a sheet every song passes the editor's checks with, shown as not checked by the team", () => {
    for (const number of COLLECTION_PIANO_SONGS) {
      const sheet = collectionPianoSheet(number)!
      expect(sheet.id).toBe(`collection-${number}`)
      expect(sheet.author).toBeNull()
      expect(sheet.fromBooklet).toBeUndefined()
      expect(validateDraft({ saKey: sheet.saKey, rows: sheet.rows, linkUrl: "", note: "", isAnonymous: true }), `PS ${number}`).toBeNull()
      expect(momentsOf(sheet.rows, "one_finger").length).toBeGreaterThan(10)
    }
  })

  it("has no sheet for a song that is not in the collection", () => {
    expect(hasCollectionPiano(3)).toBe(false)
    expect(collectionPianoSheet(3)).toBeNull()
    expect(hasCollectionPiano(5)).toBe(true)
  })

  it("keeps the booklet for songs 1, 2 and 27, and uses the collection for the others", () => {
    for (const number of [1, 2, 27]) expect(localPianoSheet(number)!.fromBooklet).toBe(true)
    expect(localPianoSheet(5)!.fromCollection).toBeDefined()
    expect(localPianoSheet(5)!.fromBooklet).toBeUndefined()
    expect(localPianoSheet(3)).toBeNull()
  })

  it("knows its own sheet ids", () => {
    expect(isLocalSheetId("booklet-1")).toBe(true)
    expect(isLocalSheetId("collection-5")).toBe(true)
    expect(isLocalSheetId("0c1d")).toBe(false)
  })
})

describe("the words of the collection", () => {
  it("come in English, Russian and Spanish for the same keys, merged into the piano words", () => {
    const keys = Object.keys(pianoCollectionEn)
    expect(Object.keys(pianoCollectionRu)).toEqual(keys)
    expect(Object.keys(pianoCollectionEs)).toEqual(keys)
    for (const key of keys) {
      expect(pianoEn).toHaveProperty([key])
      expect(pianoRu[key as keyof typeof pianoEn]).toBe(pianoCollectionRu[key as keyof typeof pianoCollectionRu])
      expect(pianoEs[key as keyof typeof pianoEn]).toBe(pianoCollectionEs[key as keyof typeof pianoCollectionEs])
    }
  })

  it("name the source as the 50 PS collection", () => {
    expect(pianoCollectionRu["piano.by.collection"]).toContain("50 ПС")
    expect(pianoCollectionEn["piano.by.collection"]).toContain("50 PS")
    expect(pianoCollectionEs["piano.by.collection"]).toContain("50 PS")
  })
})
