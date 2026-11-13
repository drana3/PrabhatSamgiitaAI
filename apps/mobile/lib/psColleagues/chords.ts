import type { WireChords } from "./types"

/** How a capo is written in the source: a fret, "no capo" (0 in a document, "none" in a PDF), or not stated at all. */
export type CapoState = { kind: "fret"; fret: number } | { kind: "none" } | { kind: "unstated" }

export type ColleagueChart = {
  /** where the page comes from: the Word documents, or one chord-sheet PDF */
  source: { kind: "docx" } | { kind: "pdf"; file: string }
  capo: CapoState
  /** the page as lines of a monospace text, spaces kept */
  lines: string[]
  /** indexes of the lines that hold chord symbols (drawn as chords, the others as words) */
  chordLines: number[]
  /** false for the PDF pages: they list the chord lines only, without the words */
  hasWords: boolean
}

/** The capo as a source writes it. */
export function capoOf(raw: string | null | undefined): CapoState {
  const text = (raw ?? "").trim().toLowerCase()
  if (!text) return { kind: "unstated" }
  if (text === "none" || text === "no") return { kind: "none" }
  const fret = Number.parseInt(text, 10)
  if (!Number.isFinite(fret)) return { kind: "unstated" }
  return fret === 0 ? { kind: "none" } : { kind: "fret", fret }
}

/**
 * The chord pages the colleagues' archives hold for a song: the Word document's page first (only when it holds chord
 * symbols; a page of words alone is not a chart), then the page of a chord-sheet PDF. Both are returned when both
 * exist, even when they agree, because the two sources differ for most songs; they are never merged.
 */
export function colleagueChartsOf(wire: WireChords | null | undefined, songNumber: number | null | undefined): ColleagueChart[] {
  if (!wire || songNumber == null) return []
  const key = String(songNumber)
  const out: ColleagueChart[] = []
  const docx = wire.docx[key]
  if (docx && docx.l.length > 0 && docx.k.length > 0) {
    out.push({ source: { kind: "docx" }, capo: capoOf(docx.c), lines: docx.l, chordLines: docx.k, hasWords: true })
  }
  const pdf = wire.pdf[key]
  if (pdf && pdf.l.some((line) => line.trim())) {
    out.push({
      source: { kind: "pdf", file: pdf.s },
      capo: capoOf(pdf.c),
      lines: pdf.l,
      chordLines: pdf.l.map((line, i) => (line.trim() ? i : -1)).filter((i) => i >= 0),
      hasWords: false,
    })
  }
  return out
}

/** True when the page's lines hold at least one chord symbol (the rule that keeps word-only pages out). */
export function hasColleagueChords(wire: WireChords | null | undefined, songNumber: number | null | undefined): boolean {
  return colleagueChartsOf(wire, songNumber).length > 0
}

/** Two charts of one song that disagree on the capo; the page then says so and shows both as they are. */
export function chartsDiffer(charts: readonly ColleagueChart[]): boolean {
  if (charts.length < 2) return false
  const key = (c: ColleagueChart) => (c.capo.kind === "fret" ? `f${c.capo.fret}` : c.capo.kind)
  const capos = new Set(charts.map(key))
  if (capos.size > 1) return true
  // same capo: the chord letters still differ when the sequences of chord words differ
  const letters = (c: ColleagueChart) => c.chordLines.flatMap((i) => c.lines[i]?.trim().split(/\s+/) ?? []).join(" ")
  return new Set(charts.map(letters)).size > 1
}
