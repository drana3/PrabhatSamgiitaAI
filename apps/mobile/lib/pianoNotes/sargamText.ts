import { swaraText } from "./keys"
import type { PianoStep } from "./types"

/**
 * The text line of the editor: `Sa Re Ga Ma:2 (Sa Ga Pa) 0 Pa'`.
 *
 *   Sa Re Ga Ma Pa Dha Ni   shuddha; lower case re ga dha ni are komal; Ma# (or Ma♯) is tivra Ma
 *   Reb Gab Dhab Nib        komal with a flat sign (♭ too)
 *   Pa'  /  .Pa  /  ..Pa    an octave up with ' (each one more), an octave down with a leading . or _
 *   Sa:2  Re:0.5            beats after a colon (quarters); no number = 1 beat
 *   -                       one more beat for the step before
 *   0                       a rest of one beat
 *   (Sa Ga Pa)              keys pressed together; a number after it is its beats: (Sa Ga Pa):2
 *   |                       a bar line, ignored
 * One letter works too: S R G M P D N (M is tivra), m is Ma, r g d n are komal.
 */
/** Shuddha semitones above Sa by lower-case name; the komal and tivra forms are worked out from these. */
const SHUDDHA: Record<string, number> = { sa: 0, re: 2, ga: 4, ma: 5, pa: 7, dha: 9, ni: 11 }
const KOMAL_ABLE = new Set(["re", "ga", "dha", "ni"])
/** One-letter forms: [name, komal, tivra]. */
const SINGLE: Record<string, readonly [string, boolean, boolean]> = {
  S: ["sa", false, false],
  R: ["re", false, false],
  G: ["ga", false, false],
  M: ["ma", false, true],
  m: ["ma", false, false],
  P: ["pa", false, false],
  D: ["dha", false, false],
  N: ["ni", false, false],
  r: ["re", true, false],
  g: ["ga", true, false],
  d: ["dha", true, false],
  n: ["ni", true, false],
}
const WORD = /^([._]*)(Sa|Re|Ga|Ma|Pa|Dha|Ni|re|ga|dha|ni|ma|sa|pa|[SRGMmPDNrgdn])(#|♯|b|♭)?('*)$/
const MAX_BEATS = 16

export type ParsedKey = { ok: true; k: number } | { ok: false }

/** One swara word (no beats) as semitones above Sa. */
export function parseSwara(word: string): ParsedKey {
  const match = WORD.exec(word)
  if (!match) return { ok: false }
  const low = match[1] ?? ""
  const raw = match[2] ?? ""
  const mark = match[3] ?? ""
  const high = match[4] ?? ""
  let name = raw.toLowerCase()
  let komal = false
  let tivra = false
  if (raw.length === 1) {
    const [single, isKomal, isTivra] = SINGLE[raw]!
    name = single
    komal = isKomal
    tivra = isTivra
  } else if (KOMAL_ABLE.has(raw)) {
    // re ga dha ni written in lower case are komal
    komal = true
  }
  const flat = mark === "b" || mark === "♭"
  const sharp = mark === "#" || mark === "♯"
  if (flat) {
    if (!KOMAL_ABLE.has(name) || komal) return { ok: false }
    komal = true
  }
  if (sharp) {
    if (name !== "ma" || tivra) return { ok: false }
    tivra = true
  }
  if (tivra && name !== "ma") return { ok: false }
  let chroma = SHUDDHA[name]!
  if (komal) chroma -= 1
  if (tivra) chroma += 1
  return { ok: true, k: chroma + 12 * (high.length - low.length) }
}

function beatsOf(raw: string | undefined): number | null {
  if (raw === undefined) return 1
  const beats = Number(raw)
  if (!Number.isFinite(beats) || beats <= 0 || beats > MAX_BEATS) return null
  return Math.abs(beats * 4 - Math.round(beats * 4)) > 1e-9 ? null : beats
}

export type ParsedLine = { steps: PianoStep[]; bad: string[] }

/** Text to steps. A word that is not understood goes to `bad` and is left out; the rest still parses. */
export function parseSargamLine(text: string): ParsedLine {
  const steps: PianoStep[] = []
  const bad: string[] = []
  for (const token of text.match(/\([^)]*\)(?::[\d.]+)?|\S+/g) ?? []) {
    if (token === "|" || token === "||") continue
    if (/^-+$/.test(token)) {
      const last = steps[steps.length - 1]
      if (last && last.b + token.length <= MAX_BEATS) last.b += token.length
      else bad.push(token)
      continue
    }
    const rest = /^0(?::([\d.]+))?$/.exec(token)
    if (rest) {
      const beats = beatsOf(rest[1])
      if (beats === null) bad.push(token)
      else steps.push({ k: [], b: beats })
      continue
    }
    if (token.startsWith("(")) {
      const group = /^\(([^)]*)\)(?::([\d.]+))?$/.exec(token)
      const beats = beatsOf(group?.[2])
      const words = (group?.[1] ?? "").trim().split(/[\s,]+/).filter(Boolean)
      const keys = words.map(parseSwara)
      if (!group || beats === null || words.length === 0 || words.length > 6 || keys.some((key) => !key.ok)) {
        bad.push(token)
        continue
      }
      steps.push({ k: [...new Set(keys.map((key) => (key as { k: number }).k))].sort((a, b) => a - b), b: beats })
      continue
    }
    const [word, rawBeats, ...extra] = token.split(":")
    const beats = beatsOf(rawBeats)
    const key = parseSwara(word ?? "")
    if (!key.ok || beats === null || extra.length > 0) {
      bad.push(token)
      continue
    }
    steps.push({ k: [key.k], b: beats })
  }
  return { steps, bad }
}

/** Steps to the same text the parser reads back. */
export function formatSargamLine(steps: readonly PianoStep[]): string {
  return steps
    .map((step) => {
      const tail = step.b === 1 ? "" : `:${step.b}`
      if (step.k.length === 0) return step.b === 1 ? "0" : `0${tail}`
      if (step.k.length === 1) return `${swaraText(step.k[0]!)}${tail}`
      return `(${step.k.map(swaraText).join(" ")})${tail}`
    })
    .join(" ")
}

/** `Sa Re Ga` for a step, for the strip of a viewer. */
export function stepLabel(step: PianoStep): string {
  if (step.k.length === 0) return "–"
  return step.k.map(swaraText).join(" ")
}
