import { describe, expect, it } from "vitest"

import { songPageEn, songPageEs, songPageRu } from "@/locales/songPage"
import { ACTION_IDS, ACTION_LEGEND_KEYS, downloadCaptionKey, saveTapPlan, savedCaptionKey } from "@/lib/songPage/actionLegend"
import { capoBadgeKey, easierCapo, membersRowKey, pianoRowKey, soundsInKey } from "@/lib/songPage/chordsTab"
import { translatePage } from "@/lib/songPage/pageCopy"
import { DEFAULT_TAB, DEFAULT_WORDS_MODE, SONG_TABS, TAB_LABEL_KEY, TAB_STRIP_HEIGHT, WORDS_MODES, isSongTab, isWordsMode, meaningKind, scrollOnSelect, songTabFromParam } from "@/lib/songPage/songTabs"

describe("the five tabs of the song page", () => {
  it("are always Lyrics, Meaning, Chords, Video, Info in this order, Lyrics first", () => {
    expect([...SONG_TABS]).toEqual(["lyrics", "meaning", "chords", "video", "info"])
    expect(DEFAULT_TAB).toBe("lyrics")
  })

  it("each has a label that exists in every language", () => {
    for (const tab of SONG_TABS) {
      const key = TAB_LABEL_KEY[tab]
      expect(songPageEn[key as keyof typeof songPageEn], `en ${key}`).toBeTruthy()
      expect(songPageRu[key], `ru ${key}`).toBeTruthy()
      expect(songPageEs[key as keyof typeof songPageEs], `es ${key}`).toBeTruthy()
    }
  })

  it("know a tab from any other word", () => {
    expect(isSongTab("meaning")).toBe(true)
    expect(isSongTab("words")).toBe(false)
    expect(isSongTab("recordings")).toBe(false)
    expect(isSongTab(undefined)).toBe(false)
    expect(isWordsMode("translation")).toBe(true)
    expect(isWordsMode("lyrics")).toBe(false)
  })

  it("a link made with the old name of the tab (words) still lands on Meaning", () => {
    expect(songTabFromParam("words")).toBe("meaning")
    expect(songTabFromParam("meaning")).toBe("meaning")
    expect(songTabFromParam("chords")).toBe("chords")
    expect(songTabFromParam("nonsense")).toBe(null)
    expect(songTabFromParam(["chords"])).toBe(null)
    expect(songTabFromParam(undefined)).toBe(null)
  })

  it("the tab is called Meaning, Смысл, Significado", () => {
    expect(translatePage("en", TAB_LABEL_KEY.meaning)).toBe("Meaning")
    expect(translatePage("ru", TAB_LABEL_KEY.meaning)).toBe("Смысл")
    expect(translatePage("es", TAB_LABEL_KEY.meaning)).toBe("Significado")
  })

  it("Meaning shows one translation: the official one, else Poetic, else whatever the song has", () => {
    expect(meaningKind(["poetic", "official", "literal"])).toBe("official")
    expect(meaningKind(["literal", "poetic"])).toBe("poetic")
    expect(meaningKind(["literal"])).toBe("literal")
    expect(meaningKind([])).toBe(null)
  })

  it("Meaning holds two pages, the translation first", () => {
    expect([...WORDS_MODES]).toEqual(["translation", "words"])
    expect(DEFAULT_WORDS_MODE).toBe("translation")
  })

  it("a tap on a tab brings its content under the switch, from above or from further down the page", () => {
    expect(TAB_STRIP_HEIGHT).toBe(48)
    expect(scrollOnSelect(0, 420)).toBe(420)
    expect(scrollOnSelect(300, 420)).toBe(420)
    expect(scrollOnSelect(419, 420)).toBe(null)
    expect(scrollOnSelect(900, 420)).toBe(420)
    expect(scrollOnSelect(420, 420)).toBe(null)
    expect(scrollOnSelect(0, -10)).toBe(null)
  })
})

describe("the legend of the icons under the title", () => {
  it("has the five icons in the order of the row", () => {
    expect([...ACTION_IDS]).toEqual(["saved", "download", "playlist", "share", "more"])
    expect(ACTION_LEGEND_KEYS.map((row) => row.id)).toEqual([...ACTION_IDS])
  })

  it("gives every icon a word and a plain line in English, Russian and Spanish", () => {
    for (const row of ACTION_LEGEND_KEYS) {
      for (const key of [row.caption, row.help]) {
        expect(songPageEn[key as keyof typeof songPageEn], `en ${key}`).toBeTruthy()
        expect(songPageRu[key], `ru ${key}`).toBeTruthy()
        expect(songPageEs[key as keyof typeof songPageEs], `es ${key}`).toBeTruthy()
      }
    }
  })

  it("one tap saves an unsaved song to Mine; a saved song opens the sheet", () => {
    expect(saveTapPlan(false)).toBe("save-to-mine")
    expect(saveTapPlan(true)).toBe("open-sheet")
  })

  it("the word under Save and Download follows their state", () => {
    expect(savedCaptionKey(false)).toBe("songAct.save.caption")
    expect(savedCaptionKey(true)).toBe("songAct.saved.caption")
    expect(downloadCaptionKey("idle")).toBe("songAct.download.caption")
    expect(downloadCaptionKey("downloading")).toBe("songAct.download.caption.busy")
    expect(downloadCaptionKey("done")).toBe("songAct.download.caption.done")
    expect(translatePage("en", "songAct.download.caption.busy", { percent: 40 })).toBe("40%")
  })

  it("never says Save and Add to playlist in the same word", () => {
    expect(translatePage("en", "songAct.save.caption")).not.toBe(translatePage("en", "songAct.playlist.caption"))
    expect(translatePage("en", "songAct.saved.caption")).not.toBe(translatePage("en", "songAct.playlist.caption"))
  })
})

describe("the chords card", () => {
  it("says what the song sounds in: the chart's key, else its first chord, else nothing", () => {
    expect(soundsInKey("D", ["Am", "G"])).toBe("D")
    expect(soundsInKey(undefined, ["Am", "G"])).toBe("Am")
    expect(soundsInKey("  ", ["G"])).toBe("G")
    expect(soundsInKey(undefined, [])).toBe(null)
  })

  it("offers an easier capo only when it differs from the one set", () => {
    // Bm F#m A: barres everywhere with no capo, open shapes with a capo on 2 (Am Em G)
    const chords = ["Bm", "F#m", "A"]
    const best = easierCapo(chords, 0)
    expect(best).not.toBe(null)
    expect(easierCapo(chords, best as number)).toBe(null)
  })

  it("names the capo badge by the fret, or that there is none", () => {
    expect(capoBadgeKey(0)).toBe("songChords.capoOff")
    expect(capoBadgeKey(2)).toBe("songChords.capo")
    expect(translatePage("en", "songChords.capo", { capo: 2 })).toBe("Capo 2")
    expect(translatePage("en", "songChords.sounds", { key: "D" })).toBe("Sounds in D")
    expect(translatePage("en", "songChords.easier", { capo: 5 })).toBe("Easier: capo 5")
  })

  it("a row with nothing behind it says only its name", () => {
    expect(membersRowKey(0)).toBe("songChords.members.none")
    expect(membersRowKey(3)).toBe("songChords.members.row")
    expect(pianoRowKey(0)).toBe("songChords.piano.none")
    expect(translatePage("en", "songChords.members.row", { count: 3 })).toBe("Chords by members · 3")
    expect(translatePage("en", "songChords.piano.row", { count: 1 })).toBe("Piano notes · 1 version")
    expect(translatePage("en", "songChords.piano.row", { count: 2 })).toBe("Piano notes · 2 versions")
    expect(translatePage("ru", "songChords.piano.row", { count: 2 })).toBe("Ноты для пианино · 2 варианта")
    expect(translatePage("ru", "songChords.piano.row", { count: 5 })).toBe("Ноты для пианино · 5 вариантов")
  })
})

describe("the recordings row", () => {
  it("counts in the right plural form", () => {
    expect(translatePage("en", "songRec.row", { count: 1 })).toBe("1 recording")
    expect(translatePage("en", "songRec.row", { count: 6 })).toBe("6 recordings")
    expect(translatePage("ru", "songRec.row", { count: 6 })).toBe("6 записей")
    expect(translatePage("ru", "songRec.row", { count: 3 })).toBe("3 записи")
    expect(translatePage("es", "songRec.row", { count: 6 })).toBe("6 grabaciones")
  })
})
