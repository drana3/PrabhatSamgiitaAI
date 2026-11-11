import { describe, expect, it } from "vitest"

import { buildSongPdfHtml, planFor, sheetPlan } from "@/lib/songPdf/html"
import { pdfFileName } from "@/lib/songPdf/share"
import { DEFAULT_PDF_OPTIONS, PDF_THEMES, PDF_VARIANTS, type PdfSongInput } from "@/lib/songPdf/types"

const song: PdfSongInput = {
  number: 1,
  title: "Bandhu he niye calo",
  composed: "14 Sep 1982",
  raga: null,
  tala: null,
  photo: null,
  romanLines: ["Bandhu he niye calo", "Álor oi jharańá"],
  linesByScript: { roman: ["Bandhu he niye calo", "Álor oi jharańá"], devanagari: ["बंधु हे निये चलो", "आलोर ओइ झरणा"] },
  glosses: { byLanguage: { en: { "0:0": "friend", "0:1": "O", "0:2": "take", "0:3": "lead on" }, ru: { "0:0": "друг" } } },
  translations: { en: "O dearest Friend, lead me on.\n\nLead me to the fountain of effulgence.", ru: "О Друг, веди меня." },
}

describe("the song PDF", () => {
  it("has four layouts, and each one builds a page with the number, the title and the brand fonts", () => {
    expect([...PDF_VARIANTS]).toEqual(["sheet", "study", "reader", "singing", "projector"])
    for (const variant of PDF_VARIANTS) {
      const { html } = buildSongPdfHtml(song, { ...DEFAULT_PDF_OPTIONS, variant })
      expect(html, variant).toContain("№ 1")
      expect(html, variant).toContain("Bandhu")
    }
  })

  it("has five looks, and each one wears every layout with its own fonts, and puts the photo in the head when it has one", () => {
    expect([...PDF_THEMES]).toEqual(["dawn", "night", "hymnal", "poster", "mono"])
    const fonts = new Set<string>()
    for (const theme of PDF_THEMES) {
      for (const variant of PDF_VARIANTS) {
        const { html } = buildSongPdfHtml({ ...song, photo: "data:image/jpeg;base64,AAAA" }, { ...DEFAULT_PDF_OPTIONS, variant, theme })
        expect(html, `${theme}/${variant}`).toContain("data:image/jpeg;base64,AAAA")
        expect(html, `${theme}/${variant}`).toContain("№ 1".replace("№ ", theme === "dawn" || theme === "night" ? "№ " : ""))
        fonts.add(/href="([^"]+)"/.exec(html)?.[1] ?? "")
      }
    }
    expect(fonts.size).toBe(5)
    expect(buildSongPdfHtml(song, { ...DEFAULT_PDF_OPTIONS, theme: "poster" }).html).not.toContain("url('null')")
  })

  it("uses none of the banned fonts and never a cream paper", () => {
    for (const theme of PDF_THEMES) {
      const { html } = buildSongPdfHtml(song, { ...DEFAULT_PDF_OPTIONS, theme })
      expect(html, theme).not.toMatch(/Inter\b|Roboto|Open Sans|Lato|Arial,|Space Grotesk|Fraunces/)
    }
  })

  it("puts the meaning under its word, and leaves an empty line for a word without one (nothing is invented)", () => {
    const { html } = buildSongPdfHtml(song, DEFAULT_PDF_OPTIONS)
    expect(html).toContain('<span class="g">friend</span>')
    expect(html).toContain('<span class="r">jharańá</span><span class="g"></span>')
  })

  it("stacks several word languages under a word and skips a language the song has no meaning in", () => {
    const options = { ...DEFAULT_PDF_OPTIONS, wordLanguages: ["en", "ru", "es"] }
    const { html, plan } = buildSongPdfHtml(song, options)
    expect(html).toContain('<span class="g">friend</span><span class="g">друг</span>')
    expect(plan.wordLanguages).toEqual(["en", "ru"])
    expect(plan.missing.wordLanguages).toEqual(["es"])
  })

  it("prints each chosen translation under its own language name, and says which one the song has no text in", () => {
    const plan = planFor(song, { ...DEFAULT_PDF_OPTIONS, translationLanguages: ["en", "ru", "hi"] })
    expect(plan.translations.map((t) => t.code)).toEqual(["en", "ru"])
    expect(plan.translations[0].blocks).toHaveLength(2)
    expect(plan.missing.translations).toEqual(["hi"])
    const { html } = buildSongPdfHtml(song, { ...DEFAULT_PDF_OPTIONS, variant: "reader", translationLanguages: ["en", "ru"] })
    expect(html).toContain("Russian")
    expect(html).toContain("О Друг, веди меня.")
  })

  it("prints the chosen script, and no word meanings when the words of that script do not line up with the Roman ones", () => {
    const bad: PdfSongInput = { ...song, linesByScript: { ...song.linesByScript, devanagari: ["बंधु हे निये", "आलोर ओइ झरणा"] } }
    const { html } = buildSongPdfHtml(bad, { ...DEFAULT_PDF_OPTIONS, script: "devanagari" })
    expect(html).toContain("आलोर")
    expect(html).not.toContain("friend")
  })

  it("the singing layout has the song only, the reader is portrait, the others landscape", () => {
    const sing = buildSongPdfHtml(song, { ...DEFAULT_PDF_OPTIONS, variant: "singing" })
    expect(sing.html).not.toContain("O dearest Friend")
    expect(buildSongPdfHtml(song, { ...DEFAULT_PDF_OPTIONS, variant: "reader" }).page).toBe("portrait")
    expect(buildSongPdfHtml(song, DEFAULT_PDF_OPTIONS).page).toBe("landscape")
  })

  it("escapes what the catalogue gives it", () => {
    const { html } = buildSongPdfHtml({ ...song, title: "A <b> & B" }, DEFAULT_PDF_OPTIONS)
    expect(html).toContain("A &lt;b&gt; &amp; B")
  })

  it("names the file after the song", () => {
    expect(pdfFileName(song)).toBe("ps-1-bandhu-he-niye-calo.pdf")
    expect(pdfFileName({ number: 7, title: "Ámi tomáy" })).toBe("ps-7-ami-tomay.pdf")
  })
})

import { groupLanguages, summaryOf, toggleCode } from "@/lib/songPdf/languages"

describe("the language menu rules", () => {
  it("toggles in the order chosen", () => {
    expect(toggleCode(["en"], "ru")).toEqual(["en", "ru"])
    expect(toggleCode(["en", "ru"], "en")).toEqual(["ru"])
  })
  it("lists what the song has first (chosen ones on top), then what is not there yet", () => {
    const g = groupLanguages(["en", "ru", "es"], ["ru"], "")
    expect(g.inSong.map((l) => l.code)).toEqual(["ru", "en", "es"])
    expect(g.notYet.map((l) => l.code)).toContain("hi")
    expect(g.notYet.map((l) => l.code)).not.toContain("en")
  })
  it("searches by the English name, the native name and the code, with or without accents", () => {
    expect(groupLanguages(["en", "ru"], [], "рус").inSong.map((l) => l.code)).toEqual(["ru"])
    expect(groupLanguages(["en", "ru"], [], "span").notYet.map((l) => l.code)).toEqual(["es"])
    expect(groupLanguages([], [], "zh").notYet.map((l) => l.code)).toEqual(["zh-CN", "zh-TW"])
  })
  it("summarises a long choice as two names and a count", () => {
    expect(summaryOf(["en", "ru", "es"])).toEqual({ names: "English · Русский", more: 1 })
    expect(summaryOf([])).toEqual({ names: "", more: 0 })
  })
})

describe("a language the app does not list", () => {
  it("is named when it is a known one and kept by its code otherwise", () => {
    const g = groupLanguages(["en", "fr", "xx"], [], "")
    expect(g.inSong.find((l) => l.code === "fr")).toMatchObject({ name: "French", native: "Français" })
    expect(g.inSong.find((l) => l.code === "xx")).toMatchObject({ name: "xx", native: "xx" })
  })

  it("makes projector slides: a cover, a slide per stanza, 16:9, type sized to the line", () => {
    for (const theme of PDF_THEMES) {
      const out = buildSongPdfHtml({ ...song, photo: "data:image/jpeg;base64,AAAA" }, { ...DEFAULT_PDF_OPTIONS, variant: "projector", theme })
      expect(out.page, theme).toBe("stage")
      expect(out.html, theme).toContain("@page{size:297mm 167mm;margin:0}")
      expect((out.html.match(/<section class="s/g) ?? []).length, theme).toBeGreaterThanOrEqual(3)
      const sizes = [...out.html.matchAll(/--fs:(\d+)pt/g)].map((m) => Number(m[1]))
      expect(sizes.length, theme).toBeGreaterThan(0)
      for (const size of sizes) expect(size, theme).toBeGreaterThanOrEqual(24)
    }
  })

  it("takes the PDF language from the app: Russian in a Russian app, English otherwise, English when the song lacks it", async () => {
    const { pdfLanguages } = await import("@/lib/songPdf/languages")
    const have = { words: ["en", "ru"], translations: ["en", "ru"] }
    expect(pdfLanguages("ru", have)).toMatchObject({ language: "ru", words: ["ru"], translations: ["ru"], fellBack: false })
    expect(pdfLanguages("en", have)).toMatchObject({ language: "en", words: ["en"], translations: ["en"], fellBack: false })
    expect(pdfLanguages("es", have).translations).toEqual(["en"])
    const onlyEn = pdfLanguages("ru", { words: ["en"], translations: ["en"] })
    expect(onlyEn).toMatchObject({ words: ["en"], translations: ["en"], fellBack: true })
    expect(pdfLanguages("ru", { words: [], translations: [] })).toMatchObject({ words: [], translations: [], fellBack: false })
  })

  it("fits the Sheet on one page: the type shrinks as the song grows, the song moves into two columns, and the photo band slims down", () => {
    const make = (lineCount: number, trLines: number): PdfSongInput => {
      const lines = Array.from({ length: lineCount }, (_, i) => `Tumi ámár prabhu tomáy ${i}`)
      const tr = Array.from({ length: trLines }, (_, i) => `Translation line number ${i} of the song`).join("\n")
      return { ...song, romanLines: lines, linesByScript: { roman: lines }, glosses: null, translations: { en: tr } }
    }
    const short = sheetPlan(make(6, 6), DEFAULT_PDF_OPTIONS)
    const median = sheetPlan(make(20, 14), DEFAULT_PDF_OPTIONS)
    const longest = sheetPlan(make(41, 56), DEFAULT_PDF_OPTIONS)
    expect(short.k).toBeGreaterThan(median.k)
    expect(median.k).toBeGreaterThan(longest.k)
    expect(short.k).toBeGreaterThan(0.85)
    expect(median.k).toBeGreaterThanOrEqual(0.5)
    expect(median.mode).not.toBe("wide")
    expect(longest.k).toBeGreaterThan(0)
    const { html } = buildSongPdfHtml(make(41, 56), DEFAULT_PDF_OPTIONS)
    expect(html).toContain(`--k:${longest.k}`)
    expect(html).toContain("class=\"sky\"")
  })

  it("lets a caller force the Sheet's layout, which is how the model was checked against a real render", () => {
    const { html } = buildSongPdfHtml(song, { ...DEFAULT_PDF_OPTIONS, fit: { k: 0.5, kt: 0.4, mode: "dense", band: "slim" } })
    expect(html).toContain("--k:0.5;--kt:0.4")
    expect(html).toContain('class="dense"')
  })
})
