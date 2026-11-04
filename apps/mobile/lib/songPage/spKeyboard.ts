import { SP_NOTES, spTranspose, swaraAt } from "./spChords"

/**
 * The harmonium keyboard and the chord explainer, with the arithmetic of the design prototype
 * (Main.dc.html, `WH`, `BL`, `SWN`, `rel`, `cxSet`). One octave of eight white keys and five black keys.
 * The notes are the real pitches C to C; Sa only changes the swara printed on each key.
 */
export const SP_WHITE_PITCHES = [0, 2, 4, 5, 7, 9, 11, 12] as const
/** [gap after white key n, pitch]. `(gap + 1) * 12.5 - 4.25` is the left edge in percent of the keyboard. */
export const SP_BLACK_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 3],
  [3, 6],
  [4, 8],
  [5, 10],
]
export const SP_SWARA_NAMES = ["Sa", "re", "Re", "ga", "Ga", "Ma", "Ma♯", "Pa", "dha", "Dha", "ni", "Ni"] as const

/** Sharp spelling and octave of the sample bank, for the sound a key makes (middle C is C4). */
const SOUND_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const

export const KBD_HEIGHT = 230
export const KBD_BLACK_HEIGHT = 138
export const KBD_BLACK_WIDTH_PCT = 8.5
const WHITE_GAP = 2

export type SpKey = {
  /** `w0` to `w7`, `b0` to `b4`: the id the readout selects by */
  id: string
  black: boolean
  /** 0 to 12, semitones above the first C */
  pitch: number
  swara: string
  note: string
  isSa: boolean
  label: string
  /** pitch the sample bank plays, for example `C#4` */
  western: string
  /** black keys only: left edge in percent of the keyboard width */
  leftPct: number
}

const mod12 = (n: number) => ((n % 12) + 12) % 12

/** The swara of a pitch for the chosen Sa (`SWN[rel(p)]`). */
export function swaraOfPitch(pitch: number, saPitch: number): string {
  return SP_SWARA_NAMES[mod12(pitch - saPitch)]!
}

export function noteOfPitch(pitch: number): string {
  return SP_NOTES[mod12(pitch)]!
}

function western(pitch: number): string {
  return `${SOUND_NAMES[mod12(pitch)]}${4 + Math.floor(pitch / 12)}`
}

function makeKey(id: string, pitch: number, black: boolean, saPitch: number, leftPct = 0): SpKey {
  const swara = swaraOfPitch(pitch, saPitch)
  const note = noteOfPitch(pitch)
  return {
    id,
    black,
    pitch,
    swara,
    note,
    isSa: mod12(pitch - saPitch) === 0,
    label: `${swara} ${note}`,
    western: western(pitch),
    leftPct,
  }
}

export function spKeys(saPitch: number): { whites: SpKey[]; blacks: SpKey[] } {
  return {
    whites: SP_WHITE_PITCHES.map((pitch, i) => makeKey(`w${i}`, pitch, false, saPitch)),
    blacks: SP_BLACK_SLOTS.map(([gap, pitch], j) =>
      makeKey(`b${j}`, pitch, true, saPitch, Math.round(((gap + 1) * 12.5 - 4.25) * 100) / 100),
    ),
  }
}

/** Extra width of a Sa key: the prototype's `.sa` rule (padding 0 10px) also lands on the Sa key of the keyboard. */
export const SA_KEY_PADDING = 20

/**
 * Where each white key sits in a keyboard `width` px wide: equal shares of the free width, the Sa keys
 * wider by their padding (flex-basis = padding, then the rest shared), 2px between keys.
 */
export function whiteRects(width: number, saFlags: readonly boolean[]): Array<{ x: number; w: number }> {
  const count = saFlags.length
  const free = width - WHITE_GAP * (count - 1) - saFlags.filter(Boolean).length * SA_KEY_PADDING
  const share = free / count
  let x = 0
  return saFlags.map((isSa) => {
    const w = (isSa ? SA_KEY_PADDING : 0) + share
    const rect = { x, w }
    x += w + WHITE_GAP
    return rect
  })
}

/** The key at a point of the keyboard (x, y in px): black keys first, then the white key under x. */
export function hitSpKey(x: number, y: number, width: number, saFlags: readonly boolean[]): string | null {
  if (width <= 0 || x < 0 || x > width || y < 0 || y > KBD_HEIGHT) return null
  if (y <= KBD_BLACK_HEIGHT) {
    const pct = (x / width) * 100
    const slot = SP_BLACK_SLOTS.findIndex(([gap]) => {
      const left = (gap + 1) * 12.5 - 4.25
      return pct >= left && pct <= left + KBD_BLACK_WIDTH_PCT
    })
    if (slot >= 0) return `b${slot}`
  }
  const rects = whiteRects(width, saFlags)
  const index = rects.findIndex((r) => x < r.x + r.w + WHITE_GAP / 2)
  return `w${index < 0 ? rects.length - 1 : index}`
}

export function pitchOfKeyId(id: string): number | null {
  const index = Number(id.slice(1))
  if (!Number.isFinite(index)) return null
  if (id.startsWith("w")) return SP_WHITE_PITCHES[index] ?? null
  if (id.startsWith("b")) return SP_BLACK_SLOTS[index]?.[1] ?? null
  return null
}

/* ---------------- Harmonium chords explainer ---------------- */

/** Root pitch of each chord of the sample song in key C (`ROOT`). */
const BASE_ROOT: Record<string, number> = { C: 0, Am: 9, F: 5, G: 7 }

/** The chord letters of the sample song, in the order they first appear (PS 1: `C.ch`). */
export const EXPLAINER_CHORDS = ["C", "Am", "F", "G"] as const

export type ChordExplained = {
  /** the chord written for the chosen Sa, for example `Cm` */
  name: string
  minor: boolean
  /** the three pitch classes pressed together */
  pitches: number[]
  kind: string
  equation: string
}

/** `nm`, `cxSet`, `chordKind`, `chordEq`: a base chord (in key C) moved to Sa and spelled as three keys. */
export function explainChord(base: string, saPitch: number): ChordExplained {
  const root = mod12((BASE_ROOT[base] ?? 0) + saPitch)
  const minor = base.endsWith("m")
  const pitches = [root, mod12(root + (minor ? 3 : 4)), mod12(root + 7)]
  const name = spTranspose(base, saPitch)
  return {
    name,
    minor,
    pitches,
    kind: minor ? "Minor: root, then 3 and 7 keys up" : "Major: root, then 4 and 7 keys up",
    equation: `${name} = ${pitches.map(noteOfPitch).join(" + ")}, swaras ${pitches
      .map((p) => swaraOfPitch(p, saPitch))
      .join(" · ")}`,
  }
}

/** Is this key part of the chord? White keys at pitch 12 count as pitch class 0. */
export function keyInChord(key: SpKey, chord: ChordExplained): boolean {
  return chord.pitches.includes(mod12(key.pitch))
}

export type ExplainerToken = { key: string; chord: string; word: string; swara: string; lineBreak?: boolean }

/** Chord letter positions of a line of `n` words: the first and the middle one (`CHP`). */
export function chordPositions(n: number): [number, number] {
  return [0, Math.ceil(n / 2)]
}

/**
 * "In the song" example: the first two lines of the sample song with the chord letters over the words
 * in the chosen Sa and the swara under each word (`exToks`).
 */
export function explainerTokens(lines: string[][], saPitch: number): ExplainerToken[] {
  const out: ExplainerToken[] = []
  lines.slice(0, 2).forEach((words, li) => {
    const positions = chordPositions(words.length)
    const bases = [
      EXPLAINER_CHORDS[li % EXPLAINER_CHORDS.length]!,
      EXPLAINER_CHORDS[(li + 1) % EXPLAINER_CHORDS.length]!,
    ]
    words.forEach((word, wi) => {
      const at = positions.indexOf(wi)
      out.push({
        key: `${li}-${wi}`,
        chord: at >= 0 ? spTranspose(bases[at]!, saPitch) : "",
        word,
        swara: swaraAt(li, wi),
      })
    })
    out.push({ key: `${li}-br`, chord: "", word: "", swara: "", lineBreak: true })
  })
  return out
}
