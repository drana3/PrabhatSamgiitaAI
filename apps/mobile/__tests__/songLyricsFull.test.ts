import { describe, expect, it } from "vitest"

import { songLyricsFrom } from "@/lib/songChords/lyricLines"
import type { MockSong } from "@/data/mock"

/**
 * "Offer chords" must show the WHOLE song, every line of every stanza, not one verse. The text below is the catalogue's
 * own (PS 1370 is a long song with a refrain that comes back, PS 1 a short one of seven lines). The preview used to open a sample verse
 * of four lines for PS 1 and PS 3 instead; the editor now always reads the catalogue.
 */
const song = (number: number, lyrics: string, devanagari: string | null): MockSong => ({ number, title: `PS ${number}`, lyrics, transliteration: null, lyricsDevanagari: devanagari }) as unknown as MockSong

const PS_1370 = "NAYANERI AINJANA MÁNAS RAINJANA\nJANAME MARAŃE SÁTHI MOR\nTUMI, JANAME MARAŃE SÁTHI MOR\nMANJULA MAHÁKÁSHE AUNGA LÁVAŃII BHÁSE\nTOMÁTE HOYECHI VIBHOR\nJANAME MARAŃE SÁTHI MOR\nTUMI, JANAME MARAŃE SÁTHI MOR\nNAYANERI AINJANA MÁNAS RAINJANA\nJANAME MARAŃE SÁTHI MOR\nTUMI, JANAME MARAŃE SÁTHI MOR\nPRAPAINCA PARISARE TOMÁRI MÁYÁ MUKURE\nPRAPAINCA PARISARE TOMÁRI MÁYÁ MUKURE\nPRAPAINCA PARISARE TOMÁRI MÁYÁ MUKURE\nSAB KICHU RAŃITA SINJITA O NÚPURE\nÁNKHI TULE DHARO ÁMÁRE KARUŃÁ KARO\nSAB BHÁVE OGO CITA COR\nJANAME MARAŃE SÁTHI MOR\nTUMI, JANAME MARAŃE SÁTHI MOR\nNAYANERI AINJANA MÁNAS RAINJANA\nJANAME MARAŃE SÁTHI MOR\nTUMI, JANAME MARAŃE SÁTHI MOR\nKICHUI CÁHINÁ ÁMI TOMÁRI CARAŃE\nKICHUI CÁHINÁ ÁMI TOMÁRI CARAŃE\nKICHUI CÁHINÁ ÁMI TOMÁRI CARAŃE\nDÁO PARÁBHAKTI ÁTMA SAMARPAŃE\nTOMÁR ABHIIŚT́A ÁMÁR JE IŚT́A\nTUMI VIDHU ÁMI JE CAKOR\nJANAME MARAŃE SÁTHI MOR\nTUMI, JANAME MARAŃE SÁTHI MOR\nNAYANERI AINJANA MÁNAS RAINJANA\nJANAME MARAŃE SÁTHI MOR,\nTUMI, JANAME MARAŃE SÁTHI MOR"
const PS_1 = "BANDHU HE NIYE CALO\nÁLOR OI JHARAŃÁ DHÁRÁRA PÁNE\nBANDHU HE NIYE CALO\nÁNDHÁRER VYATHÁ ÁR SAYE NÁ PRÁŃE\nBANDHU HE NIYE CALO\nGHUMER GHOR BHÁḾGÁNOR GÁNE GÁNE\nBANDHU HE NIYE CALO"

describe("the lines offered for chords", () => {
  it("keeps every line of a long song (PS 1370: 32 lines, the refrain comes back many times)", () => {
    const lyrics = songLyricsFrom(song(1370, PS_1370, null))
    expect(lyrics.status).toBe("ready")
    if (lyrics.status !== "ready") return
    expect(lyrics.lines).toHaveLength(PS_1370.split("\n").filter((l) => l.trim()).length)
    expect(lyrics.lines.length).toBeGreaterThanOrEqual(30)
    // the repeated refrain lines are kept as separate lines, each with its own chord slots
    expect(lyrics.lines.filter((l) => /janame mara/i.test(l)).length).toBeGreaterThan(8)
    expect(lyrics.wordCounts).toHaveLength(lyrics.lines.length)
  })

  it("keeps every line of a short song too", () => {
    const lyrics = songLyricsFrom(song(1, PS_1, null))
    if (lyrics.status !== "ready") throw new Error("expected lines")
    expect(lyrics.lines).toHaveLength(PS_1.split("\n").filter((l) => l.trim()).length)
    expect(lyrics.lines.length).toBeGreaterThan(4) // the preview sample had four
  })

  it("takes the Roman text even when the Devanagari text is listed first or is the only longer one", () => {
    const lyrics = songLyricsFrom(song(1370, PS_1370, "नयनेरि अइन्जन\nजनमे मरणे"))
    if (lyrics.status !== "ready") throw new Error("expected lines")
    expect(lyrics.lines.length).toBeGreaterThanOrEqual(30)
  })

  it("says there are no Roman words when the song has none", () => {
    expect(songLyricsFrom(song(5, "", null)).status).toBe("none")
  })
})
