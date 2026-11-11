import { lyricLanguage } from "@/lib/songPage/lyricLanguages"
import { glossKey } from "@/lib/songPage/songContent"

import { STAGES, THEMES } from "./themes"
import type { PdfOptions, PdfSongInput, PdfVariantId } from "./types"

/**
 * The song as a printable page: one HTML text per layout (the body) wearing one of five looks (lib/songPdf/themes.ts: colours,
 * type, the head of the page with its photo). The phone prints it to a PDF (lib/songPdf/share.ts); a browser prints it the
 * same way. Fonts come from Google Fonts and fall back to the device's own when the phone is offline, so the page is always
 * complete and only the type changes.
 *
 * Nothing is invented: a word with no meaning in the data prints with an empty line, and a language the song has no
 * translation in is left out of the page (and `missing` says so, so the sheet can tell the person).
 */

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
*{box-sizing:border-box;margin:0}
html,body{background:var(--paper)}
body{color:var(--ink);font:400 11pt/1.5 var(--body);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.eb{font:500 7.5pt/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
h1{font:var(--hw) 26pt/1.02 var(--display);letter-spacing:-.01em}
.meta{display:flex;gap:5mm;white-space:nowrap}
.meta span+span{border-left:1px solid var(--rule);padding-left:5mm}
.col-h{margin-bottom:4mm}
.stanza{margin-bottom:5mm;break-inside:avoid}
.line{display:flex;flex-wrap:wrap;gap:0 4mm;margin-bottom:3.6mm;break-inside:avoid}
.w{display:flex;flex-direction:column}
.w .r{font:var(--lw) 14.5pt/1.15 var(--lyric)}
.w .g{font:italic 400 7.6pt/1.2 var(--body);color:var(--gloss);border-top:1px dotted var(--rule);margin-top:.9mm;padding-top:.5mm;min-height:3mm}
.w .g+.g{border-top:0;margin-top:0;padding-top:0;color:var(--muted)}
.tl p{font:400 11.5pt/1.5 var(--body);margin-bottom:3.2mm;break-inside:avoid}
.tl .lang{margin:6mm 0 3mm}.tl .lang:first-child{margin-top:0}
footer{margin-top:6mm;border-top:1px solid var(--rule);padding-top:3mm;display:flex;justify-content:space-between}
footer .ok{color:var(--gloss)}
table{width:100%;border-collapse:collapse}td{vertical-align:top}
`

type Frame = { css: string; page: string; body: string; note?: string }

function head(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): string {
  const meta = [song.composed ? `Composed ${song.composed}` : "", song.raga ? `Raga ${song.raga}` : "", song.tala ? `Tala ${song.tala}` : ""].filter(Boolean)
  const langs = [options.script === "roman" ? "Roman" : options.script === "devanagari" ? "Devanagari" : "Bengali", ...plan.translations.map((t) => languageName(t.code))]
  meta.push(langs.join(" · "))
  return THEMES[options.theme].head({ number: song.number, title: song.title, meta, photo: song.photo })
}

function foot(song: PdfSongInput, note: string): string {
  if (!note) return ""
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
  const { lines, glossable } = linesOf(song, options)
  const parts = stanzas(lines)
  const first = plan.translations[0]
  // When the translation has as many parts as the song has stanzas, each stanza sits beside its own translation (and a page
  // break never splits a pair). Otherwise the song and the translation are two columns that run on side by side.
  const aligned = !!first && parts.length > 1 && first.blocks.length === parts.length
  const label = `<div class="eb col-h">Song${withWords ? " · word by word" : ""}</div>`
  const body = aligned
    ? `<div class="srow"><div class="col-l">${label}</div><div class="col-r"><div class="eb col-h">Translation</div></div></div>` +
      parts
        .map((st, i) => {
          const left = st.map(({ line, index }) => lineHtml(song, line, index, glossable[index] ?? false, plan, withWords)).join("")
          const right = plan.translations.map((t) => `<p>${esc(t.blocks[i] ?? "").replace(/\n/g, "<br>")}</p>`).join("")
          return `<div class="srow"><div class="col-l"><div class="stanza">${left}</div></div><div class="col-r tl">${right}</div></div>`
        })
        .join("")
    : `<table><tr><td class="col-l">${label}${songColumn(song, options, plan, true)}</td><td class="col-r tl"><div class="eb col-h">Translation</div>${translationColumn(plan, false)}</td></tr></table>`
  return {
    css: "@page{size:297mm 210mm;margin:12mm 15mm}.col-l{width:67%;padding-right:7mm;border-right:1px solid var(--rule)}.col-r{padding-left:7mm;flex:1}.srow{display:flex}.srow .stanza{margin-bottom:0;padding-bottom:6mm}.srow .tl{padding-bottom:6mm}.w .r{font-size:25pt;line-height:1.12}.w .g{font-size:14pt;margin-top:1.4mm;padding-top:.9mm;min-height:6.5mm}.line{gap:0 5mm;margin-bottom:6mm}.stanza{margin-bottom:9mm}.tl p{font-size:17pt;line-height:1.35;margin-bottom:5mm}.eb{font-size:9.5pt}",
    page: "landscape",
    note,
    body: `${head(song, options, plan)}${body}${foot(song, note)}`,
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
    css: "@page{size:297mm 210mm;margin:12mm 15mm}.c1{width:34%;padding-right:7mm}.c2{width:27%;padding:0 7mm;border-left:1px solid var(--rule);border-right:1px solid var(--rule)}.c3{padding-left:7mm}.vocab td{padding:1.3mm 0;border-bottom:1px dotted var(--rule);font:italic 400 9pt/1.3 var(--body);color:var(--gloss)}.vocab .vw{font:300 11pt/1.2 var(--lyric);font-style:normal;color:var(--ink);width:42%;padding-right:3mm}.empty{color:var(--muted);font-style:italic}.notes{margin-top:6mm}.notes i{display:block;height:7mm;border-bottom:1px solid var(--rule)}.w .g{display:none}.line{margin-bottom:2.4mm}",
    page: "landscape",
    note,
    body: `${head(song, options, plan)}<table><tr><td class="c1"><div class="eb col-h">Song</div>${songColumn(song, options, plan, false)}</td><td class="c2"><div class="eb col-h">Words</div>${table}</td><td class="c3 tl"><div class="eb col-h">Translation</div>${translationColumn(plan, false)}<div class="notes"><div class="eb col-h">Notes</div><i></i><i></i></div></td></tr></table>${foot(song, note)}`,
  }
}

function reader(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  return {
    css: "@page{size:210mm 297mm;margin:16mm 18mm}h1{font-size:30pt}.w .r{font-size:16pt}.w .g{display:none}.line{display:block;margin-bottom:1.8mm}.w{display:inline;margin-right:2.2mm}.tl{margin-top:9mm;border-top:1px solid var(--rule);padding-top:6mm;column-count:" + Math.min(2, Math.max(1, plan.translations.length)) + ";column-gap:10mm}",
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

const CHUNK_CHARS = 230

/** Greedy: translation parts packed into slides of at most CHUNK_CHARS letters. */
function chunks(blocks: string[]): string[][] {
  const out: string[][] = [[]]
  let size = 0
  for (const b of blocks) {
    if (size > 0 && size + b.length > CHUNK_CHARS) {
      out.push([])
      size = 0
    }
    out[out.length - 1].push(b)
    size += b.length
  }
  return out
}

/** Type size in pt so the longest line fits the width and all the lines fit the height; as big as that allows. */
function fitSize(lineCount: number, longest: number, cw: number, wmm: number, heightMm: number, cap: number): number {
  const byWidth = (wmm / 25.4 * 72) / (Math.max(longest, 8) * cw)
  const byHeight = (heightMm / 25.4 * 72) / (lineCount * 1.22)
  return Math.round(Math.max(24, Math.min(cap, byWidth, byHeight)))
}

function stage(song: PdfSongInput, options: PdfOptions, plan: PdfPlan): Frame {
  const spec = STAGES[options.theme]
  const { lines } = linesOf(song, options)
  const parts = stanzas(lines)
  const first = plan.translations[0]
  const paired = !!first && first.blocks.length === parts.length
  const slides: string[] = []
  const bar = (n: number, total: number) => `<div class="bar eb"><span>№ ${song.number} · ${esc(song.title)}</span><span>${n} / ${total}</span></div>`
  const wrap = (inner: string, n: number, total: number, cls = "") => `<section class="s ${cls}"><div class="bg"></div><div class="sc"></div><div class="gl"></div><div class="c">${inner}</div>${bar(n, total)}</section>`
  const stanzaSlides = parts.map((st, i) => {
    const longest = Math.max(...st.map((x) => x.line.length))
    const room = paired ? 82 : 118
    const size = fitSize(st.length, longest, spec.cw, spec.wmm, room, paired ? 60 : 84)
    const ts = Math.max(18, Math.min(30, Math.round(size * 0.52)))
    const tr = paired ? plan.translations.slice(0, st.length <= 4 ? 2 : 1).map((t) => `<p>${esc(t.blocks[i] ?? "").replace(/\n/g, "<br>")}</p>`).join("") : ""
    return { size, ts, html: `<div class="no">${i + 1}</div><div class="p"><div class="ly" style="--fs:${size}pt">${st.map((x) => `<div class="l">${esc(x.line)}</div>`).join("")}</div>${tr ? `<div class="tr" style="--ts:${ts}pt">${tr}</div>` : ""}</div>` }
  })
  const trSlides = paired ? [] : plan.translations.flatMap((t) => chunks(t.blocks).map((c) => ({ code: t.code, blocks: c })))
  const total = 1 + stanzaSlides.length + trSlides.length
  const titleSize = song.title.length <= 16 ? 92 : song.title.length <= 26 ? 70 : 52
  const meta = [song.composed ? `Composed ${song.composed}` : "", song.raga ? `Raga ${song.raga}` : "", song.tala ? `Tala ${song.tala}` : ""].filter(Boolean).join("  ·  ")
  slides.push(wrap(`<div class="cv"><div class="eb">Prabhat Samgiita · № ${song.number}</div><h1 style="font-size:${titleSize}pt">${esc(song.title)}</h1>${meta ? `<div class="eb mt">${esc(meta)}</div>` : ""}</div>`, 1, total, "cover"))
  stanzaSlides.forEach((s, i) => slides.push(wrap(s.html, i + 2, total)))
  trSlides.forEach((t, i) => {
    const text = t.blocks.map((b) => `<p>${esc(b).replace(/\n/g, "<br>")}</p>`).join("")
    const size = Math.max(22, Math.min(34, Math.round(34 - t.blocks.join("").length / 22)))
    slides.push(wrap(`<div class="p"><div class="eb lang">${esc(languageName(t.code))}</div><div class="tr big" style="--ts:${size}pt">${text}</div></div>`, 2 + stanzaSlides.length + i, total))
  })
  const css =
    "@page{size:297mm 167mm;margin:0}" +
    ".s{position:relative;width:297mm;height:167mm;overflow:hidden;break-after:page;page-break-after:always;background:var(--paper);color:var(--stext)}.s:last-child{break-after:auto;page-break-after:auto}" +
    `.bg{position:absolute;inset:-8%;background:var(--ink) url('${song.photo ?? ""}') center/cover;filter:blur(var(--blur,24px))}` +
    ".sc,.gl{position:absolute;inset:0}.c{position:absolute;inset:0;padding:14mm 20mm 20mm;display:flex;flex-direction:column;justify-content:center}" +
    ".p{position:relative}.ly .l{font:var(--lw) var(--fs)/1.2 var(--lyric);color:var(--stext)}" +
    ".tr{margin-top:7mm}.tr p{font:400 var(--ts)/1.3 var(--body);color:var(--sdim);margin-bottom:3mm}.tr.big{margin-top:5mm}.tr.big p{color:var(--stext);margin-bottom:5mm}.lang{color:var(--sdim);margin-bottom:5mm}" +
    ".bar{position:absolute;left:20mm;right:20mm;bottom:9mm;display:flex;justify-content:space-between;color:var(--sdim)}" +
    ".cv h1{font:var(--hw) 80pt/1 var(--display);letter-spacing:-.02em;color:var(--stext);margin:6mm 0}.cv .eb{color:var(--sdim)}.cv .mt{margin-top:6mm}" +
    ".cover .no{display:none}.s .eb{font-size:11pt}.bar.eb{font-size:10pt}" +
    spec.css
  return { css, page: "stage", body: slides.join("") }
}

const BUILDERS: Record<PdfVariantId, (s: PdfSongInput, o: PdfOptions, p: PdfPlan) => Frame> = { sheet, study, reader, singing, projector: stage }

export function buildSongPdfHtml(song: PdfSongInput, options: PdfOptions): { html: string; plan: PdfPlan; page: "landscape" | "portrait" | "stage" } {
  const plan = planFor(song, options)
  const frame = BUILDERS[options.variant](song, options, plan)
  // The page margin is painted white by print engines, so the sheet is full-bleed (margin 0) and the margin becomes body padding.
  const m = /@page\{size:([^;}]+);margin:([^}]+)\}/.exec(frame.css)
  if (m) frame.css = frame.css.replace(m[0], `@page{size:${m[1]};margin:0}body{padding:${m[2]};box-decoration-break:clone;-webkit-box-decoration-break:clone}`)
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>PS ${song.number} ${esc(song.title)}</title><link rel="stylesheet" href="${THEMES[options.theme].fonts}"><style>${THEMES[options.theme].css}${CSS}${frame.css}</style></head><body>${frame.body}</body></html>`
  return { html, plan, page: frame.page as "landscape" | "portrait" | "stage" }
}
