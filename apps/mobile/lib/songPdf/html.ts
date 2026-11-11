import { lyricLanguage } from "@/lib/songPage/lyricLanguages"
import { glossKey } from "@/lib/songPage/songContent"

import type { PdfOptions, PdfSongInput, PdfVariantId } from "./types"

/**
 * The song as a printable page: one HTML text per layout, in the look of the app (Fraunces, Newsreader, JetBrains Mono,
 * ink on lime-wash paper, one ochre accent, a hairline above the title, no shadows, no rounded corners). The phone prints it
 * to a PDF (lib/songPdf/share.ts); a browser prints it the same way. Fonts come from Google Fonts and fall back to the serif
 * of the device when the phone is offline, so the page is always complete and only the type changes.
 *
 * Nothing is invented: a word with no meaning in the data prints with an empty line, and a language the song has no
 * translation in is left out of the page (and `missing` says so, so the sheet can tell the person).
 */

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,800;1,9..144,300&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=JetBrains+Mono:wght@500&display=swap"

export const esc = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const words = (line: string): string[] => line.split(/\s+/).filter(Boolean)

/** The name of a language on the page: `English`, `Russian`. */
export function languageName(code: string): string {
  return lyricLanguage(code)?.name ?? code
}

export type PdfPlan = {
  /** the translation languages that have a text, in the order asked */
  translations: Array<{ code: string; blocks: string[] }>
  /** the word languages that have at least one meaning in this song */
  wordLanguages: string[]
  /** asked for, but the song has nothing in it */
  missing: { translations: string[]; wordLanguages: string[] }
}

export function planFor(song: PdfSongInput, options: PdfOptions): PdfPlan {
  const translations = options.translationLanguages
    .map((code) => ({ code, blocks: (song.translations[code] ?? "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean) }))
    .filter((t) => t.blocks.length > 0)
  const has = (code: string) => Object.keys(song.glosses?.byLanguage[code] ?? {}).length > 0
  const wordLanguages = options.wordLanguages.filter(has)
  return {
    translations,
    wordLanguages,
    missing: {
      translations: options.translationLanguages.filter((c) => !translations.some((t) => t.code === c)),
      wordLanguages: options.wordLanguages.filter((c) => !has(c)),
    },
  }
}

/** The lines to print for the chosen script (Roman when the song has none in it), and whether the word meanings still line up with them. */
function linesOf(song: PdfSongInput, options: PdfOptions): { lines: string[]; glossable: boolean[] } {
  const own = song.linesByScript[options.script]
  const lines = own && own.length ? own : song.romanLines
  const glossable = lines.map((line, i) => (lines === song.romanLines ? true : words(line).length === words(song.romanLines[i] ?? "").length))
  return { lines, glossable }
}

const CSS = `
:root{--ink:oklch(0.19 0.014 60);--paper:oklch(0.97 0.01 85);--deep:oklch(0.92 0.016 82);--ochre:oklch(0.60 0.145 52);--clay:oklch(0.42 0.095 45);--stone:oklch(0.50 0.018 130);--line:oklch(0.50 0.018 130 / .35)}
*{box-sizing:border-box;margin:0}
body{background:var(--paper);color:var(--ink);font:400 11pt/1.5 Newsreader,Georgia,serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.eb{font:500 7.5pt/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--stone)}
header{border-top:1px solid var(--line);padding-top:4.5mm;margin-bottom:7mm;display:flex;justify-content:space-between;align-items:flex-end;gap:8mm}
header .eb.top{margin-bottom:3mm;display:block}
h1{font:300 26pt/1.02 Fraunces,Georgia,serif;letter-spacing:-.01em}
h1 b{font-weight:800;color:var(--clay);margin-right:4mm}
.meta{display:flex;gap:5mm;white-space:nowrap}
.meta span+span{border-left:1px solid var(--line);padding-left:5mm}
.col-h{margin-bottom:4mm}
.stanza{margin-bottom:5mm;break-inside:avoid}
.line{display:flex;flex-wrap:wrap;gap:0 4mm;margin-bottom:3.6mm;break-inside:avoid}
.w{display:flex;flex-direction:column}
.w .r{font:300 14.5pt/1.15 Fraunces,Georgia,serif}
.w .g{font:italic 400 7.6pt/1.2 Newsreader,Georgia,serif;color:var(--clay);border-top:1px dotted var(--line);margin-top:.9mm;padding-top:.5mm;min-height:3mm}
.w .g+.g{border-top:0;margin-top:0;padding-top:0;color:var(--stone)}
.tl p{font:400 11.5pt/1.55 Newsreader,Georgia,serif;margin-bottom:4mm;break-inside:avoid}
.tl .lang{margin:6mm 0 3mm}.tl .lang:first-child{margin-top:0}
footer{margin-top:7mm;border-top:1px solid var(--line);padding-top:3mm;display:flex;justify-content:space-between}
footer .ok{color:var(--clay)}
table{width:100%;border-collapse:collapse}td{vertical-align:top}
`

type Frame = { css: string; page: string; body: string; note?: string }

function head(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): string {
  const meta = [song.composed ? `Composed ${song.composed}` : "", song.raga ? `Raga ${song.raga}` : "", song.tala ? `Tala ${song.tala}` : ""].filter(Boolean)
  const langs = [options.script === "roman" ? "Roman" : options.script === "devanagari" ? "Devanagari" : "Bengali", ...plan.translations.map((t) => languageName(t.code))]
  meta.push(langs.join(" · "))
  return `<header><div><span class="eb top">Prabhat Samgiita</span><h1><b>№ ${song.number}</b>${esc(song.title)}</h1></div><div class="meta eb">${meta.map((m) => `<span>${esc(m)}</span>`).join("")}</div></header>`
}

function foot(song: PdfSongInput, note: string): string {
  return `<footer class="eb"><span>Prabhat Samgiita app · song ${song.number}</span><span class="ok">${esc(note)}</span><span></span></footer>`
}

/** One printed line: every word with the meanings of the chosen languages under it. */
function lineHtml(song: PdfSongInput, line: string, index: number, glossable: boolean, plan: PdfPlan, withWords: boolean): string {
  const ws = words(line)
  const cells = ws
    .map((w, j) => {
      const g = withWords && glossable
        ? plan.wordLanguages.map((code) => song.glosses?.byLanguage[code]?.[glossKey(index, j)] ?? "").map((text) => `<span class="g">${esc(text)}</span>`).join("")
        : ""
      return `<span class="w"><span class="r">${esc(w)}</span>${withWords && plan.wordLanguages.length ? g || '<span class="g"></span>' : ""}</span>`
    })
    .join("")
  return `<div class="line">${cells}</div>`
}

function stanzas(lines: string[]): Array<Array<{ line: string; index: number }>> {
  const out: Array<Array<{ line: string; index: number }>> = [[]]
  lines.forEach((line, index) => {
    if (!line.trim()) {
      if (out[out.length - 1].length) out.push([])
      return
    }
    out[out.length - 1].push({ line, index })
  })
  return out.filter((s) => s.length)
}

function songColumn(song: PdfSongInput, options: PdfOptions, plan: PdfPlan, withWords: boolean): string {
  const { lines, glossable } = linesOf(song, options)
  return stanzas(lines).map((st) => `<div class="stanza">${st.map(({ line, index }) => lineHtml(song, line, index, glossable[index] ?? false, plan, withWords)).join("")}</div>`).join("")
}

function translationColumn(plan: PdfPlan, separate: boolean): string {
  return plan.translations
    .map((t) => `${separate || plan.translations.length > 1 ? `<div class="eb lang">${esc(languageName(t.code))}</div>` : ""}${t.blocks.map((b) => `<p>${esc(b).replace(/\n/g, "<br>")}</p>`).join("")}`)
    .join("")
}

function sheet(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  const withWords = plan.wordLanguages.length > 0
  const note = withWords ? "" : "Word meanings are not in the catalogue for this song yet"
  return {
    css: "@page{size:297mm 210mm;margin:12mm 15mm}.col-l{width:60%;padding-right:9mm;border-right:1px solid var(--line)}.col-r{padding-left:9mm}",
    page: "landscape",
    note,
    body: `${head(song, options, plan)}<table><tr><td class="col-l"><div class="eb col-h">Song${withWords ? " · word by word" : ""}</div>${songColumn(song, options, plan, true)}</td><td class="col-r tl"><div class="eb col-h">Translation</div>${translationColumn(plan, false)}</td></tr></table>${foot(song, note)}`,
  }
}

function study(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  const { lines, glossable } = linesOf(song, options)
  const rows = lines
    .map((line, index) => (glossable[index] ? words(line).map((w, j) => ({ w, g: plan.wordLanguages.map((c) => song.glosses?.byLanguage[c]?.[glossKey(index, j)] ?? "") })) : []))
    .flat()
  const seen = new Set<string>()
  const list = rows.filter((r) => (seen.has(r.w.toLowerCase()) ? false : (seen.add(r.w.toLowerCase()), true)) && r.g.some(Boolean))
  const note = list.length ? "" : "Word meanings are not in the catalogue for this song yet"
  const table = list.length
    ? `<table class="vocab">${list.map((r) => `<tr><td class="vw">${esc(r.w)}</td><td>${r.g.filter(Boolean).map(esc).join(" · ")}</td></tr>`).join("")}</table>`
    : '<p class="empty">No word list yet.</p>'
  return {
    css: "@page{size:297mm 210mm;margin:12mm 15mm}.c1{width:34%;padding-right:7mm}.c2{width:27%;padding:0 7mm;border-left:1px solid var(--line);border-right:1px solid var(--line)}.c3{padding-left:7mm}.vocab td{padding:1.3mm 0;border-bottom:1px dotted var(--line);font:italic 400 9pt/1.3 Newsreader,Georgia,serif;color:var(--clay)}.vocab .vw{font:300 11pt/1.2 Fraunces,Georgia,serif;font-style:normal;color:var(--ink);width:42%;padding-right:3mm}.empty{color:var(--stone);font-style:italic}.notes{margin-top:8mm}.notes i{display:block;height:8mm;border-bottom:1px solid var(--line)}.w .g{display:none}.line{margin-bottom:2.4mm}",
    page: "landscape",
    note,
    body: `${head(song, options, plan)}<table><tr><td class="c1"><div class="eb col-h">Song</div>${songColumn(song, options, plan, false)}</td><td class="c2"><div class="eb col-h">Words</div>${table}</td><td class="c3 tl"><div class="eb col-h">Translation</div>${translationColumn(plan, false)}<div class="notes"><div class="eb col-h">Notes</div><i></i><i></i><i></i><i></i></div></td></tr></table>${foot(song, note)}`,
  }
}

function reader(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  return {
    css: "@page{size:210mm 297mm;margin:16mm 18mm}h1{font-size:30pt}.w .r{font-size:16pt}.w .g{display:none}.line{display:block;margin-bottom:1.8mm}.w{display:inline;margin-right:2.2mm}.tl{margin-top:9mm;border-top:1px solid var(--line);padding-top:6mm;column-count:" + Math.min(2, Math.max(1, plan.translations.length)) + ";column-gap:10mm}",
    page: "portrait",
    body: `${head(song, options, plan)}<div class="eb col-h">Song</div>${songColumn(song, options, plan, false)}<div class="tl">${translationColumn(plan, true)}</div>${foot(song, "")}`,
  }
}

function singing(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  return {
    css: "@page{size:297mm 210mm;margin:14mm 20mm}header{margin-bottom:10mm}h1{font-size:34pt}.w .r{font-size:26pt;line-height:1.2}.w .g{display:none}.line{display:block;margin-bottom:3mm}.w{display:inline;margin-right:4mm}.stanza{margin-bottom:9mm}",
    page: "landscape",
    body: `${head(song, options, { ...plan, translations: [] })}${songColumn(song, options, plan, false)}${foot(song, "")}`,
  }
}

const BUILDERS: Record<PdfVariantId, (s: PdfSongInput, o: PdfOptions, p: PdfPlan) => Frame> = { sheet, study, reader, singing }

export function buildSongPdfHtml(song: PdfSongInput, options: PdfOptions): { html: string; plan: PdfPlan; page: "landscape" | "portrait" } {
  const plan = planFor(song, options)
  const frame = BUILDERS[options.variant](song, options, plan)
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PS ${song.number} ${esc(song.title)}</title><link rel="stylesheet" href="${FONTS}"><style>${CSS}${frame.css}</style></head><body>${frame.body}</body></html>`
  return { html, plan, page: frame.page as "landscape" | "portrait" }
}
