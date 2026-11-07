import { parseChord } from "@/lib/songPage/chords"
import { SP_NOTES } from "@/lib/songPage/spChords"

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const

const mod12 = (n: number) => ((n % 12) + 12) % 12

type Style = "sharp" | "flat" | "plain"

/** How a name was written: C# is sharp, Db is flat, C is plain (it has no mark to keep). */
function styleOf(note: string): Style {
  if (/[#♯]/.test(note)) return "sharp"
  if (/[b♭]/.test(note.slice(1))) return "flat"
  return "plain"
}

function spell(pitch: number, style: Style): string {
  const table = style === "sharp" ? SHARP : style === "flat" ? FLAT : SP_NOTES
  return table[mod12(pitch)]
}

/**
 * Move a chord by `semitones` and keep the way its player wrote it. G#m a capo away is still spelled with a sharp, Db with
 * a flat; a plain letter that has to take a mark gets the song page's spelling (Eb, Ab, Bb, C#, F#). Zero is "no move": the
 * name comes back exactly as typed. A name the song page cannot read comes back unchanged.
 *
 * `spTranspose` (the song page's own) always respells, so G#m would turn into Abm and a chart would no longer read like the one
 * its author wrote. The editor and the stored chart go through this instead.
 */
export function shiftChord(chord: string, semitones: number): string {
  if (semitones === 0) return chord
  const parsed = parseChord(chord)
  if (!parsed) return chord
  const text = chord.trim()
  const slash = text.indexOf("/")
  const rootMark = text.slice(0, 2)
  const root = spell(parsed.root + semitones, styleOf(rootMark.length > 1 ? rootMark : text[0]))
  const bass = parsed.bass == null ? "" : `/${spell(parsed.bass + semitones, styleOf(text.slice(slash + 1, slash + 3)))}`
  return `${root}${parsed.suffix}${bass}`
}
