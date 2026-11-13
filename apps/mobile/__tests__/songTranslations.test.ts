import { describe, expect, it } from "vitest"

import {
  activeLineKind,
  kindsOf,
  lineKinds,
  mergeTranslations,
  officialFromRaw,
  pickKind,
  splitOfficialVersions,
  underLines,
  versionsOf,
} from "@/lib/songTranslations/derive"
import { fetchSongTranslations, listFromWire, translationFromWire, type WireList, type WireTranslation } from "@/lib/songTranslations/remote"
import type { SongTranslation } from "@/lib/songTranslations/types"

const wire = (over: Partial<WireTranslation> = {}): WireTranslation => ({
  id: "t1",
  song_id: 19,
  kind: "poetic",
  language: "en",
  position: 0,
  alignment: "whole",
  segments: [{ from: 0, to: null, text: "A poetic text." }],
  text: "A poetic text.",
  label: "reviewed",
  checked: false,
  credit_line: null,
  commentary: null,
  ...over,
})

const item = (over: Partial<SongTranslation> = {}): SongTranslation => ({
  id: "x",
  kind: "literal",
  language: "en",
  position: 0,
  alignment: "line",
  segments: [],
  text: "t",
  label: "checked",
  checked: true,
  creditLine: null,
  commentary: null,
  derived: false,
  ...over,
})

describe("official translations from the catalogue text", () => {
  it("one text is one official translation", () => {
    const rows = officialFromRaw(19, "In Your name,\nin Your song.")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ kind: "official", position: 0, alignment: "whole", checked: false, label: "official", derived: true })
    expect(rows[0]?.text).toBe("In Your name,\nin Your song.")
  })

  it("a second version, joined by a line of dashes, is kept: it is the 'Other version'", () => {
    expect(splitOfficialVersions("First one.\nStill first.\n-----\nSecond one.")).toEqual(["First one.\nStill first.", "Second one."])
    const rows = officialFromRaw(7, "A.\n-----\nB.")
    expect(rows.map((r) => [r.position, r.text])).toEqual([[0, "A."], [1, "B."]])
  })

  it("splits like the server does: windows line ends, spaces around the dashes, a dash inside a sentence", () => {
    expect(splitOfficialVersions("A.\r\n  ---------  \r\nB.")).toEqual(["A.", "B."])
    expect(splitOfficialVersions("A - B -- C.")).toEqual(["A - B -- C."])
  })

  it("nothing for an empty, blank or missing text", () => {
    expect(splitOfficialVersions("")).toEqual([])
    expect(splitOfficialVersions("  \n ")).toEqual([])
    expect(splitOfficialVersions(null)).toEqual([])
    expect(officialFromRaw(1, undefined)).toEqual([])
  })
})

describe("what the page works with", () => {
  it("the server's official text wins; the catalogue's is only the fallback", () => {
    const remote = listFromWire({ song_id: 19, language: "en", kinds: ["official"], items: [wire({ kind: "official", label: "official", text: "From the server." })] } as WireList)
    const merged = mergeTranslations({ songId: 19, remote, officialRaw: "From the catalogue." })
    expect(merged.items.map((i) => i.text)).toEqual(["From the server."])
    expect(merged.items.every((i) => !i.derived)).toBe(true)
  })

  it("with no server answer, the official text is made from the catalogue", () => {
    const merged = mergeTranslations({ songId: 19, remote: null, officialRaw: "From the catalogue." })
    expect(merged.kinds).toEqual(["official"])
    expect(merged.items[0]?.derived).toBe(true)
  })

  it("keeps poetic and literal from the server beside the derived official, in the page's order", () => {
    const remote = listFromWire({
      song_id: 19,
      language: "en",
      kinds: ["poetic", "literal"],
      items: [wire({ id: "p" }), wire({ id: "l", kind: "literal", label: "checked", checked: true, alignment: "line" })],
    } as WireList)
    const merged = mergeTranslations({ songId: 19, remote, officialRaw: "Official." })
    expect(merged.kinds).toEqual(["official", "poetic", "literal"])
    expect(merged.items.map((i) => i.kind)).toEqual(["official", "poetic", "literal"])
  })

  it("a song with nothing has no kinds", () => {
    expect(mergeTranslations({ songId: 5, remote: null, officialRaw: null }).kinds).toEqual([])
  })

  it("the kinds are listed in the page's order", () => {
    expect(kindsOf([{ kind: "literal" }, { kind: "official" }, { kind: "official" }])).toEqual(["official", "literal"])
  })
})

describe("the kind the Translation page opens on", () => {
  it("is the reader's choice when the song has it", () => {
    expect(pickKind("poetic", ["official", "poetic"])).toBe("poetic")
    expect(pickKind("literal", ["official", "poetic", "literal"])).toBe("literal")
  })

  it("is Official otherwise, then Literal, and Poetic is never the default", () => {
    expect(pickKind("poetic", ["official", "literal"])).toBe("official")
    expect(pickKind("official", ["poetic", "literal"])).toBe("literal")
    expect(pickKind(null, ["poetic"])).toBe("poetic")
    expect(pickKind("official", ["official", "poetic", "literal"])).toBe("official")
    expect(pickKind(undefined, ["official", "poetic", "literal"])).toBe("official")
  })

  it("is nothing when the song has no translation", () => {
    expect(pickKind("official", [])).toBeNull()
  })

  it("the first text of a kind is the translation, the others are 'Other version'", () => {
    const rows = [item({ id: "b", kind: "official", position: 1 }), item({ id: "a", kind: "official", position: 0 }), item({ id: "c", kind: "poetic" })]
    expect(versionsOf(rows, "official").map((r) => r.id)).toEqual(["a", "b"])
    expect(versionsOf(rows, null)).toEqual([])
  })
})

describe("translation under each line", () => {
  it("offers Literal and Poetic only, and only what the song has: Official is not selectable", () => {
    expect(lineKinds(["official", "poetic", "literal"])).toEqual(["literal", "poetic"])
    expect(lineKinds(["official", "poetic"])).toEqual(["poetic"])
    expect(lineKinds(["official"])).toEqual([])
    expect(lineKinds([])).toEqual([])
  })

  it("is off by default and when the kind chosen earlier is missing for this song", () => {
    expect(activeLineKind("off", ["literal"])).toBeNull()
    expect(activeLineKind("poetic", ["official", "literal"])).toBeNull()
    expect(activeLineKind("literal", ["official", "literal"])).toBe("literal")
  })

  it("puts a line's text under that line, and a run of lines' text under the run's last line", () => {
    const t = item({
      alignment: "stanza",
      segments: [
        { from: 0, to: 0, text: "One." },
        { from: 1, to: 3, text: "Two to four." },
        { from: 4, to: null, text: "The rest." },
      ],
    })
    expect(underLines(t, 8)).toEqual({ kind: "lines", under: { 0: "One.", 3: "Two to four.", 7: "The rest." } })
  })

  it("never cuts a whole-song text into lines: it says so instead", () => {
    expect(underLines(item({ alignment: "whole", segments: [{ from: 0, to: null, text: "All." }] }), 8)).toEqual({ kind: "whole" })
  })

  it("ignores a segment that starts past the lyrics and a blank one", () => {
    const t = item({ segments: [{ from: 20, to: 21, text: "Nowhere." }, { from: 1, to: 1, text: "  " }, { from: 2, to: 2, text: "Here." }] })
    expect(underLines(t, 5)).toEqual({ kind: "lines", under: { 2: "Here." } })
    expect(underLines(item({ segments: [{ from: 20, to: 21, text: "Nowhere." }] }), 5)).toEqual({ kind: "none" })
  })

  it("is nothing without a translation or lyrics", () => {
    expect(underLines(null, 5)).toEqual({ kind: "none" })
    expect(underLines(item(), 0)).toEqual({ kind: "none" })
  })

  it("clamps a range that runs past the last line to the last line", () => {
    expect(underLines(item({ segments: [{ from: 1, to: 99, text: "Long." }] }), 4)).toEqual({ kind: "lines", under: { 3: "Long." } })
  })
})

describe("reading the server's answer", () => {
  it("the Checked mark is true only when the server says the team checked it", () => {
    expect(translationFromWire(wire({ kind: "literal", label: "checked", checked: true }))?.checked).toBe(true)
    expect(translationFromWire(wire({ kind: "literal", label: "reviewed", checked: true }))?.checked).toBe(false)
    expect(translationFromWire(wire({ label: "official", checked: false }))?.checked).toBe(false)
    expect(translationFromWire(wire({ label: "checked", checked: false }))?.checked).toBe(false)
  })

  it("trims the commentary and the credit; an empty one is null so the block is not drawn", () => {
    expect(translationFromWire(wire({ commentary: "   ", credit_line: " " }))).toMatchObject({ commentary: null, creditLine: null })
    expect(translationFromWire(wire({ commentary: "  A note.  ", credit_line: " Team " }))).toMatchObject({ commentary: "A note.", creditLine: "Team" })
  })

  it("drops what the app cannot show: an unknown kind, an empty text", () => {
    expect(translationFromWire(wire({ kind: "karaoke" }))).toBeNull()
    expect(translationFromWire(wire({ text: " ", segments: [] }))).toBeNull()
  })

  it("builds the text from the segments when the answer carries none", () => {
    expect(translationFromWire(wire({ text: "", segments: [{ from: 0, to: 0, text: "A" }, { from: 1, to: 1, text: "B" }], alignment: "line" }))?.text).toBe("A\nB")
  })

  it("falls back to 'whole' for an alignment it does not know", () => {
    expect(translationFromWire(wire({ alignment: "word" }))?.alignment).toBe("whole")
  })

  it("keeps the kinds in the page's order", () => {
    const list = listFromWire({ song_id: 1, language: "en", kinds: [], items: [wire({ kind: "literal", id: "a" }), wire({ kind: "official", id: "b" })] })
    expect(list.kinds).toEqual(["official", "literal"])
  })
})

describe("asking the server", () => {
  const answer = (body: unknown, ok = true) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch

  it("asks for the song and the language", async () => {
    const calls: string[] = []
    const fake = (async (url: string) => {
      calls.push(url)
      return { ok: true, json: async () => ({ song_id: 19, language: "en", kinds: [], items: [] }) }
    }) as unknown as typeof fetch
    await fetchSongTranslations({ baseUrl: "https://api.example/", fetch: fake }, 19)
    expect(calls).toEqual(["https://api.example/api/v1/song-translations/songs/19?language=en"])
  })

  it("is null when the server cannot be reached or does not know the endpoint yet", async () => {
    expect(await fetchSongTranslations({ baseUrl: "http://x", fetch: answer({}, false) }, 1)).toBeNull()
    const broken = (async () => {
      throw new Error("offline")
    }) as unknown as typeof fetch
    expect(await fetchSongTranslations({ baseUrl: "http://x", fetch: broken }, 1)).toBeNull()
  })

  it("returns the list", async () => {
    const list = await fetchSongTranslations({ baseUrl: "http://x", fetch: answer({ song_id: 19, language: "en", kinds: ["poetic"], items: [wire()] }) }, 19)
    expect(list?.items.map((i) => i.kind)).toEqual(["poetic"])
  })
})
