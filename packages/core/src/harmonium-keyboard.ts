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
  isBlack: boolean
  isSa: boolean
  whiteIndex: number
  blackLeftPercent: number
}

export type ParsedSwara = {
  token: string
  octave: SwaraOctave
  western: string
  frequencyHz: number
}

/** Shuddha major scale semitone steps from Sa (matches common learner harmoniums). */
export const SHUDDHA_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12] as const

/** 12-pitch sargam names, indexed by semitones above Sa. */
const SWARA_CHROMA = [
  { token: "S", latin: "Sa", devanagari: "सा" },
  { token: "r", latin: "re", devanagari: "रे॒" },
  { token: "R", latin: "Re", devanagari: "रे" },
  { token: "g", latin: "ga", devanagari: "ग॒" },
  { token: "G", latin: "Ga", devanagari: "ग" },
  { token: "m", latin: "Ma", devanagari: "म" },
  { token: "M", latin: "Ma♯", devanagari: "म॑" },
  { token: "P", latin: "Pa", devanagari: "प" },
  { token: "d", latin: "dha", devanagari: "ध॒" },
  { token: "D", latin: "Dha", devanagari: "ध" },
  { token: "n", latin: "ni", devanagari: "नि॒" },
  { token: "N", latin: "Ni", devanagari: "नि" },
] as const

/** Physical piano/harmonium black keys (C# D# F# G# A#). */
const PIANO_BLACK_PC = new Set([1, 3, 6, 8, 10])

/**
 * Laptop map from https://web-harmonium.com/harmonium-notes
 * Middle whites: E R T Y U I O P (Sa Re Ga Ma Pa Dha Ni Sa′)
 * Middle blacks: 4 5 7 8 9 (komal Re/Ga, tivra Ma, komal Dha/Ni)
 */
const CHROMATIC_SHORTCUTS = [
  "z", "3", "x", "d", "c", "v", "g", "s", "1", "q", "2", "w",
  "e", "4", "r", "5", "t", "y", "7", "u", "8", "i", "9", "o",
  "p",
] as const

const KEYBOARD_KEY_COUNT = 25 // mandra Sa through taar Sa

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
  { text: "रे़", token: "r", octave: "middle" },
  { text: "रे॒", token: "r", octave: "middle" },
  { text: "रे", token: "R", octave: "middle" },
  { text: "ग़", token: "g", octave: "middle" },
  { text: "ग॒", token: "g", octave: "middle" },
  { text: "ग", token: "G", octave: "middle" },
  { text: "म॑", token: "M", octave: "middle" },
  { text: "म", token: "m", octave: "middle" },
  { text: "प", token: "P", octave: "middle" },
  { text: "ध़", token: "d", octave: "middle" },
  { text: "ध॒", token: "d", octave: "middle" },
  { text: "ध", token: "D", octave: "middle" },
  { text: "नी़", token: "n", octave: "middle" },
  { text: "नि़", token: "n", octave: "middle" },
  { text: "नि॒", token: "n", octave: "middle" },
  { text: "नी", token: "N", octave: "middle" },
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
  return midiToPitch(midi)
}

export function westernToMidi(western: string): number | null {
  const match = western.trim().match(/^([A-G]#?)(-?\d+)$/)
  if (!match) return null
  const pc = HARMONIUM_TONICS.indexOf(match[1] as (typeof HARMONIUM_TONICS)[number])
  if (pc < 0) return null
  return (Number(match[2]) + 1) * 12 + pc
}

function midiToPitch(midi: number): string {
  const clipped = Math.max(36, Math.min(84, Math.round(midi)))
  const note = ((clipped % 12) + 12) % 12
  const outOctave = Math.floor(clipped / 12) - 1
  return `${HARMONIUM_TONICS[note]}${outOctave}`
}

/** Shift a western pitch for bass / male / female / high singing range. */
export function shiftWesternPitch(western: string, semitones: number): string {
  const midi = westernToMidi(western)
  if (midi == null) return western
  return midiToPitch(midi + semitones)
}

export type HarmoniumVoiceRegister = "bass" | "male" | "female" | "high"

export const HARMONIUM_VOICE_REGISTERS: Array<{
  id: HarmoniumVoiceRegister
  label: string
  semitones: number
}> = [
  { id: "bass", label: "Bass", semitones: -12 },
  { id: "male", label: "Male", semitones: 0 },
  { id: "female", label: "Female", semitones: 7 },
  { id: "high", label: "High", semitones: 12 },
]

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

    if (ch === "." || ch === "_") {
      const next = input.slice(index + 1)
      const marked = parseDevanagariToken(next)
      if (marked) {
        const octave: SwaraOctave = ch === "." ? "lower" : marked.octave
        const token = ch === "_" && marked.token === marked.token.toUpperCase()
          ? komalToken(marked.token)
          : marked.token
        const western = swaraToWestern(tonic, token, octave)
        const frequencyHz = western ? westernToHz(western) : null
        if (western && frequencyHz) {
          out.push({ token, octave, western, frequencyHz })
        }
        index += 1 + marked.length
        continue
      }
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
    const stripped = chunk.replace(/^\./, "")
    const octave = octaveFromToken(chunk)
    const token = normalizeSwaraToken(stripped)
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

function komalToken(token: string): string {
  if (token === "R") return "r"
  if (token === "G") return "g"
  if (token === "D") return "d"
  if (token === "N") return "n"
  return token
}

function midiToWestern(midi: number): string {
  const clipped = Math.max(48, Math.min(84, Math.round(midi)))
  const note = clipped % 12
  const outOctave = Math.floor(clipped / 12) - 1
  return `${HARMONIUM_TONICS[note]}${outOctave}`
}

function decorateSwaraName(
  chroma: (typeof SWARA_CHROMA)[number],
  octave: SwaraOctave,
): { latin: string; devanagari: string } {
  if (octave === "upper") {
    return {
      latin: `${chroma.latin}′`,
      devanagari: chroma.token === "S" ? "सां" : `${chroma.devanagari}ं`,
    }
  }
  if (octave === "lower") {
    return {
      latin: `.${chroma.latin}`,
      devanagari: `.${chroma.devanagari}`,
    }
  }
  return { latin: chroma.latin, devanagari: chroma.devanagari }
}

function whitesBefore(midi: number, startMidi: number): number {
  let count = 0
  for (let current = startMidi; current < midi; current += 1) {
    if (!PIANO_BLACK_PC.has(current % 12)) count += 1
  }
  return count
}

/** Classic 2-octave chromatic harmonium starting at mandra Sa. */
export function harmoniumKeyboardLayout(tonic: string): HarmoniumKeyboardKey[] {
  const saMidi = tonicMidiBase(tonic, 4)
  const startMidi = saMidi - 12
  const whiteCount = whitesBefore(startMidi + KEYBOARD_KEY_COUNT, startMidi)
  const keys: HarmoniumKeyboardKey[] = []

  for (let index = 0; index < KEYBOARD_KEY_COUNT; index += 1) {
    const midi = startMidi + index
    const western = midiToWestern(midi)
    const frequencyHz = westernToHz(western) ?? 0
    const isBlack = PIANO_BLACK_PC.has(midi % 12)
    const fromSa = midi - saMidi
    const chroma = SWARA_CHROMA[((fromSa % 12) + 12) % 12]
    const octave: SwaraOctave = fromSa < 0 ? "lower" : fromSa >= 12 ? "upper" : "middle"
    const names = decorateSwaraName(chroma, octave)
    const whiteIndex = isBlack ? whitesBefore(midi, startMidi) - 1 : whitesBefore(midi, startMidi)
    const blackLeftPercent = isBlack ? ((whiteIndex + 0.72) / whiteCount) * 100 : 0

    keys.push({
      token: chroma.token,
      latin: names.latin,
      devanagari: names.devanagari,
      shortcut: CHROMATIC_SHORTCUTS[index] ?? "",
      western,
      keyLabel: westernKeyLabel(western),
      frequencyHz,
      isBlack,
      isSa: fromSa % 12 === 0,
      whiteIndex,
      blackLeftPercent,
    })
  }

  return keys
}

/** Eight-key shuddha strip (Sa–Sa′) for compact practice rows. */
export function shuddhaHarmoniumLayout(tonic: string): HarmoniumKeyboardKey[] {
  return SHUDDHA_SCALE_STEPS.map((step, index) => {
    const western = semitonesToWestern(tonic, step, 4)
    const frequencyHz = westernToHz(western) ?? 0
    const chroma = SWARA_CHROMA[step === 12 ? 0 : step]
    const octave: SwaraOctave = step >= 12 ? "upper" : "middle"
    const names = decorateSwaraName(chroma, octave)
    return {
      token: chroma.token,
      latin: names.latin,
      devanagari: names.devanagari,
      shortcut: ["z", "x", "c", "v", "b", "n", "m", ","][index] ?? "",
      western,
      keyLabel: westernKeyLabel(western),
      frequencyHz,
      isBlack: false,
      isSa: step === 0 || step === 12,
      whiteIndex: index,
      blackLeftPercent: 0,
    }
  })
}

export function sargamPlayEvents(
  tonic: string,
  text: string,
  noteSec = 0.42,
  gapSec = 0.04,
): SheetPlayEvent[] {
  const swaras = parseSargamInput(text, tonic)
  const events: SheetPlayEvent[] = []
  let cursor = 0
  for (const swara of swaras) {
    const last = events[events.length - 1]
    if (last && last.western === swara.western) {
      last.durationSec += noteSec + gapSec
      cursor += noteSec + gapSec
      continue
    }
    if (events.length) cursor += gapSec
    events.push({
      western: swara.western,
      frequencyHz: swara.frequencyHz,
      startSec: cursor,
      durationSec: noteSec,
    })
    cursor += noteSec
  }
  return events
}

export function shortcutForKeyIndex(index: number): string | null {
  return CHROMATIC_SHORTCUTS[index] ?? null
}

export function keyboardIndexForShortcut(key: string): number {
  const normalized = key.length === 1 ? key.toLowerCase() : key
  return CHROMATIC_SHORTCUTS.findIndex((shortcut) => shortcut === normalized)
}

export function keyboardIndexForWestern(keys: HarmoniumKeyboardKey[], western: string): number {
  return keys.findIndex((key) => key.western === western)
}
