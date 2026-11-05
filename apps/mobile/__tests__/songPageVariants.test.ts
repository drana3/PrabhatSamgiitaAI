import { describe, expect, it } from "vitest"

import { aboutRows, parseCompositionDate, WORDS_AND_MUSIC } from "@/lib/songPageVariants/aboutFacts"
import { alignLines, meaningLines, standsAlone } from "@/lib/songPageVariants/alignLines"
import { variantLayout, type SongFacts } from "@/lib/songPageVariants/layout"
import { meaningSourceFor, officialEnglishMeaning, storedMeaningRaw } from "@/lib/songPageVariants/meaningInfo"
import { foldLine, repeatsOf, splitStanzas } from "@/lib/songPageVariants/stanzas"
import { DEFAULT_VARIANT, parseVariant, resolveVariant } from "@/lib/songPageVariants/variant"
import { translateVariant } from "@/lib/songPageVariants/copy"
import { songVariantsEn, songVariantsEs, songVariantsRu } from "@/locales/songVariants"

// PS 2, the real lyrics of the catalogue
const PS2 = [
  "E gán ámár, álor jharańá dhárá",
  "Upala pathe dine ráte",
  "Bahe jái",
  "Bahe jái bándhana hárá",
  "Álor jharańá dhárá",
  "E gán ámár álor jharańá dhárá",
  "E path ámár bandhura kanťaka bhará",
  "Utsa hote práńera shrote",
  "Bheunge jái",
  "Bhenge jái páśáńa kárá",
  "Álor jharańá dhárá",
  "E gán ámár álor jharańá dhárá",
]

describe("variant query and choice", () => {
  it("reads a, b, c and current, in any case, ignoring spaces", () => {
    expect(parseVariant("a")).toBe("a")
    expect(parseVariant(" C ")).toBe("c")
    expect(parseVariant("Current")).toBe("current")
    expect(parseVariant(["b", "a"])).toBe("b")
  })

  it("rejects anything else", () => {
    expect(parseVariant("d")).toBeNull()
    expect(parseVariant("")).toBeNull()
    expect(parseVariant(undefined)).toBeNull()
    expect(parseVariant(2)).toBeNull()
    expect(parseVariant(["x"])).toBeNull()
  })

  it("defaults to B", () => {
    expect(DEFAULT_VARIANT).toBe("b")
    expect(resolveVariant({ mockup: true })).toBe("b")
  })

  it("in the preview the query beats the saved choice, which beats the default", () => {
    expect(resolveVariant({ mockup: true, query: "a", stored: "c" })).toBe("a")
    expect(resolveVariant({ mockup: true, query: "nonsense", stored: "c" })).toBe("c")
    expect(resolveVariant({ mockup: true, stored: "current" })).toBe("current")
    expect(resolveVariant({ mockup: true, stored: "zzz" })).toBe("b")
  })

  it("in a real build it is always B, whatever the link or the saved value says", () => {
    expect(resolveVariant({ mockup: false, query: "a", stored: "c" })).toBe("b")
    expect(resolveVariant({ mockup: false, query: "current" })).toBe("b")
  })
})

describe("alignLines", () => {
  it("pairs the lines when the counts are equal", () => {
    const result = alignLines(["Bandhu he", "Niye calo"], "Friend.\nLead me on.")
    expect(result).toEqual({
      kind: "pairs",
      pairs: [
        { line: "Bandhu he", meaning: "Friend." },
        { line: "Niye calo", meaning: "Lead me on." },
      ],
    })
  })

  it("ignores blank lines and spaces around lines", () => {
    const result = alignLines(["a", "b"], "  One. \n\n Two.  \n")
    expect(result.kind).toBe("pairs")
  })

  it("never pairs lines that run on, even when the counts match: PS 33 (real catalogue text)", () => {
    const lyrics = ["Tomár náme tomár gáne", "Hoyechi ápan hárá", "Ándhár páne calá pathik", "Peyeche álok dhárá"]
    const meaning = "In Your name,\nin Your song\nI have lost myself.\nThe traveler who was lost in the darkness"
    expect(alignLines(lyrics, meaning)).toEqual({ kind: "stacked", reason: "runs-on", lyricCount: 4, meaningCount: 4 })
  })

  it("standsAlone reads the first and the last character of a line", () => {
    expect(standsAlone("I have lost myself.")).toBe(true)
    expect(standsAlone('"I have smashed the walls."')).toBe(true)
    expect(standsAlone("In Your name,")).toBe(false)
    expect(standsAlone("in Your song.")).toBe(false)
    expect(standsAlone("has now found the stream of light")).toBe(false)
  })

  it("never pairs when the counts differ: PS 2 has 12 lyric lines and 18 meaning lines", () => {
    const meaning = Array.from({ length: 18 }, (_, i) => `line ${i}`).join("\n")
    expect(alignLines(PS2, meaning)).toEqual({ kind: "stacked", reason: "count-differs", lyricCount: 12, meaningCount: 18 })
  })

  it("does not pair a one-paragraph translation", () => {
    expect(alignLines(["a", "b", "c"], "One paragraph of text.").kind).toBe("stacked")
  })

  it("says why there is nothing to pair", () => {
    expect(alignLines(["a"], "")).toMatchObject({ kind: "stacked", reason: "no-meaning" })
    expect(alignLines(["a"], null)).toMatchObject({ kind: "stacked", reason: "no-meaning" })
    expect(alignLines([], "x")).toMatchObject({ kind: "stacked", reason: "no-lyrics" })
    expect(alignLines(["  "], "x")).toMatchObject({ kind: "stacked", reason: "no-lyrics" })
  })

  it("splits meaning text into trimmed non-empty lines", () => {
    expect(meaningLines("a\r\n b \n\n")).toEqual(["a", "b"])
    expect(meaningLines(undefined)).toEqual([])
  })
})

describe("stanzas and repeats", () => {
  it("folds accents, case and punctuation", () => {
    expect(foldLine("E gán ámár, álor")).toBe(foldLine("E GAN AMAR ALOR!"))
    expect(foldLine("  ,, ")).toBe("")
  })

  it("marks the lines that say an earlier line again", () => {
    const repeats = repeatsOf(PS2)
    expect(repeats[4]).toBeNull() // first time "Álor jharańá dhárá"
    expect(repeats[10]).toBe(4) // again
    expect(repeats[5]).toBe(0) // the first line returns, without the comma
    expect(repeats[11]).toBe(0)
    expect(repeats[1]).toBeNull()
  })

  it("splits PS 2 where the song returns to its first line and keeps the closing refrain with its stanza", () => {
    expect(splitStanzas(PS2)).toEqual([
      { from: 0, to: 4 },
      { from: 5, to: 11 },
    ])
  })

  it("is one stanza when the song never returns to its first line", () => {
    expect(splitStanzas(["a", "b", "c"])).toEqual([{ from: 0, to: 2 }])
  })

  it("does not split on a line that only repeats the line just sung", () => {
    expect(splitStanzas(["la la", "la la", "other"])).toEqual([{ from: 0, to: 2 }])
  })

  it("handles no lines", () => {
    expect(splitStanzas([])).toEqual([])
    expect(repeatsOf([])).toEqual([])
  })

  it("covers every line exactly once", () => {
    const stanzas = splitStanzas(PS2)
    const covered = stanzas.flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i))
    expect(covered).toEqual(PS2.map((_, i) => i))
  })
})

const facts = (over: Partial<SongFacts> = {}): SongFacts => ({
  hasLyrics: true,
  hasMeaning: true,
  hasWords: false,
  hasChords: false,
  hasVideo: false,
  hasNotationPdf: false,
  align: { kind: "stacked", reason: "count-differs", lyricCount: 12, meaningCount: 18 },
  ...over,
})
const pairsFacts = { kind: "pairs", pairs: [{ line: "a", meaning: "b" }] } as const

describe("section visibility per variant", () => {
  it("B is four tabs, with the meaning as its own tab", () => {
    const l = variantLayout("b", facts())
    expect(l.tabs).toEqual(["lyrics", "meaning", "play", "watch"])
    expect(l.meaning).toBe("tab")
  })

  it("B has no Meaning page content when the song has no meaning", () => {
    expect(variantLayout("b", facts({ hasMeaning: false })).meaning).toBe("none")
  })

  it("A is Read, Play, Watch, About; it pairs only when the lines align", () => {
    expect(variantLayout("a", facts()).tabs).toEqual(["read", "play", "watch", "about"])
    expect(variantLayout("a", facts()).meaning).toBe("stacked")
    expect(variantLayout("a", facts({ align: pairsFacts })).meaning).toBe("pairs")
  })

  it("A says why it is stacked only when the counts differ", () => {
    expect(variantLayout("a", facts()).stackedNote).toBe(true)
    expect(variantLayout("a", facts({ align: { kind: "stacked", reason: "no-meaning", lyricCount: 3, meaningCount: 0 }, hasMeaning: false })).stackedNote).toBe(false)
    expect(variantLayout("a", facts({ align: pairsFacts })).stackedNote).toBe(false)
  })

  it("A shows the meaning switch only when there is a meaning", () => {
    expect(variantLayout("a", facts()).meaningToggle).toBe(true)
    expect(variantLayout("a", facts({ hasMeaning: false })).meaningToggle).toBe(false)
    expect(variantLayout("a", facts({ hasMeaning: false })).meaning).toBe("none")
  })

  it("C has no tabs; stanza folds where the lines align, one fold otherwise", () => {
    expect(variantLayout("c", facts()).tabs).toEqual([])
    expect(variantLayout("c", facts()).meaning).toBe("stanza-single")
    expect(variantLayout("c", facts({ align: pairsFacts })).meaning).toBe("stanza-folds")
    expect(variantLayout("c", facts({ hasMeaning: false })).meaning).toBe("none")
  })

  it("the Words chip exists only with real word meanings; the note says so otherwise (A, B); C keeps its row", () => {
    for (const v of ["a", "b", "c"] as const) {
      expect(variantLayout(v, facts({ hasWords: true })).wordsChip).toBe(true)
      expect(variantLayout(v, facts()).wordsChip).toBe(false)
    }
    expect(variantLayout("a", facts()).wordsNote).toBe(true)
    expect(variantLayout("b", facts()).wordsNote).toBe(true)
    expect(variantLayout("b", facts({ hasWords: true })).wordsNote).toBe(false)
    expect(variantLayout("c", facts()).wordsNote).toBe(false)
    expect(variantLayout("c", facts()).wordsRow).toBe(true)
    expect(variantLayout("a", facts()).wordsRow).toBe(false)
  })

  it("chords are a chart only when a chart exists, else the honest empty state", () => {
    for (const v of ["a", "b", "c"] as const) {
      expect(variantLayout(v, facts()).chordsPanel).toBe("empty")
      expect(variantLayout(v, facts({ hasChords: true })).chordsPanel).toBe("chart")
    }
  })
})

describe("meaning source and honesty", () => {
  const base = { meaning: "", hindiMeaning: null, localizedMeanings: {}, themes: ["Song of Liberation"], lyrics: "E gán", title: "E gán" }

  it("English is official", () => {
    expect(meaningSourceFor(base, "en")).toBe("official")
  })

  it("a stored text in another language is reviewed; fetched ones are machine-assisted", () => {
    expect(meaningSourceFor({ ...base, hindiMeaning: "भाव" }, "hi")).toBe("reviewed")
    expect(meaningSourceFor({ ...base, localizedMeanings: { ru: "смысл" } }, "ru")).toBe("reviewed")
    expect(meaningSourceFor(base, "ru")).toBe("machine")
    expect(meaningSourceFor(base, "es")).toBe("machine")
  })

  it("keeps the line breaks of a stored text", () => {
    expect(storedMeaningRaw({ hindiMeaning: "a\nb", localizedMeanings: {} }, "hi")).toBe("a\nb")
    expect(storedMeaningRaw({ hindiMeaning: null, localizedMeanings: { es: " x " } }, "es")).toBe("x")
    expect(storedMeaningRaw({ hindiMeaning: null, localizedMeanings: {} }, "es")).toBeNull()
  })

  it("the stock sentence, the theme and the lyrics are not a meaning", () => {
    expect(officialEnglishMeaning({ ...base, meaning: "A song from the Prabhat Samgiita collection." })).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "Song of Liberation" })).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "E gán" })).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "" })).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "This song of mine is a fountain of effulgence." })).toBe(
      "This song of mine is a fountain of effulgence.",
    )
  })

  it("the catalogue's own english_meaning decides when it is known", () => {
    expect(officialEnglishMeaning({ ...base, meaning: "Song of Liberation" }, null)).toBeNull()
    expect(officialEnglishMeaning({ ...base, meaning: "x" }, "  real text ")).toBe("real text")
  })
})

describe("About this song: provable facts only", () => {
  it("reads day/month/year", () => {
    expect(parseCompositionDate("17/9/1982")).toEqual({ year: 1982, month: 9, day: 17 })
    expect(parseCompositionDate("1982")).toBeNull()
    expect(parseCompositionDate("31/13/1982")).toBeNull()
    expect(parseCompositionDate(undefined)).toBeNull()
  })

  it("lists what PS 2 has: words and music, date, theme, category, official recording, source", () => {
    const rows = aboutRows({
      metadata: { date: "17/9/1982", category: "K MUKTI GIITI", official_theme_label: "Song of Liberation", source: "official-lyrics-page" },
      recordings: [{ provider: "official" }],
    })
    expect(rows.map((r) => r.id)).toEqual(["words", "composed", "theme", "category", "recording", "source"])
    expect(rows[0]).toEqual({ id: "words", value: WORDS_AND_MUSIC })
    expect(rows[4]).toEqual({ id: "recording", kind: "official", count: 1 })
  })

  it("leaves out a row with no data, and never invents a performer, a duration or a place", () => {
    const rows = aboutRows({ metadata: null, recordings: [] })
    expect(rows).toEqual([{ id: "words", value: WORDS_AND_MUSIC }])
    expect(JSON.stringify(rows)).not.toMatch(/perform|5:00|duration|place/i)
  })

  it("gives the demo songs no recording row", () => {
    expect(aboutRows({ metadata: null, recordings: [{ provider: "official" }], demo: true }).some((r) => r.id === "recording")).toBe(false)
  })

  it("uses the catalogue theme when metadata has no official label", () => {
    expect(aboutRows({ metadata: {}, theme: "Devotion", recordings: [] }).find((r) => r.id === "theme")).toEqual({ id: "theme", value: "Devotion" })
  })
})

describe("song page variant strings", () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",")
  const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, "")

  it("ru and es have every English key, with the same variables", () => {
    for (const [lang, dict] of [["ru", songVariantsRu], ["es", songVariantsEs]] as Array<[string, Readonly<Record<string, string>>]>) {
      for (const [key, value] of Object.entries(songVariantsEn) as Array<[string, string]>) {
        expect(dict[key], `${lang} ${key}`).toBeTypeOf("string")
        expect(vars(dict[key] as string), `${lang} ${key} variables`).toBe(vars(value))
      }
    }
  })

  it("Russian has the four plural forms for counted strings", () => {
    const counted = new Set(Object.keys(songVariantsEn).filter((k) => /_one$/.test(k)).map(base))
    for (const key of counted) {
      for (const form of ["one", "few", "many", "other"]) expect(songVariantsRu[`${key}_${form}`], `${key}_${form}`).toBeTypeOf("string")
    }
  })

  it("picks the plural form and fills variables", () => {
    expect(translateVariant("en", "songVariant.watch.count", { count: 1 })).toBe("1 video on YouTube")
    expect(translateVariant("en", "songVariant.watch.count", { count: 2 })).toBe("2 videos on YouTube")
    expect(translateVariant("es", "songVariant.watch.count", { count: 3 })).toBe("3 videos en YouTube")
    expect(translateVariant("ru", "songVariant.stanza", { n: 2 })).toBe("Куплет 2")
  })

  it("never writes Kiirtan with one i", () => {
    for (const dict of [songVariantsEn, songVariantsRu, songVariantsEs]) {
      expect(JSON.stringify(dict)).not.toMatch(/Kirtan/i)
    }
  })
})
