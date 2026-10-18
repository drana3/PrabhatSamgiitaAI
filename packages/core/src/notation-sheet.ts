/**
 * Expert-style matra sheet: sargam · lyric · beat labels (X 2 3 …)
 * Matches handwritten sheets (swara on top). Built from HarmoniumNotation JSON.
 */

export type SheetTala = {
  name: string
  beats: number
  groups?: number[]
}

export type SheetNoteInput = {
  sargam: string
  western?: string | null
  duration?: number
  octave?: "lower" | "middle" | "upper"
  syllable?: string | null
}

export type SheetBeatInput = {
  beat: number
  notes: SheetNoteInput[]
}

export type SheetMeasureInput = {
  beats: SheetBeatInput[]
}

export type SheetLineInput = {
  line_number: number
  lyrics: string
  transliteration?: string | null
  measures: SheetMeasureInput[]
}

export type SheetCell = {
  /** Matra label: X for sam, then 2…n within the tala cycle. */
  matra: string
  /** Position within the current tala cycle (1-based). */
  cycleBeat: number
  lyric: string
  /** Learner-facing Devanagari sargam, or S for sustain. */
  sargam: string
  western: string | null
  duration: number
  /** True when this cell starts a bar group (e.g. every 4 in Kaharwa). */
  barStart: boolean
}

export type NotationSheetLine = {
  lineNumber: number
  cells: SheetCell[]
  /** Bar group sizes used for drawing vertical lines, e.g. [4, 4]. */
  groups: number[]
  talaBeats: number
}

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

const PURE_HOLD_TOKENS = new Set(["-", "–", "—", ".", "।", "ऽ"])

function normalizeSargam(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ""
  if (trimmed.length === 1) return trimmed
  if (trimmed[0] && trimmed[0] in HINDI_BY_SARGAM) return trimmed[0]
  const aliases: Record<string, string> = {
    sa: "S",
    re: "R",
    ga: "G",
    ma: "m",
    pa: "P",
    dha: "D",
    ni: "N",
  }
  return aliases[trimmed.toLowerCase()] ?? trimmed
}

function toDevanagari(token: string, octave: SheetNoteInput["octave"] = "middle"): string {
  const normalized = normalizeSargam(token)
  if (!normalized || PURE_HOLD_TOKENS.has(normalized)) return "S"
  const base = HINDI_BY_SARGAM[normalized] ?? token
  if (octave === "lower") return `${base}\u0331`
  if (octave === "upper") return `${base}ं`
  return base
}

/** Sustain cell: explicit hold token, or Latin S without a western pitch. */
export function isHold(note: SheetNoteInput): boolean {
  const token = note.sargam.trim()
  if (!token || PURE_HOLD_TOKENS.has(token)) return true
  const normalized = normalizeSargam(token)
  if ((normalized === "S" || token === "s") && !note.western?.trim()) return true
  return false
}

/** Flatten notes in document order, expanding duration > 1 into hold cells when helpful. */
function flattenNotes(line: SheetLineInput): SheetNoteInput[] {
  const notes: SheetNoteInput[] = []
  for (const measure of line.measures) {
    for (const beat of measure.beats) {
      if (!beat.notes.length) {
        notes.push({ sargam: "S", duration: 1, syllable: "S" })
        continue
      }
      for (const note of beat.notes) {
        notes.push(note)
      }
    }
  }
  return notes
}

export function resolveTala(tala?: SheetTala | null): { name: string; beats: number; groups: number[] } {
  const beats = Math.max(1, tala?.beats || 8)
  const groups =
    tala?.groups && tala.groups.length > 0 && tala.groups.reduce((a, b) => a + b, 0) === beats
      ? tala.groups
      : beats % 4 === 0
        ? Array.from({ length: beats / 4 }, () => 4)
        : [beats]
  return {
    name: tala?.name?.trim() || "Kaharva",
    beats,
    groups,
  }
}

export function formatTalaHeader(tala?: SheetTala | null, songNumber?: number): string {
  const resolved = resolveTala(tala)
  const ps = songNumber && songNumber > 0 ? `PS ${songNumber} · ` : ""
  return `${ps}ताल - ${resolved.name} ${resolved.beats} मात्रा`
}

export function matraLabel(cycleBeat: number): string {
  return cycleBeat === 1 ? "X" : String(cycleBeat)
}

function syllableFor(note: SheetNoteInput, fallbackIndex: number, lyricTokens: string[]): string {
  const fromNote = note.syllable?.trim()
  if (fromNote) return fromNote
  if (isHold(note)) return "S"
  return lyricTokens[fallbackIndex] ?? "·"
}

/**
 * Build one expert-style sheet line (lyric / sargam / matra) from notation JSON.
 */
export function buildNotationSheetLine(
  line: SheetLineInput,
  tala?: SheetTala | null,
): NotationSheetLine {
  const resolved = resolveTala(tala)
  const notes = flattenNotes(line)
  const lyricTokens = line.lyrics
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  let lyricCursor = 0
  const cells: SheetCell[] = []
  let groupCursor = 0
  let groupRemaining = resolved.groups[0] ?? resolved.beats

  notes.forEach((note, index) => {
    const cycleBeat = (index % resolved.beats) + 1
    const barStart = groupRemaining === (resolved.groups[groupCursor] ?? resolved.beats)
    const lyric = syllableFor(note, isHold(note) ? -1 : lyricCursor, lyricTokens)
    if (!isHold(note) && lyric !== "S" && lyric !== "·") lyricCursor += 1

    cells.push({
      matra: matraLabel(cycleBeat),
      cycleBeat,
      lyric,
      sargam: isHold(note) ? "S" : toDevanagari(note.sargam, note.octave),
      western: note.western?.trim() || null,
      duration: Math.max(0.25, note.duration || 1),
      barStart,
    })

    groupRemaining -= 1
    if (groupRemaining <= 0) {
      groupCursor = (groupCursor + 1) % resolved.groups.length
      groupRemaining = resolved.groups[groupCursor] ?? resolved.beats
    }
  })

  return {
    lineNumber: line.line_number,
    cells,
    groups: resolved.groups,
    talaBeats: resolved.beats,
  }
}

export type SheetPlayEvent = {
  western: string
  frequencyHz: number
  startSec: number
  durationSec: number
}

const SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

/** Parse western pitch like C4 / F#3 / Bb4 into Hz. */
export function westernToHz(western: string): number | null {
  const match = western.trim().match(/^([A-Ga-g])([#bB]?)(-?\d+)$/)
  if (!match) return null
  const letter = match[1].toUpperCase()
  const accidental = match[2] === "#" ? 1 : match[2] && match[2].toLowerCase() === "b" ? -1 : 0
  const octave = Number(match[3])
  const base = SEMITONES[letter]
  if (base == null || !Number.isFinite(octave)) return null
  const midi = (octave + 1) * 12 + base + accidental
  return 440 * 2 ** ((midi - 69) / 12)
}

/**
 * Timed play list for harmonium-style preview (skips holds without pitch).
 * `secondsPerMatra` defaults from `tempoBpm` (quarter = one matra) or ~72 BPM practice tempo.
 */
export function secondsPerMatraFromTempo(tempoBpm?: number | null, fallback = 0.55): number {
  if (!tempoBpm || tempoBpm <= 0 || !Number.isFinite(tempoBpm)) return fallback
  return 60 / tempoBpm
}

export function sheetPlayEvents(
  cells: SheetCell[],
  secondsPerMatra = 0.55,
  tempoBpm?: number | null,
): SheetPlayEvent[] {
  const matraSec = tempoBpm != null ? secondsPerMatraFromTempo(tempoBpm, secondsPerMatra) : secondsPerMatra
  const events: SheetPlayEvent[] = []
  let cursor = 0
  for (const cell of cells) {
    const span = Math.max(0.25, cell.duration) * matraSec
    if (cell.western) {
      const hz = westernToHz(cell.western)
      if (hz) {
        events.push({
          western: cell.western,
          frequencyHz: hz,
          startSec: cursor,
          durationSec: Math.min(span * 0.82, Math.max(span - 0.04, span * 0.7)),
        })
      }
    }
    cursor += span
  }
  return events
}

/** Minimal mono WAV (16-bit) as a data URI for React Native / Expo playback. */
export function sineWavDataUri(frequencyHz: number, durationSec: number, sampleRate = 22050): string {
  return reedWavDataUri(frequencyHz, durationSec, sampleRate)
}

/**
 * Reed-like harmonium tone (odd harmonics + soft vibrato) as a WAV data URI.
 * Used when the on-disk sample bank is unavailable (tests / fallback).
 */
export function reedWavDataUri(frequencyHz: number, durationSec: number, sampleRate = 22050): string {
  const samples = Math.max(1, Math.floor(sampleRate * durationSec))
  const dataSize = samples * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeStr(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, "data")
  view.setUint32(40, dataSize, true)

  const harmonics: Array<[number, number]> = [
    [1.0, 1],
    [0.28, 2],
    [0.42, 3],
    [0.10, 4],
    [0.18, 5],
    [0.05, 6],
    [0.06, 7],
  ]

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate
    const attack = Math.min(1, t / 0.035)
    const release = Math.min(1, Math.max(0, durationSec - t) / 0.14)
    const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 5.2 * t)
    const pitch = frequencyHz * vibrato
    let sample = 0
    for (const [amp, mult] of harmonics) {
      sample += amp * Math.sin(2 * Math.PI * pitch * mult * t)
    }
    sample += 0.06 * Math.sin(2 * Math.PI * pitch * 0.5 * t)
    const value = Math.max(-1, Math.min(1, Math.tanh(sample * 0.26) * attack * release))
    view.setInt16(44 + i * 2, value * 0x7fff, true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64")
  return `data:audio/wav;base64,${base64}`
}

/** Safe filename stem for sample bank, e.g. C#4 → Cs4, Bb3 → As3. */
export function westernToSampleStem(western: string): string | null {
  const match = western.trim().match(/^([A-Ga-g])([#bB]?)(-?\d+)$/)
  if (!match) return null
  const letter = match[1].toUpperCase()
  const accidental = match[2]
  const octave = match[3]
  let stem = letter
  if (accidental === "#") stem += "s"
  else if (accidental && accidental.toLowerCase() === "b") {
    // Flatten to previous sharp name used by the bank (Bb → As).
    const flatMap: Record<string, string> = {
      C: "B",
      D: "Cs",
      E: "Ds",
      F: "E",
      G: "Fs",
      A: "Gs",
      B: "As",
    }
    const mapped = flatMap[letter]
    if (!mapped) return null
    const octaveNum = Number(octave) - (letter === "C" ? 1 : 0)
    return `${mapped}${octaveNum}`
  }
  return `${stem}${octave}`
}

/** Public URL path for a pre-rendered reed sample (web). */
export function harmoniumSampleUrl(western: string, basePath = "/audio/harmonium"): string | null {
  const stem = westernToSampleStem(western)
  return stem ? `${basePath}/${stem}.wav` : null
}
