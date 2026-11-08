import { fingeringFor, parseChord } from "./chords"

/**
 * Chord arithmetic exactly as the design prototype does it (Main.dc.html, `renderVals`, "song page").
 * Names use the prototype's spelling: C C# D Eb E F F# G Ab A Bb B. A capo on fret N lowers every
 * shape by N semitones; the harmonium key moves the chart up from its base key.
 */
export const SP_NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const

const mod12 = (n: number) => ((n % 12) + 12) % 12

/** Open shapes of the prototype; every other shape counts as a barre chord. */
export const SP_OPEN_SHAPES = ["C", "D", "E", "G", "A", "Am", "Dm", "Em"] as const

/** Fret strings (low E to high e, x = muted) of the prototype's chord table. */
export const SP_FRETS: Record<string, string> = {
  C: "x32010",
  "C#": "x46664",
  D: "xx0232",
  Eb: "x68886",
  E: "022100",
  F: "133211",
  "F#": "244322",
  G: "320003",
  Ab: "466544",
  A: "x02220",
  Bb: "x13331",
  B: "x24442",
  Am: "x02210",
  "C#m": "x46654",
  Dm: "xx0231",
  Ebm: "x68876",
  Em: "022000",
  Fm: "133111",
  "F#m": "244222",
  Gm: "355333",
  Abm: "466444",
  Bbm: "x13321",
  Bm: "x24432",
  Cm: "x35543",
}

/** Move a chord by `semitones` and spell it the prototype's way. Unreadable names come back unchanged. */
export function spTranspose(chord: string, semitones: number): string {
  const parsed = parseChord(chord)
  if (!parsed) return chord
  const bass = parsed.bass == null ? "" : `/${SP_NOTES[mod12(parsed.bass + semitones)]}`
  return `${SP_NOTES[mod12(parsed.root + semitones)]}${parsed.suffix}${bass}`
}

/** What the fingers play for a sounding chord with the capo on fret `capo` (`gName`). */
export function spShape(sounding: string, capo: number): string {
  return spTranspose(sounding, -capo)
}

/** Pitch class of a key name such as "D", "Eb" or "D#". */
export function keyPitch(key: string): number {
  const parsed = parseChord(key)
  return parsed ? parsed.root : 0
}

/** The harmonium keys of the prototype run C to G; the store keeps D# where the prototype shows Eb. */
export function keyLabel(key: string): string {
  return SP_NOTES[keyPitch(key)] ?? key
}

export function isOpenShape(name: string): boolean {
  return (SP_OPEN_SHAPES as readonly string[]).includes(name)
}

/** Distinct chords in the order they first appear. */
export function uniqueChords(chords: string[]): string[] {
  return chords.filter((chord, index) => chords.indexOf(chord) === index)
}

export function barreCountAt(sounding: string[], capo: number): number {
  return sounding.filter((chord) => !isOpenShape(spShape(chord, capo))).length
}

/** The capo (0 to 7) with the fewest barre shapes; ties go to the lower fret (`bestCapo`). */
export function spBestCapo(sounding: string[]): number {
  const chords = uniqueChords(sounding)
  let best = 0
  for (let capo = 1; capo <= 7; capo += 1) {
    if (barreCountAt(chords, capo) < barreCountAt(chords, best)) best = capo
  }
  return best
}

export function capoHint(sounding: string[], capo: number): { text: string; action: string } {
  const chords = uniqueChords(sounding)
  const best = spBestCapo(chords)
  if (best === capo) {
    return {
      text: barreCountAt(chords, capo) ? "Fewest barre chords for this song." : "All open shapes: the easiest capo for this song.",
      action: "",
    }
  }
  return {
    text: `Easiest shapes: capo ${best}${barreCountAt(chords, best) ? "." : ", all open chords."}`,
    action: "Use it",
  }
}

export function capoName(capo: number): string {
  return capo ? String(capo) : "Off"
}

/** The line under "Capo" (`keyNote`, guitar). */
export function guitarKeyNote(sounding: string[], capo: number): string {
  const chords = uniqueChords(sounding)
  if (!capo) return "No capo. Chords sound as written."
  return `Capo ${capo}. You play ${chords.map((c) => spShape(c, capo)).join(" ")}. It sounds ${chords.join(" ")}.`
}

export type ChordCard = { name: string; sub: string; frets: string }

/** One card per distinct chord: shape name, `sounds X · barre` / `barre` / `open`, and its fret string. */
export function shapeCards(sounding: string[], capo: number): ChordCard[] {
  return uniqueChords(sounding).map((chord) => {
    const name = spShape(chord, capo)
    const barre = !isOpenShape(name)
    const sub = capo ? `sounds ${chord}${barre ? " · barre" : ""}` : barre ? "barre" : "open"
    return { name, sub, frets: SP_FRETS[name] ?? fingeringFor(name) ?? "xxxxxx" }
  })
}

export type DiagramPaths = { grid: string; dots: string; open: string; mute: string; bar: string; nut: string; fl: string }

/** SVG path data of one chord box in the prototype's 74 x 76 viewBox (`diag`). */
export function diagramPaths(frets: string): DiagramPaths {
  const fr = frets.split("").map((ch) => (ch === "x" ? -1 : parseInt(ch, 10)))
  const pl = fr.filter((v) => v > 0)
  const mx = pl.length ? Math.max(...pl) : 0
  const mn = pl.length ? Math.min(...pl) : 1
  const st = mx <= 4 ? 1 : mn
  const X = (i: number) => 18 + i * 9
  const Y = (r: number) => 16 + r * 13
  let grid = ""
  let dots = ""
  let open = ""
  let mute = ""
  let bar = ""
  for (let i = 0; i < 6; i += 1) grid += `M${X(i)} ${Y(0)}V${Y(4)}`
  for (let k = 1; k < 5; k += 1) grid += `M${X(0)} ${Y(k)}H${X(5)}`
  fr.forEach((v, i) => {
    const x = X(i)
    if (v === -1) mute += `M${x - 2.8} 5.5l5.6 5.6M${x + 2.8} 5.5l-5.6 5.6`
    else if (v === 0) open += `M${x - 3} 8.5a3 3 0 1 0 6 0a3 3 0 1 0-6 0`
    else {
      const cy = Y(v - st) + 6.5
      dots += `M${x - 3.8} ${cy}a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0`
    }
  })
  if (pl.length) {
    const a = fr.indexOf(mn)
    const z = fr.lastIndexOf(mn)
    if (z - a >= 2) bar = `M${X(a)} ${Y(mn - st) + 6.5}H${X(z)}`
  }
  return { grid, dots, open, mute, bar, nut: st === 1 ? `M${X(0) - 1} ${Y(0)}H${X(5) + 1}` : "", fl: st > 1 ? `${st}fr` : "" }
}

/** Whether a diagram should draw the barre bar: the prototype skips it for open shapes. */
export function diagramFor(name: string, frets: string): DiagramPaths {
  const paths = diagramPaths(frets)
  return isOpenShape(name) ? { ...paths, bar: "" } : paths
}

/* ---------- harmonium ---------- */

export const SP_SWARAS = ["Sa", "Re", "Ga", "Ma", "Pa", "Dha", "Ni"] as const
const MAJOR = [0, 2, 4, 5, 7, 9, 11]

/** Swara and the note it falls on for the chosen Sa (`swaras`). */
export function swaraRow(sa: string): Array<{ s: string; n: string }> {
  const base = keyPitch(sa)
  return SP_SWARAS.map((s, i) => ({ s, n: SP_NOTES[mod12(base + MAJOR[i])] }))
}

const SHARP_ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const FLAT_ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const
/** Major keys with sharps (G D A E B F#) and with flats (F Bb Eb Ab Db Gb), as pitch classes. */
const SHARP_KEY_PITCHES = new Set([7, 2, 9, 4, 11, 6])
const FLAT_KEY_PITCHES = new Set([5, 10, 3, 8])

/** How a harmonium chart is spelled once it stands in Sa `key`: sharps in a sharp key, flats in a flat one, the song page's own names otherwise. */
function harmoniumNames(key: string): readonly string[] {
  const pitch = keyPitch(key)
  const flatWritten = /^[A-G][b♭]/.test(key.trim())
  if (flatWritten || FLAT_KEY_PITCHES.has(pitch)) return FLAT_ROOTS
  if (SHARP_KEY_PITCHES.has(pitch)) return SHARP_ROOTS
  return SP_NOTES
}

/**
 * A chord shown on the harmonium: moved from the chart's key to the chosen Sa. The pitch is plain arithmetic; the NAME
 * follows the key a musician would write it in: in Sa = E the chord is G#m, never Abm, and in Sa = Bb it is Eb, never D#.
 * With no move (the reader's Sa is the author's) the chord comes back exactly as the author typed it.
 */
export function harmoniumChord(chord: string, baseKey: string | undefined, key: string): string {
  const shift = mod12(keyPitch(key) - keyPitch(baseKey ?? "C"))
  if (shift === 0) return chord
  const parsed = parseChord(chord)
  if (!parsed) return chord
  const names = harmoniumNames(key)
  const bass = parsed.bass == null ? "" : `/${names[mod12(parsed.bass + shift)]}`
  return `${names[mod12(parsed.root + shift)]}${parsed.suffix}${bass}`
}

/** The swara printed under a word (prototype placeholder rhythm: `(line * 3 + word) % 7`). */
export function swaraAt(line: number, word: number): string {
  return SP_SWARAS[(line * 3 + word) % 7]
}

export function strumNote(instrument: "guitar" | "harmonium", strum: string | undefined): string {
  if (instrument === "guitar") {
    return `Chord letters sit above the word where you change. Strum: ${(strum ?? "").replace(/ +/g, " ")}`.trim()
  }
  return "Chord letters sit above the word where you change. The swara to play sits under each word."
}

export function harmoniumKeyNote(key: string): string {
  return `Sa is ${keyLabel(key)} on the harmonium`
}

/** `chordChip` under the tools row. */
export function chordChipText(instrument: "guitar" | "harmonium", capo: number, key: string): string {
  return instrument === "guitar" ? `Guitar chords · capo ${capoName(capo)}` : `Harmonium chords · key ${keyLabel(key)}`
}
