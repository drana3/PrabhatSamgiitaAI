import { describe, expect, it } from "vitest"

import {
  isLyricCatalogQuery,
  searchLyrics,
  searchMeanings,
  mergeLyricAndMeaningHits,
  isMeaningCatalogQuery,
  foldLyricPhonetic,
  canonicalSearchKey,
  catalogLookupKeys,
  stripCatalogSearchFraming,
  type LyricSearchRow,
} from "./lyric-search"

const rows: LyricSearchRow[] = [
  {
    n: 1,
    t: "BANDHU HE NIYE CALO",
    o: "BANDHU HE NIYE CALO",
    b: "bandhu he niye calo alor oi jharana dharara pane andharer vyatha ar saye na prane",
  },
  {
    n: 2,
    t: "E GAN AMAR",
    o: "E GAN AMAR ALOR JHARANA DHARA",
    b: "e gan amar alor jharana dhara tomar katha",
  },
]

describe("lyric search", () => {
  it("ranks an opening line first", () => {
    const hits = searchLyrics("BANDHU HE NIYE CALO", rows)
    expect(hits[0]?.number).toBe(1)
    expect(hits[0]?.matchedBy).toBe("opening_line")
    expect(hits[0]?.snippet).toMatch(/BANDHU HE NIYE CALO/i)
  })

  it("treats verse fragments as lyric catalog queries", () => {
    expect(isLyricCatalogQuery("bandhu he niye calo")).toBe(true)
    expect(
      isLyricCatalogQuery("alor oi jharana dharara pane andharer vyatha ar saye na prane"),
    ).toBe(true)
    expect(isLyricCatalogQuery("songs about peace")).toBe(false)
    expect(isLyricCatalogQuery("1")).toBe(false)
  })

  it("finds a line from inside the song", () => {
    const hits = searchLyrics("andharer vyatha ar saye na prane", rows)
    expect(hits.map((hit) => hit.number)).toContain(1)
    expect(hits[0]?.snippet.toLowerCase()).toContain("andharer vyatha")
  })

  it("ranks an ordered lyric phrase above common title-word bag matches", () => {
    const catalog: LyricSearchRow[] = [
      {
        n: 61,
        t: "AMI PARAN DHARIA DII TOMARI CARANE",
        o: "AMI PARAN DHARIA DII TOMARI CARANE",
        b: "ami paran dharia dii tomari carane",
      },
      {
        n: 3570,
        t: "JIIVANE MARANE",
        o: "JIIVANE MARANE",
        b: "jiivane marane jiivane marane tomakei ami jani aloke andhare tomakei shudhu cini",
      },
      {
        n: 4062,
        t: "JADU NAGARIYA SE",
        o: "JADU NAGARIYA SE",
        b: "jadu nagariya se jadu nagariya se",
      },
    ]
    expect(searchLyrics("Jivane marane tomake ami jani", catalog)[0]?.number).toBe(3570)
    expect(searchLyrics("Jadu nagariya", catalog)[0]?.number).toBe(4062)
  })

  it("treats common transliteration spellings as the same lyric", () => {
    expect(foldLyricPhonetic("humdardi")).toBe(foldLyricPhonetic("hamdardii"))
    expect(foldLyricPhonetic("chalo")).toBe(foldLyricPhonetic("calo"))
    expect(foldLyricPhonetic("siv")).toBe(foldLyricPhonetic("shiva"))
    expect(foldLyricPhonetic("shiv")).toBe(foldLyricPhonetic("shiva"))
    expect(canonicalSearchKey("siv")).toBe("shiva")
    expect(canonicalSearchKey("shiv")).toBe("shiva")
    expect(canonicalSearchKey("siva")).toBe("shiva")
    expect(canonicalSearchKey("kisna")).toBe("krsna")
    expect(canonicalSearchKey("kishna")).toBe("krsna")
    expect(canonicalSearchKey("krishna")).toBe("krsna")
    expect(canonicalSearchKey("kishan")).toBe("krsna")
    expect(stripCatalogSearchFraming("songs of siv")).toBe("siv")
    expect(catalogLookupKeys("songs of hindi")).toContain("hindi")
    const catalog: LyricSearchRow[] = [
      {
        n: 4170,
        t: "HAMDARDII IAH , KISANE DALII",
        o: "HAMDARDII IAH , KISANE DALII",
        b: "hamdardii iah kisane dalii tum ho meri hamdardii",
      },
      ...rows,
    ]
    expect(searchLyrics("hamdardi", catalog)[0]?.number).toBe(4170)
    expect(searchLyrics("humdardi", catalog)[0]?.number).toBe(4170)
    expect(searchLyrics("chalo", catalog).map((hit) => hit.number)).toContain(1)
    expect(searchLyrics("hamdrdi", catalog)[0]?.number).toBe(4170)
    expect(searchLyrics("bandu he niye calo", catalog)[0]?.number).toBe(1)
    expect(searchLyrics("pandhu he niye calo", catalog)[0]?.number).toBe(1)
    expect(searchLyrics("bnadhu", catalog)[0]?.number).toBe(1)
    expect(searchLyrics("kalo", catalog).map((hit) => hit.number)).toContain(1)
    expect(searchLyrics("vandhu", catalog)[0]?.number).toBe(1)
  })

  it("does not treat English meaning translations as lyrics", () => {
    const hits = searchLyrics("i can no longer bear the pain of darkness in my heart", rows)
    expect(hits.map((hit) => hit.number)).not.toContain(1)
  })

  it("finds English meaning text via searchMeanings without touching lyric body", () => {
    const withMeaning: LyricSearchRow[] = [
      {
        ...rows[0],
        e: "o friend lead me on i can no longer bear the pain of darkness in my heart",
      },
      rows[1],
    ]
    expect(searchLyrics("i can no longer bear the pain of darkness in my heart", withMeaning)).toHaveLength(0)
    const meaningHits = searchMeanings("i can no longer bear the pain of darkness in my heart", withMeaning)
    expect(meaningHits[0]?.number).toBe(1)
    expect(meaningHits[0]?.matchedBy).toBe("meaning")
    const merged = mergeLyricAndMeaningHits(
      searchLyrics("bandhu he niye calo", withMeaning),
      meaningHits,
    )
    expect(merged[0]?.matchedBy).toBe("opening_line")
    expect(merged[0]?.number).toBe(1)
  })

  it("treats english prose as a meaning catalog query", () => {
    expect(isMeaningCatalogQuery("who came without telling me")).toBe(true)
    expect(isMeaningCatalogQuery("i can no longer bear the pain of darkness")).toBe(true)
    expect(isMeaningCatalogQuery("bandhu he")).toBe(false)
    expect(isMeaningCatalogQuery("songs about peace")).toBe(false)
    expect(isMeaningCatalogQuery("I am feeling stressful today")).toBe(false)
  })

  it("returns at most five songs", () => {
    const extra = Array.from({ length: 8 }, (_, index) => ({
      n: index + 10,
      t: "peace song",
      o: "peace song",
      b: "peace in the heart peace in the mind",
    }))
    expect(searchLyrics("peace", [...rows, ...extra])).toHaveLength(5)
  })
})
