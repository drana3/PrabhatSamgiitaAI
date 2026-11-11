/**
 * What the colleagues' archives carry, in the small form the phone reads (data/psColleagues/*.json, built by
 * scripts/buildPsColleagueData.mjs from data/curated/ps_colleagues). Nothing here is edited or translated by the
 * app; it is shown as the documents have it, and always under the name of its source.
 */

/** The four languages of the colleagues' translations, in the order the page offers them. */
export const COLLEAGUE_LANGS = ["en", "ru", "uk", "fr"] as const
export type ColleagueLang = (typeof COLLEAGUE_LANGS)[number]

/** One translation as stored: `t` the text, `n` the document's own source note, `h` its title line, `x` second texts of the same language. */
export type WireVersion = { t: string; n?: string; h?: string; x?: WireVersion[] }
export type WireTranslations = Record<string, Partial<Record<ColleagueLang, WireVersion>>>

/** A chord page of the Word documents: `c` capo as the document writes it (null: not stated), `l` the lines as a monospace page, `k` which lines hold chord symbols. */
export type WireDocxChart = { c: string | null; l: string[]; k: number[] }
/** The chord lines of a chord-sheet PDF: `s` the file, `c` capo as the PDF writes it ("none" included), `l` chord lines (no words). */
export type WirePdfChart = { s: string; c: string | null; l: string[] }
export type WireChords = { docx: Record<string, WireDocxChart>; pdf: Record<string, WirePdfChart> }

/** One recording file in the bucket: file name, key, current flag, size, upload status. */
export type WireRecording = { f: string; k: string; cur: boolean; b: number; st: string }
export type WireAudio = Record<string, WireRecording[]>
