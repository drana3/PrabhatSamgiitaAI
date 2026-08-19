import type { TransposedNotation } from "@prabhat/core"

export type NotationLine = TransposedNotation["notation"]["lines"][number]
export type NotationNote = NotationLine["measures"][number]["beats"][number]["notes"][number]

/**
 * Learner-facing Hindi Sargam translated from Andromeda Bengali swaralipi.
 * कोमल = ॒ · तीव्र म = ॑ · मंद = ̱ · तार = ं
 */
const HINDI_BY_SARGAM: Record<string, string> = {
  S: "सा",
  r: "रे॒",
  R: "रे",
  g: "ग॒",
  G: "ग",
  m: "म",
  M: "म॑",
  P: "प",
  d: "ध॒",
  D: "ध",
  n: "नि॒",
  N: "नि",
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

export type SargamOctave = "lower" | "middle" | "upper"

export type DisplayNote = {
  sargam: string
  latin: string
  devanagari: string
  key: string
  octave: SargamOctave
}

export function lineNotes(line: NotationLine): NotationNote[] {
  return line.measures.flatMap((measure) => measure.beats.flatMap((beat) => beat.notes))
}

export function normalizeSargamToken(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ""
  if (trimmed.length === 1) return trimmed
  const first = trimmed[0]
  if (first in HINDI_BY_SARGAM) return first
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

export function applyHindiOctave(swara: string, octave: SargamOctave = "middle"): string {
  if (!swara) return swara
  if (octave === "lower") return `${swara}\u0331`
  if (octave === "upper") return `${swara}ं`
  return swara
}

export function toDevanagariSwara(token: string, octave: SargamOctave = "middle"): string {
  const normalized = normalizeSargamToken(token)
  const base = HINDI_BY_SARGAM[normalized] ?? token
  return applyHindiOctave(base, octave)
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
    const octave = note.octave ?? "middle"
    return {
      sargam,
      latin: toLatinSwara(sargam),
      devanagari: toDevanagariSwara(sargam, octave),
      key: harmoniumKeyLabel(note.western, sargam),
      octave,
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

export function isBengaliText(text: string | null | undefined): boolean {
  return Boolean(text && /[\u0980-\u09FF]/.test(text))
}

export function practiceLyricSource(options: {
  lyricsOriginal?: string | null
  transliteration?: string | null
  firstLine?: string | null
}): { practiceText: string; originalText: string | null } {
  const original = options.lyricsOriginal?.trim() || null
  const roman = options.transliteration?.trim() || null
  if (original && isBengaliText(original) && roman) {
    return { practiceText: roman, originalText: original }
  }
  return {
    practiceText: original || roman || options.firstLine?.trim() || "",
    originalText: original && roman && original !== roman ? original : original,
  }
}

export function splitLyricLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  const byNewline = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (byNewline.length > 1) return byNewline
  const byPunct = text
    .split(/\s*(?:\||।|॥|\/)\s*/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (byPunct.length > 1) return byPunct
  return byNewline
}

export function alignNotationToSongLines(
  notationLines: NotationLine[],
  songLyricLines: string[],
): Array<{ line: NotationLine | null; lineIndex: number }> {
  if (!songLyricLines.length && !notationLines.length) return []
  if (!songLyricLines.length) {
    return notationLines.map((line, lineIndex) => ({ line, lineIndex }))
  }
  if (!notationLines.length) {
    return songLyricLines.map((_, lineIndex) => ({ line: null, lineIndex }))
  }
  const count = Math.max(songLyricLines.length, notationLines.length)
  return Array.from({ length: count }, (_, lineIndex) => ({
    line: notationLines[lineIndex] ?? null,
    lineIndex,
  }))
}

export function notationCoverage(
  notationLineCount: number,
  songLyricLineCount: number,
): { covered: number; total: number; incomplete: boolean } {
  const total = Math.max(notationLineCount, songLyricLineCount)
  const covered = Math.min(notationLineCount, songLyricLineCount || notationLineCount)
  return {
    covered,
    total,
    incomplete: songLyricLineCount > 0 && notationLineCount < songLyricLineCount,
  }
}

export function resolveLineLyrics(
  notationLine: NotationLine,
  lineIndex: number,
  songLyricLines: string[],
  originalLyricLines: string[] = [],
): { roman: string; original: string | null } {
  const roman = songLyricLines[lineIndex]?.trim() || notationLine.lyrics.trim()
  const original = originalLyricLines[lineIndex]?.trim() || null
  return { roman, original }
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

export const HINDI_SARGAM_LEGEND =
  "बंगाली स्वरलिपि → हिंदी सारगम: सा रे ग म प ध नि · कोमल (रे॒ ग॒ ध॒ नि॒) · तीव्र म (म॑) · तार पर ं"
