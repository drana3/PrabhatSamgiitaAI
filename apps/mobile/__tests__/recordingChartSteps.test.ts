import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { chartFormSteps } from "@/lib/recordingChords/chart"
import { dictionaries } from "@/locales"

describe("the chart form goes words first, then chords, then send", () => {
  it("no chords can be placed until the words are in", () => {
    expect(chartFormSteps({ hasText: false, askingForText: true })).toEqual({ current: 1, showChords: false })
  })
  it("changing the words takes the chord step away again", () => {
    expect(chartFormSteps({ hasText: true, askingForText: true })).toEqual({ current: 1, showChords: false })
  })
  it("with words accepted the chord step opens", () => {
    expect(chartFormSteps({ hasText: true, askingForText: false })).toEqual({ current: 2, showChords: true })
  })
  it("the screen shows the three step titles and puts the chord editor only behind the words step", () => {
    const source = readFileSync(join(__dirname, "..", "app", "recording-chart.tsx"), "utf8")
    const at = (needle: string) => source.indexOf(needle)
    expect(at("recChart.step.lyrics")).toBeGreaterThan(-1)
    expect(at("recChart.step.lyrics")).toBeLessThan(at("recChart.step.chords"))
    expect(at("recChart.step.chords")).toBeLessThan(at("recChart.step.send"))
    expect(at("{showChords ? (")).toBeGreaterThan(at("recChart.step.lyrics"))
    expect(at("{showChords ? (")).toBeLessThan(at("<ChordEntryField"))
  })
  it("the step titles exist in every language", () => {
    for (const language of ["en", "ru", "es"] as const) {
      for (const key of ["recChart.step.lyrics", "recChart.step.chords", "recChart.step.send"] as const) {
        expect(dictionaries[language][key], `${language}:${key}`).toBeTruthy()
      }
    }
  })
})
