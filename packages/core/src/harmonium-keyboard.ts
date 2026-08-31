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

const BOOKLET_SYLLABLE_TO_TOKEN: Record<string, string> = {
  sa: "S",
  re: "R",
  ra: "r",
  ga: "g",
  ma: "m",
  pa: "P",
  dha: "d",
  ni: "n",
  Sa: "S",
  Re: "R",
  Ra: "R",
  Ga: "G",
  Ma: "m",
  Pa: "P",
  Dha: "D",
  Ni: "N",
}

/** @deprecated Use BOOKLET_SYLLABLE_TO_TOKEN — kept for simple Latin chips. */
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

function stripLatinDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "")
}

export function normalizeSwaraToken(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === "-" || trimmed === "–") return null

  const withoutOctave = stripLatinDiacritics(trimmed.replace(/['′`]/g, ""))
  if (!withoutOctave) return null

  if (withoutOctave in BOOKLET_SYLLABLE_TO_TOKEN) {
    return BOOKLET_SYLLABLE_TO_TOKEN[withoutOctave]
  }

  const lowered = withoutOctave.toLowerCase()
  if (lowered in BOOKLET_SYLLABLE_TO_TOKEN) {
    return BOOKLET_SYLLABLE_TO_TOKEN[lowered]
  }

  if (withoutOctave in SWARA_SEMITONES) return withoutOctave
  const first = withoutOctave[0]
  if (first && first in SWARA_SEMITONES) return first
  if (lowered in LATIN_ALIASES) return LATIN_ALIASES[lowered]
  return null
}

function skipBarMarker(input: string, index: number): number {
  const slice = input.slice(index)
  const prev = input[index - 1]
  const afterI = input[index + 1]
  const afterII = input[index + 2]

  if (/^II/i.test(slice) && (index === 0 || !prev || /[\s|]/.test(prev)) && (!afterII || /[\s|]/.test(afterII))) {
    return index + 2
  }

  if (slice[0] === "I" && slice[1] !== "I" && (index === 0 || !prev || /[\s|]/.test(prev)) && (!afterI || /[\s|]/.test(afterI))) {
    return index + 1
  }

  return index
}

function parseBookletHoldAt(input: string, index: number): { beats: number; length: number } | null {
  const accentLen = sargamSustainLength(input, index)
  if (accentLen > 0) return { beats: accentLen, length: accentLen }

  const slice = input.slice(index)
  // Booklet vowel hold: a / a' / a′ between swaras (not ga', sa', ra', …).
  if (/^a['′`]?(?![a-z])/i.test(slice)) {
    const length = slice.match(/^a['′`]?/i)?.[0].length ?? 1
    return { beats: 1, length }
  }

  return null
}

function resolveSwaraOctave(chunk: string, defaultOctave: SwaraOctave): SwaraOctave {
  const trimmed = chunk.trim()
  if (/^\.|^_/.test(trimmed)) return "lower"
  if (/['′`]|ं$|san$/i.test(trimmed)) return "upper"
  return defaultOctave
}

/** PS Roman lines with several taar swaras (Sa', ga', …) default missing ' to upper. */
function bookletDefaultOctave(input: string): SwaraOctave {
  const taarSwaras = input.match(/[\p{L}\p{M}]+['′`]/gu)
  return (taarSwaras?.length ?? 0) >= 2 ? "upper" : "middle"
}

function parseDevanagariToken(text: string): { token: string; octave: SwaraOctave; length: number } | null {
  for (const entry of DEVANAGARI_SWARAS) {
    if (text.startsWith(entry.text)) {
      return { token: entry.token, octave: entry.octave, length: entry.text.length }
    }
  }
  return null
}

function parseNextSargamSwara(
  input: string,
  index: number,
  tonic: string,
  defaultOctave: SwaraOctave = "middle",
): { swara: ParsedSwara; nextIndex: number } | null {
  const ch = input[index]
  if (!ch || /\s|[,·|/]/.test(ch)) return null

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
        return {
          swara: { token, octave, western, frequencyHz },
          nextIndex: index + 1 + marked.length,
        }
      }
    }
  }

  const devanagari = parseDevanagariToken(input.slice(index))
  if (devanagari) {
    const western = swaraToWestern(tonic, devanagari.token, devanagari.octave)
    const frequencyHz = western ? westernToHz(western) : null
    if (western && frequencyHz) {
      return {
        swara: {
          token: devanagari.token,
          octave: devanagari.octave,
          western,
          frequencyHz,
        },
        nextIndex: index + devanagari.length,
      }
    }
  }

  const chunk = input.slice(index).match(/^[\p{L}\p{M}'′`._-]+/u)?.[0] ?? input[index]
  const stripped = chunk.replace(/^\./, "")
  const resolvedOctave = resolveSwaraOctave(chunk, defaultOctave)
  const token = normalizeSwaraToken(stripped)
  if (token) {
    const western = swaraToWestern(tonic, token, resolvedOctave)
    const frequencyHz = western ? westernToHz(western) : null
    if (western && frequencyHz) {
      return {
        swara: { token, octave: resolvedOctave, western, frequencyHz },
        nextIndex: index + chunk.length,
      }
    }
  }

  return null
}

/** Parse learner sargam text (Latin, Devanagari, or OCR tokens). */
export function parseSargamInput(text: string, tonic: string): ParsedSwara[] {
  const input = text.trim()
  if (!input) return []

  const defaultOctave = bookletDefaultOctave(input)
  const out: ParsedSwara[] = []
  let index = 0
  while (index < input.length) {
    index = skipBarMarker(input, index)
    const parsed = parseNextSargamSwara(input, index, tonic, defaultOctave)
    if (!parsed) {
      index += 1
      continue
    }
    out.push(parsed.swara)
    index = parsed.nextIndex
  }

  return out
}

/** Each dash in --- adds one second of key-held sustain (wall clock, not a matra). */
export const SARGAM_DASH_HOLD_SEC = 1

export type SargamPlayBeat = {
  sargam: string
  beats: number
  western?: string
  /** Extra seconds from --- while the previous key stays pressed. */
  holdSec?: number
}

const SARGAM_SUSTAIN_CHARS = /[á\u0101]/iu
const SARGAM_HOLD_CHARS = /[\-–—]/

function charRunLength(input: string, index: number, matches: (ch: string) => boolean): number {
  let length = 0
  while (index + length < input.length) {
    const current = input[index + length]
    if (!current || /[\s,·|/]/.test(current)) break
    if (!matches(current)) break
    length += 1
  }
  return length
}

function sargamSustainLength(input: string, index: number): number {
  return charRunLength(input, index, (ch) => SARGAM_SUSTAIN_CHARS.test(ch))
}

function sargamHoldLength(input: string, index: number): number {
  return charRunLength(input, index, (ch) => SARGAM_HOLD_CHARS.test(ch))
}

/** Beat groups: each swara is a strike; á adds matras; --- adds seconds with key held. */
export function parseSargamPlayBeats(text: string, tonic: string): SargamPlayBeat[] {
  const input = text.trim()
  if (!input) return []

  const defaultOctave = bookletDefaultOctave(input)
  const beats: SargamPlayBeat[] = []
  let index = 0
  while (index < input.length) {
    const ch = input[index]
    if (!ch || /\s|[,·|/]/.test(ch)) {
      index += 1
      continue
    }
    index = skipBarMarker(input, index)
    if (index >= input.length) break
    const hold = parseBookletHoldAt(input, index)
    if (hold) {
      const last = beats[beats.length - 1]
      if (last) last.beats += hold.beats
      index += hold.length
      continue
    }

    const dashLength = sargamHoldLength(input, index)
    if (dashLength > 0) {
      const last = beats[beats.length - 1]
      if (last) last.holdSec = (last.holdSec ?? 0) + dashLength * SARGAM_DASH_HOLD_SEC
      index += dashLength
      continue
    }

    const parsed = parseNextSargamSwara(input, index, tonic, defaultOctave)
    if (parsed) {
      beats.push({
        sargam: parsed.swara.token,
        beats: 1,
        western: parsed.swara.western,
      })
      index = parsed.nextIndex
      continue
    }

    index += 1
  }

  return beats
}

export function playBeatSpanSec(beat: SargamPlayBeat, beatSec: number): number {
  return beat.beats * beatSec + (beat.holdSec ?? 0)
}

export function playBeatsToEvents(
  tonic: string,
  playBeats: SargamPlayBeat[],
  beatSec: number,
  gapSec: number,
): SheetPlayEvent[] {
  const events: SheetPlayEvent[] = []
  let cursor = 0
  const lastNoteIndex = playBeats.length - 1
  const breath = gapSec * 0.35

  for (const [index, beat] of playBeats.entries()) {
    const { sargam, western } = beat
    const fromWestern = western?.trim()
    const parsed = fromWestern
      ? {
          western: fromWestern,
          frequencyHz: westernToHz(fromWestern) ?? 0,
        }
      : parseSargamInput(sargam, tonic)[0]
    if (!parsed?.western || !parsed.frequencyHz) continue
    const span = playBeatSpanSec(beat, beatSec)
    const isLast = index === lastNoteIndex
    const held = beat.beats > 1 || (beat.holdSec ?? 0) > 0
    const noteGap = held ? breath * 0.35 : breath
    const sustain = span - noteGap
    events.push({
      western: parsed.western,
      frequencyHz: parsed.frequencyHz,
      startSec: cursor,
      durationSec: Math.max(0.22, isLast ? span + beatSec * 0.45 : sustain),
    })
    cursor += span
  }
  return events
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

/** Timed playback for typed sargam — same beat sustain model as Play on keys. */
export function sargamPlayEvents(
  tonic: string,
  text: string,
  beatSec: number,
  gapSec: number,
): SheetPlayEvent[] {
  return playBeatsToEvents(tonic, parseSargamPlayBeats(text, tonic), beatSec, gapSec)
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
