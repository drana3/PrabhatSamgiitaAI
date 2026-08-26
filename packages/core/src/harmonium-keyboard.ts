import { type SheetPlayEvent, westernToHz } from "./notation-sheet"

/** Western tonics supported for Sa selection. */
export const HARMONIUM_TONICS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const

export type HarmoniumTonic = (typeof HARMONIUM_TONICS)[number]
export type SwaraOctave = "lower" | "middle" | "upper"

export type HarmoniumKeyboardKey = {
  token: string
  latin: string
  devanagari: string
  shortcut: string
  western: string
  keyLabel: string
  frequencyHz: number
}

export type ParsedSwara = {
  token: string
  octave: SwaraOctave
  western: string
  frequencyHz: number
}

/** Shuddha major scale semitone steps from Sa (matches common learner harmoniums). */
export const SHUDDHA_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12] as const

const KEYBOARD_SWARAS = [
  { token: "S", latin: "Sa", devanagari: "सा", shortcut: "Z" },
  { token: "R", latin: "Re", devanagari: "रे", shortcut: "X" },
  { token: "G", latin: "Ga", devanagari: "ग", shortcut: "C" },
  { token: "m", latin: "Ma", devanagari: "म", shortcut: "V" },
  { token: "P", latin: "Pa", devanagari: "प", shortcut: "B" },
  { token: "D", latin: "Dha", devanagari: "ध", shortcut: "N" },
  { token: "N", latin: "Ni", devanagari: "नि", shortcut: "M" },
  { token: "S", latin: "Sa′", devanagari: "सां", shortcut: "," },
] as const

const SWARA_SEMITONES: Record<string, number> = {
  S: 0,
  s: 0,
  r: 1,
  R: 2,
  g: 3,
  G: 4,
  m: 5,
  M: 6,
  P: 7,
  p: 7,
  d: 8,
  D: 9,
  n: 10,
  N: 11,
}

const LATIN_ALIASES: Record<string, string> = {
  sa: "S",
  re: "R",
  ga: "G",
  ma: "m",
  pa: "P",
  dha: "D",
  ni: "N",
}

const DEVANAGARI_SWARAS: Array<{ text: string; token: string; octave: SwaraOctave }> = [
  { text: "सां", token: "S", octave: "upper" },
  { text: "सा", token: "S", octave: "middle" },
  { text: "रे॒", token: "r", octave: "middle" },
  { text: "रे", token: "R", octave: "middle" },
  { text: "ग॒", token: "g", octave: "middle" },
  { text: "ग", token: "G", octave: "middle" },
  { text: "म॑", token: "M", octave: "middle" },
  { text: "म", token: "m", octave: "middle" },
  { text: "प", token: "P", octave: "middle" },
  { text: "ध॒", token: "d", octave: "middle" },
  { text: "ध", token: "D", octave: "middle" },
  { text: "नि॒", token: "n", octave: "middle" },
  { text: "नि", token: "N", octave: "middle" },
]

export const SARGAM_EXAMPLES = [
  "Sa Re Ga Ma Pa Dha Ni Sa′",
  "सा रे ग म प ध नि सां",
  "S R G m P D N S",
] as const

function tonicIndex(tonic: string): number {
  const idx = HARMONIUM_TONICS.indexOf(tonic as HarmoniumTonic)
  return idx >= 0 ? idx : 0
}

function tonicMidiBase(tonic: string, octave = 4): number {
  return (octave + 1) * 12 + tonicIndex(tonic)
}

/** Map tonic + semitone offset to a western pitch in the sample bank range. */
export function semitonesToWestern(tonic: string, semitones: number, octave = 4): string {
  const midi = Math.max(48, Math.min(84, Math.round(tonicMidiBase(tonic, octave) + semitones)))
  const note = midi % 12
  const outOctave = Math.floor(midi / 12) - 1
  return `${HARMONIUM_TONICS[note]}${outOctave}`
}

export function westernKeyLabel(western: string): string {
  return western.replace(/\d+$/, "")
}

export function normalizeSwaraToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === "-" || trimmed === "–") return null
  const lowered = trimmed.toLowerCase().replace(/['′`]/g, "")
  if (lowered in LATIN_ALIASES) return LATIN_ALIASES[lowered]
  if (trimmed in SWARA_SEMITONES) return trimmed
  const first = trimmed[0]
  if (first && first in SWARA_SEMITONES) return first
  return null
}

function octaveFromToken(raw: string): SwaraOctave {
  if (/['′`]|ं$|san$/i.test(raw.trim())) return "upper"
  if (/^\.|_/.test(raw.trim())) return "lower"
  return "middle"
}

function parseDevanagariToken(text: string): { token: string; octave: SwaraOctave; length: number } | null {
  for (const entry of DEVANAGARI_SWARAS) {
    if (text.startsWith(entry.text)) {
      return { token: entry.token, octave: entry.octave, length: entry.text.length }
    }
  }
  return null
}

/** Parse learner sargam text (Latin, Devanagari, or OCR tokens). */
export function parseSargamInput(text: string, tonic: string): ParsedSwara[] {
  const input = text.trim()
  if (!input) return []

  const out: ParsedSwara[] = []
  let index = 0
  while (index < input.length) {
    const ch = input[index]
    if (!ch || /\s|[,·|/]/.test(ch)) {
      index += 1
      continue
    }

    const devanagari = parseDevanagariToken(input.slice(index))
    if (devanagari) {
      const western = swaraToWestern(tonic, devanagari.token, devanagari.octave)
      const frequencyHz = western ? westernToHz(western) : null
      if (western && frequencyHz) {
        out.push({
          token: devanagari.token,
          octave: devanagari.octave,
          western,
          frequencyHz,
        })
      }
      index += devanagari.length
      continue
    }

    const chunk = input.slice(index).match(/^[\p{L}\p{M}'′`._-]+/u)?.[0] ?? input[index]
    const octave = octaveFromToken(chunk)
    const token = normalizeSwaraToken(chunk)
    if (token) {
      const resolvedOctave = /['′`]/i.test(chunk) ? "upper" : octave
      const western = swaraToWestern(tonic, token, resolvedOctave)
      const frequencyHz = western ? westernToHz(western) : null
      if (western && frequencyHz) {
        out.push({ token, octave: resolvedOctave, western, frequencyHz })
      }
    }
    index += chunk.length
  }

  return out
}

export function swaraToWestern(tonic: string, token: string, octave: SwaraOctave = "middle"): string | null {
  const offset = SWARA_SEMITONES[token]
  if (offset == null) return null
  const octaveShift = octave === "lower" ? -12 : octave === "upper" ? 12 : 0
  return semitonesToWestern(tonic, offset + octaveShift, 4)
}

/** Eight-key shuddha layout used by global virtual harmonium apps. */
export function harmoniumKeyboardLayout(tonic: string): HarmoniumKeyboardKey[] {
  return KEYBOARD_SWARAS.map((swara, index) => {
    const western = semitonesToWestern(tonic, SHUDDHA_SCALE_STEPS[index] ?? 0, 4)
    const frequencyHz = westernToHz(western) ?? 0
    return {
      ...swara,
      western,
      keyLabel: westernKeyLabel(western),
      frequencyHz,
    }
  })
}

export function sargamPlayEvents(
  tonic: string,
  text: string,
  noteSec = 0.42,
  gapSec = 0.08,
): SheetPlayEvent[] {
  const swaras = parseSargamInput(text, tonic)
  let cursor = 0
  return swaras.map((swara) => {
    const event: SheetPlayEvent = {
      western: swara.western,
      frequencyHz: swara.frequencyHz,
      startSec: cursor,
      durationSec: noteSec,
    }
    cursor += noteSec + gapSec
    return event
  })
}

export function shortcutForKeyIndex(index: number): string | null {
  return KEYBOARD_SWARAS[index]?.shortcut ?? null
}

export function keyboardIndexForShortcut(key: string): number {
  const normalized = key.length === 1 ? key.toUpperCase() : key
  return KEYBOARD_SWARAS.findIndex((swara) => swara.shortcut.toUpperCase() === normalized)
}
