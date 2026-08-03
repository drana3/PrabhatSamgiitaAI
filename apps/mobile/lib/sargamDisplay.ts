import type { TransposedNotation } from "@prabhat/core"

export type NotationLine = TransposedNotation["notation"]["lines"][number]
export type NotationNote = NotationLine["measures"][number]["beats"][number]["notes"][number]

const DEVANAGARI_BY_SARGAM: Record<string, string> = {
  S: "सा",
  r: "रे",
  R: "रे",
  g: "ग",
  G: "ग",
  m: "म",
  M: "म",
  P: "प",
  d: "ध",
  D: "ध",
  n: "न",
  N: "न",
}

const LATIN_BY_SARGAM: Record<string, string> = {
  S: "Sa",
  r: "re",
  R: "Re",
  g: "ga",
  G: "Ga",
  m: "ma",
  M: "Ma",
  P: "Pa",
  d: "dha",
  D: "Dha",
  n: "ni",
  N: "Ni",
}

export type DisplayNote = {
  sargam: string
  latin: string
  devanagari: string
  key: string
  octave: "lower" | "middle" | "upper"
}

export function lineNotes(line: NotationLine): NotationNote[] {
  return line.measures.flatMap((measure) => measure.beats.flatMap((beat) => beat.notes))
}

export function normalizeSargamToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ""
  if (trimmed.length === 1) return trimmed
  const first = trimmed[0]
  if (first in DEVANAGARI_BY_SARGAM) return first
  const lowered = trimmed.toLowerCase()
  const aliases: Record<string, string> = {
    sa: "S",
    re: "R",
    ga: "G",
    ma: "m",
    pa: "P",
    dha: "D",
    ni: "N",
  }
  return aliases[lowered] ?? trimmed
}

export function toDevanagariSwara(token: string): string {
  const normalized = normalizeSargamToken(token)
  return DEVANAGARI_BY_SARGAM[normalized] ?? token
}

export function toLatinSwara(token: string): string {
  const normalized = normalizeSargamToken(token)
  return LATIN_BY_SARGAM[normalized] ?? token
}

export function harmoniumKeyLabel(western: string | null | undefined, fallbackSargam?: string): string {
  if (western) {
    const match = western.match(/^([A-G](?:#|b)?)/i)
    if (match?.[1]) return match[1].toUpperCase().replace("B", "b")
  }
  return fallbackSargam ? toLatinSwara(fallbackSargam) : "–"
}

export function buildDisplayNotes(line: NotationLine): DisplayNote[] {
  return lineNotes(line).map((note) => {
    const sargam = normalizeSargamToken(note.sargam)
    return {
      sargam,
      latin: toLatinSwara(sargam),
      devanagari: toDevanagariSwara(sargam),
      key: harmoniumKeyLabel(note.western, sargam),
      octave: note.octave ?? "middle",
    }
  })
}

export function formatPracticeSequence(
  notes: DisplayNote[],
  field: keyof Pick<DisplayNote, "devanagari" | "latin" | "key">,
): string {
  if (!notes.length) return "–"
  return notes.map((note) => note[field]).join(" · ")
}

export function splitLyricLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function resolveLineLyrics(
  notationLine: NotationLine,
  lineIndex: number,
  songLyricLines: string[],
): { roman: string } {
  const roman = songLyricLines[lineIndex]?.trim() || notationLine.lyrics.trim()
  return { roman }
}

export function distributeNotesToWords(
  words: string[],
  notes: DisplayNote[],
): Array<{ word: string; notes: DisplayNote[] }> {
  if (!words.length || !notes.length) return []
  if (words.length === 1) return [{ word: words[0], notes }]
  if (words.length === notes.length) {
    return words.map((word, index) => ({ word, notes: [notes[index]] }))
  }

  const groups: Array<{ word: string; notes: DisplayNote[] }> = []
  let cursor = 0
  for (let index = 0; index < words.length; index += 1) {
    const remainingWords = words.length - index
    const remainingNotes = notes.length - cursor
    const take = Math.max(1, Math.round(remainingNotes / remainingWords))
    groups.push({
      word: words[index],
      notes: notes.slice(cursor, cursor + take),
    })
    cursor += take
  }
  return groups
}
